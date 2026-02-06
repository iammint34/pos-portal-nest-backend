import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationType } from './notifications.constants';
import type { DigestData } from './notifications.types';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private preferencesService: NotificationPreferencesService,
  ) {}

  /**
   * Send daily digests at 8 PM every day
   */
  @Cron(CronExpression.EVERY_DAY_AT_8PM)
  async sendDailyDigests(): Promise<void> {
    this.logger.log('Starting daily digest notifications');

    try {
      const schedules = await this.getEnabledSchedules(
        NotificationType.DAILY_DIGEST,
      );

      for (const schedule of schedules) {
        await this.processDailyDigest(schedule.storeId);
        await this.updateLastRun(schedule.id);
      }

      this.logger.log(`Processed daily digests for ${schedules.length} stores`);
    } catch (error) {
      this.logger.error('Error sending daily digests', error);
    }
  }

  /**
   * Send weekly summaries on Monday at 9 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklySummaries(): Promise<void> {
    this.logger.log('Starting weekly summary notifications');

    try {
      const schedules = await this.getEnabledSchedules(
        NotificationType.WEEKLY_SUMMARY,
      );

      for (const schedule of schedules) {
        await this.processWeeklySummary(schedule.storeId);
        await this.updateLastRun(schedule.id);
      }

      this.logger.log(
        `Processed weekly summaries for ${schedules.length} stores`,
      );
    } catch (error) {
      this.logger.error('Error sending weekly summaries', error);
    }
  }

  /**
   * Process daily digest for a store
   */
  private async processDailyDigest(storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });

    if (!store) return;

    // Get users who want daily digests
    const preferences = await this.preferencesService.findByPreferences(
      storeId,
      { dailyDigest: true, emailEnabled: true },
    );

    if (preferences.length === 0) {
      this.logger.debug(`No users subscribed to daily digest for ${storeId}`);
      return;
    }

    // Gather digest data
    const digestData = await this.gatherDigestData(storeId, store.name, 1);

    // Send to each subscribed user
    for (const pref of preferences) {
      try {
        await this.notificationsService.sendDailyDigest(
          pref.userId,
          storeId,
          digestData,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send daily digest to user ${pref.userId}`,
          error,
        );
      }
    }
  }

  /**
   * Process weekly summary for a store
   */
  private async processWeeklySummary(storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });

    if (!store) return;

    // Get users who want weekly summaries
    const preferences = await this.preferencesService.findByPreferences(
      storeId,
      { weeklySummary: true, emailEnabled: true },
    );

    if (preferences.length === 0) {
      this.logger.debug(`No users subscribed to weekly summary for ${storeId}`);
      return;
    }

    // Gather digest data for the week
    const digestData = await this.gatherDigestData(storeId, store.name, 7);

    // Send to each subscribed user
    for (const pref of preferences) {
      try {
        await this.notificationsService.send({
          storeId,
          userId: pref.userId,
          type: NotificationType.WEEKLY_SUMMARY,
          channel: 'EMAIL' as any,
          recipient: pref.email || (pref as any).user?.email,
          subject: `Weekly Sales Summary - ${store.name}`,
          content: this.renderWeeklySummaryTemplate(digestData),
        });
      } catch (error) {
        this.logger.error(
          `Failed to send weekly summary to user ${pref.userId}`,
          error,
        );
      }
    }
  }

  /**
   * Gather digest data from reports
   */
  private async gatherDigestData(
    storeId: string,
    storeName: string,
    days: number,
  ): Promise<DigestData> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get sales summary
    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        status: 'COMPLETED',
        posCreatedAt: { gte: startDate, lte: endDate },
      },
      select: {
        grandTotal: true,
      },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    // Get top selling items
    const topItems = await this.prisma.orderItem.groupBy({
      by: ['itemName'],
      where: {
        order: {
          storeId,
          status: 'COMPLETED',
          posCreatedAt: { gte: startDate, lte: endDate },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    // Get device status
    const devices = await this.prisma.posDevice.findMany({
      where: {
        branch: { storeId },
        isRegistered: true,
      },
      select: { status: true },
    });

    const onlineDevices = devices.filter((d) => d.status === 'ONLINE').length;
    const offlineDevices = devices.filter((d) => d.status === 'OFFLINE').length;

    // Get active alerts
    const alerts =
      (await (this.prisma as any).alert?.findMany?.({
        where: {
          storeId,
          dismissedAt: null,
          createdAt: { gte: startDate },
        },
        select: { type: true, severity: true, message: true, createdAt: true },
        take: 5,
      })) || [];

    return {
      storeId,
      storeName,
      period: { start: startDate, end: endDate },
      summary: {
        totalSales,
        orderCount,
        averageOrderValue,
        topSellingItems: topItems.map((item) => ({
          name: item.itemName,
          quantity: item._sum.quantity || 0,
          revenue: Number(item._sum.totalPrice) || 0,
        })),
      },
      deviceStatus: {
        online: onlineDevices,
        offline: offlineDevices,
        total: devices.length,
      },
      alerts: alerts.map((a: any) => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
        createdAt: a.createdAt || new Date(),
      })),
    };
  }

  /**
   * Render weekly summary template
   */
  private renderWeeklySummaryTemplate(data: DigestData): string {
    const topItems = data.summary.topSellingItems
      .slice(0, 10)
      .map(
        (item, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>₱${item.revenue.toLocaleString()}</td>
          </tr>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .stat-box { display: inline-block; padding: 15px; margin: 10px; background: white; border-radius: 8px; text-align: center; min-width: 120px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
          .stat-label { font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly Sales Summary</h1>
            <p>${data.storeName}</p>
            <p>${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}</p>
          </div>
          <div class="content">
            <h2>Week Overview</h2>
            <div style="text-align: center;">
              <div class="stat-box">
                <div class="stat-value">₱${data.summary.totalSales.toLocaleString()}</div>
                <div class="stat-label">Total Sales</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${data.summary.orderCount}</div>
                <div class="stat-label">Total Orders</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">₱${data.summary.averageOrderValue.toLocaleString()}</div>
                <div class="stat-label">Avg Order</div>
              </div>
            </div>

            <h2>Top 10 Items This Week</h2>
            <table>
              <thead>
                <tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr>
              </thead>
              <tbody>${topItems || '<tr><td colspan="4">No sales data</td></tr>'}</tbody>
            </table>

            <h2>Device Health</h2>
            <p>
              <strong>${data.deviceStatus.online}</strong> online /
              <strong>${data.deviceStatus.offline}</strong> offline /
              <strong>${data.deviceStatus.total}</strong> total devices
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ==================== Schedule Management ====================

  /**
   * Get enabled schedules for a notification type
   */
  private async getEnabledSchedules(
    type: NotificationType,
  ): Promise<Array<{ id: string; storeId: string }>> {
    return (this.prisma as any).notificationSchedule.findMany({
      where: { type, enabled: true },
      select: { id: true, storeId: true },
    });
  }

  /**
   * Update last run timestamp
   */
  private async updateLastRun(scheduleId: string): Promise<void> {
    await (this.prisma as any).notificationSchedule.update({
      where: { id: scheduleId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: this.calculateNextRun(),
      },
    });
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(): Date {
    // For simplicity, return tomorrow same time
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next;
  }

  // ==================== Public Schedule Management ====================

  /**
   * Get schedule for a store
   */
  async getSchedule(
    storeId: string,
    type: NotificationType,
  ): Promise<any | null> {
    return (this.prisma as any).notificationSchedule.findUnique({
      where: { storeId_type: { storeId, type } },
    });
  }

  /**
   * Get all schedules for a store
   */
  async getStoreSchedules(storeId: string): Promise<any[]> {
    return (this.prisma as any).notificationSchedule.findMany({
      where: { storeId },
    });
  }

  /**
   * Create or update a schedule
   */
  async upsertSchedule(
    storeId: string,
    type: NotificationType,
    data: {
      schedule?: string;
      timezone?: string;
      enabled?: boolean;
    },
  ): Promise<any> {
    const defaultSchedules: Record<NotificationType, string> = {
      [NotificationType.DAILY_DIGEST]: '0 20 * * *', // 8 PM daily
      [NotificationType.WEEKLY_SUMMARY]: '0 9 * * 1', // 9 AM Monday
      [NotificationType.LOSS_PREVENTION_ALERT]: '',
      [NotificationType.DEVICE_OFFLINE]: '',
      [NotificationType.SYNC_FAILURE]: '',
      [NotificationType.SYSTEM_ALERT]: '',
    };

    return (this.prisma as any).notificationSchedule.upsert({
      where: { storeId_type: { storeId, type } },
      create: {
        storeId,
        type,
        schedule: data.schedule || defaultSchedules[type],
        timezone: data.timezone || 'Asia/Manila',
        enabled: data.enabled ?? true,
      },
      update: {
        schedule: data.schedule,
        timezone: data.timezone,
        enabled: data.enabled,
      },
    });
  }

  /**
   * Initialize default schedules for a store
   */
  async initializeDefaultSchedules(storeId: string): Promise<number> {
    const defaultSchedules = [
      {
        type: NotificationType.DAILY_DIGEST,
        schedule: '0 20 * * *',
        enabled: true,
      },
      {
        type: NotificationType.WEEKLY_SUMMARY,
        schedule: '0 9 * * 1',
        enabled: false,
      },
    ];

    let count = 0;
    for (const sched of defaultSchedules) {
      const existing = await this.getSchedule(storeId, sched.type);
      if (!existing) {
        await this.upsertSchedule(storeId, sched.type, sched);
        count++;
      }
    }

    return count;
  }

  /**
   * Manually trigger a digest for testing
   */
  async triggerDigest(
    storeId: string,
    type: NotificationType,
  ): Promise<{ sent: number }> {
    if (type === NotificationType.DAILY_DIGEST) {
      await this.processDailyDigest(storeId);
    } else if (type === NotificationType.WEEKLY_SUMMARY) {
      await this.processWeeklySummary(storeId);
    }

    return { sent: 1 };
  }
}

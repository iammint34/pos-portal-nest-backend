import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from './notifications.constants';
import type {
  NotificationLog,
  SendNotificationDto,
  NotificationResult,
  DigestData,
  AlertNotificationData,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailProvider: EmailProvider,
    private smsProvider: SmsProvider,
  ) {}

  // ==================== Core Notification Sending ====================

  /**
   * Send a notification through the specified channel
   */
  async send(dto: SendNotificationDto): Promise<NotificationResult> {
    // Create notification log entry
    const log = await this.createLog(dto);

    try {
      let result: NotificationResult;

      if (dto.channel === NotificationChannel.EMAIL) {
        result = await this.sendEmail(dto);
      } else if (dto.channel === NotificationChannel.SMS) {
        result = await this.sendSms(dto);
      } else {
        result = { success: false, error: `Unknown channel: ${dto.channel}` };
      }

      // Update log with result
      await this.updateLogStatus(
        log.id,
        result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        result.error,
      );

      return result;
    } catch (error: any) {
      await this.updateLogStatus(
        log.id,
        NotificationStatus.FAILED,
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    dto: SendNotificationDto,
  ): Promise<NotificationResult> {
    return this.emailProvider.send({
      to: dto.recipient,
      subject: dto.subject || this.getDefaultSubject(dto.type),
      html: dto.content,
      text: this.stripHtml(dto.content),
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSms(dto: SendNotificationDto): Promise<NotificationResult> {
    return this.smsProvider.send({
      to: dto.recipient,
      message: this.stripHtml(dto.content),
    });
  }

  // ==================== Notification Templates ====================

  /**
   * Send daily digest to a user
   */
  async sendDailyDigest(
    userId: string,
    storeId: string,
    data: DigestData,
  ): Promise<NotificationResult> {
    const preference = await this.getPreference(storeId, userId);
    if (!preference || !preference.dailyDigest || !preference.emailEnabled) {
      return { success: true, messageId: 'skipped-preference' };
    }

    const recipient = preference.email || (await this.getUserEmail(userId));
    if (!recipient) {
      return { success: false, error: 'No email address available' };
    }

    const html = this.renderDailyDigestTemplate(data);

    return this.send({
      storeId,
      userId,
      type: NotificationType.DAILY_DIGEST,
      channel: NotificationChannel.EMAIL,
      recipient,
      subject: `Daily Sales Digest - ${data.storeName}`,
      content: html,
      data,
    });
  }

  /**
   * Send alert notification to users
   */
  async sendAlertNotification(
    storeId: string,
    data: AlertNotificationData,
  ): Promise<{ sent: number; failed: number }> {
    // Get all users with alerts enabled for this store
    const preferences = await this.getStorePreferences(storeId, {
      alertsEnabled: true,
    });

    let sent = 0;
    let failed = 0;

    for (const pref of preferences) {
      if (pref.emailEnabled) {
        const recipient = pref.email || (await this.getUserEmail(pref.userId));
        if (recipient) {
          const result = await this.send({
            storeId,
            userId: pref.userId,
            type: NotificationType.LOSS_PREVENTION_ALERT,
            channel: NotificationChannel.EMAIL,
            recipient,
            subject: `[${data.severity}] ${data.title} - ${data.storeName}`,
            content: this.renderAlertTemplate(data),
            data,
          });

          if (result.success) sent++;
          else failed++;
        }
      }

      if (pref.smsEnabled && pref.phone) {
        const result = await this.send({
          storeId,
          userId: pref.userId,
          type: NotificationType.LOSS_PREVENTION_ALERT,
          channel: NotificationChannel.SMS,
          recipient: pref.phone,
          content: `[${data.severity}] ${data.title}: ${data.message}`,
          data,
        });

        if (result.success) sent++;
        else failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send device offline notification
   */
  async sendDeviceOfflineNotification(
    storeId: string,
    storeName: string,
    deviceName: string,
    branchName: string,
    lastSeenAt: Date,
  ): Promise<{ sent: number; failed: number }> {
    const data: AlertNotificationData = {
      storeId,
      storeName,
      alertType: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: 'POS Device Offline',
      message: `Device "${deviceName}" at ${branchName} has been offline since ${lastSeenAt.toLocaleString()}`,
      metadata: { deviceName, branchName, lastSeenAt },
      createdAt: new Date(),
    };

    return this.sendAlertNotification(storeId, data);
  }

  // ==================== Template Rendering ====================

  private renderDailyDigestTemplate(data: DigestData): string {
    const topItems = data.summary.topSellingItems
      .slice(0, 5)
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
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .stat-box { display: inline-block; padding: 15px; margin: 10px; background: white; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
          .stat-label { font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f3f4f6; }
          .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
          .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
          .alert-critical { background: #fee2e2; border-left: 4px solid #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Daily Sales Digest</h1>
            <p>${data.storeName}</p>
            <p>${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}</p>
          </div>
          <div class="content">
            <h2>Sales Summary</h2>
            <div style="text-align: center;">
              <div class="stat-box">
                <div class="stat-value">₱${data.summary.totalSales.toLocaleString()}</div>
                <div class="stat-label">Total Sales</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${data.summary.orderCount}</div>
                <div class="stat-label">Orders</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">₱${data.summary.averageOrderValue.toLocaleString()}</div>
                <div class="stat-label">Avg Order</div>
              </div>
            </div>

            <h2>Top Selling Items</h2>
            <table>
              <thead>
                <tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr>
              </thead>
              <tbody>${topItems || '<tr><td colspan="4">No sales data</td></tr>'}</tbody>
            </table>

            <h2>Device Status</h2>
            <p>
              <strong>${data.deviceStatus.online}</strong> online /
              <strong>${data.deviceStatus.offline}</strong> offline /
              <strong>${data.deviceStatus.total}</strong> total
            </p>

            ${
              data.alerts.length > 0
                ? `
            <h2>Alerts (${data.alerts.length})</h2>
            ${data.alerts
              .map(
                (alert) => `
              <div class="alert alert-${alert.severity.toLowerCase()}">
                <strong>${alert.type}</strong>: ${alert.message}
              </div>
            `,
              )
              .join('')}
            `
                : ''
            }
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private renderAlertTemplate(data: AlertNotificationData): string {
    const severityColors: Record<string, string> = {
      INFO: '#3b82f6',
      WARNING: '#f59e0b',
      CRITICAL: '#ef4444',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${severityColors[data.severity] || '#6b7280'}; color: white; padding: 20px; }
          .content { padding: 20px; background: #f9fafb; }
          .metadata { background: white; padding: 15px; border-radius: 8px; margin-top: 15px; }
          .metadata dt { font-weight: bold; color: #6b7280; }
          .metadata dd { margin: 0 0 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.title}</h1>
            <p>${data.storeName} | ${data.severity}</p>
          </div>
          <div class="content">
            <p>${data.message}</p>
            <p><small>Alert generated at: ${data.createdAt.toLocaleString()}</small></p>
            ${
              data.metadata
                ? `
            <div class="metadata">
              <h3>Details</h3>
              <dl>
                ${Object.entries(data.metadata)
                  .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
                  .join('')}
              </dl>
            </div>
            `
                : ''
            }
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ==================== Notification Logs ====================

  private async createLog(dto: SendNotificationDto): Promise<NotificationLog> {
    return (this.prisma as any).notificationLog.create({
      data: {
        storeId: dto.storeId,
        userId: dto.userId || null,
        type: dto.type,
        channel: dto.channel,
        recipient: dto.recipient,
        subject: dto.subject || null,
        content: dto.content,
        status: NotificationStatus.PENDING,
      },
    });
  }

  private async updateLogStatus(
    logId: string,
    status: NotificationStatus,
    errorMessage?: string,
  ): Promise<void> {
    await (this.prisma as any).notificationLog.update({
      where: { id: logId },
      data: {
        status,
        errorMessage: errorMessage || null,
        sentAt: status === NotificationStatus.SENT ? new Date() : null,
      },
    });
  }

  /**
   * Get notification logs for a store
   */
  async getLogs(
    storeId: string,
    filters?: {
      type?: NotificationType;
      status?: NotificationStatus;
      userId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<NotificationLog[]> {
    const where: any = { storeId };

    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.userId = filters.userId;

    return (this.prisma as any).notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });
  }

  // ==================== Preferences ====================

  /**
   * Get notification preference for a user
   */
  async getPreference(storeId: string, userId: string): Promise<any | null> {
    return (this.prisma as any).notificationPreference.findUnique({
      where: {
        storeId_userId: { storeId, userId },
      },
    });
  }

  /**
   * Get all preferences for a store
   */
  async getStorePreferences(
    storeId: string,
    filters?: { alertsEnabled?: boolean; dailyDigest?: boolean },
  ): Promise<any[]> {
    const where: any = { storeId };

    if (filters?.alertsEnabled !== undefined) {
      where.alertsEnabled = filters.alertsEnabled;
    }
    if (filters?.dailyDigest !== undefined) {
      where.dailyDigest = filters.dailyDigest;
    }

    return (this.prisma as any).notificationPreference.findMany({ where });
  }

  // ==================== Helpers ====================

  private async getUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  }

  private getDefaultSubject(type: NotificationType): string {
    const subjects: Record<NotificationType, string> = {
      [NotificationType.DAILY_DIGEST]: 'Daily Sales Digest',
      [NotificationType.WEEKLY_SUMMARY]: 'Weekly Sales Summary',
      [NotificationType.LOSS_PREVENTION_ALERT]: 'Loss Prevention Alert',
      [NotificationType.DEVICE_OFFLINE]: 'Device Offline Alert',
      [NotificationType.SYNC_FAILURE]: 'Sync Failure Alert',
      [NotificationType.SYSTEM_ALERT]: 'System Alert',
    };
    return subjects[type] || 'Notification';
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

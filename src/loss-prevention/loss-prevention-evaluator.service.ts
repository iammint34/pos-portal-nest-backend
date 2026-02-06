import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LossPreventionService } from './loss-prevention.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { FeatureKey } from '../feature-flags/feature-flags.constants';
import {
  LossPreventionMetricType,
  LossPreventionTimeWindow,
  LossPreventionScope,
  AlertSeverity,
} from './loss-prevention.constants';
import type {
  LossPreventionThreshold,
  MetricData,
  EvaluationResult,
} from './loss-prevention.types';

@Injectable()
export class LossPreventionEvaluatorService {
  private readonly logger = new Logger(LossPreventionEvaluatorService.name);

  constructor(
    private prisma: PrismaService,
    private lossPreventionService: LossPreventionService,
    private notificationsService: NotificationsService,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Scheduled evaluation - runs every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduledEvaluation(): Promise<void> {
    this.logger.log('Starting scheduled loss prevention evaluation');

    try {
      // Get all stores with loss prevention enabled
      const stores = await this.getStoresWithFeatureEnabled();

      for (const store of stores) {
        await this.evaluateStore(store.id);
      }

      this.logger.log(
        `Completed loss prevention evaluation for ${stores.length} stores`,
      );
    } catch (error) {
      this.logger.error('Error in scheduled loss prevention evaluation', error);
    }
  }

  /**
   * Get stores that have loss prevention feature enabled
   */
  private async getStoresWithFeatureEnabled(): Promise<Array<{ id: string }>> {
    const storeFeatures = await (this.prisma as any).storeFeature.findMany({
      where: {
        featureKey: FeatureKey.LOSS_PREVENTION,
        enabled: true,
      },
      select: { storeId: true },
    });

    return storeFeatures.map((sf: any) => ({ id: sf.storeId }));
  }

  /**
   * Evaluate all branches in a store
   */
  async evaluateStore(storeId: string): Promise<EvaluationResult[]> {
    const branches = await this.prisma.branch.findMany({
      where: { storeId, deletedAt: null },
      select: { id: true },
    });

    const results: EvaluationResult[] = [];

    for (const branch of branches) {
      const result = await this.evaluateBranch(storeId, branch.id);
      if (result.incidents.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Evaluate a specific branch against all thresholds
   */
  async evaluateBranch(
    storeId: string,
    branchId: string,
  ): Promise<EvaluationResult> {
    const thresholds =
      await this.lossPreventionService.getEnabledThresholds(storeId);

    const result: EvaluationResult = {
      storeId,
      branchId,
      timeWindow: LossPreventionTimeWindow.DAY,
      metrics: [],
      incidents: [],
    };

    // Group thresholds by time window and evaluate
    const timeWindows = [
      LossPreventionTimeWindow.SHIFT,
      LossPreventionTimeWindow.DAY,
      LossPreventionTimeWindow.WEEK,
    ];

    for (const timeWindow of timeWindows) {
      const windowThresholds = thresholds.filter(
        (t) => t.timeWindow === timeWindow,
      );

      if (windowThresholds.length === 0) continue;

      const { startDate, endDate } = this.getTimeWindowDates(timeWindow);

      // Evaluate branch-level thresholds
      const branchThresholds = windowThresholds.filter(
        (t) => t.scope === LossPreventionScope.BRANCH,
      );
      for (const threshold of branchThresholds) {
        const metricData = await this.calculateMetric(
          storeId,
          branchId,
          null,
          null,
          threshold,
          startDate,
          endDate,
        );

        result.metrics.push(metricData);

        if (metricData.isExceeded) {
          const incident = await this.createIncidentIfNew(
            storeId,
            branchId,
            null,
            null,
            threshold,
            metricData,
          );
          if (incident) {
            result.incidents.push(incident);
          }
        }
      }

      // Evaluate staff-level thresholds
      const staffThresholds = windowThresholds.filter(
        (t) => t.scope === LossPreventionScope.STAFF,
      );
      if (staffThresholds.length > 0) {
        const staffIds = await this.getActiveStaffForBranch(
          branchId,
          startDate,
          endDate,
        );

        for (const staffId of staffIds) {
          for (const threshold of staffThresholds) {
            const metricData = await this.calculateMetric(
              storeId,
              branchId,
              staffId,
              null,
              threshold,
              startDate,
              endDate,
            );

            if (metricData.isExceeded) {
              const incident = await this.createIncidentIfNew(
                storeId,
                branchId,
                staffId,
                null,
                threshold,
                metricData,
              );
              if (incident) {
                result.incidents.push(incident);
              }
            }
          }
        }
      }
    }

    // Send notifications for new incidents
    if (result.incidents.length > 0) {
      await this.sendIncidentNotifications(storeId, result.incidents);
    }

    return result;
  }

  /**
   * Calculate a specific metric
   */
  private async calculateMetric(
    storeId: string,
    branchId: string,
    staffId: string | null,
    posDeviceId: string | null,
    threshold: LossPreventionThreshold,
    startDate: Date,
    endDate: Date,
  ): Promise<MetricData> {
    let value = 0;
    const transactions: string[] = [];

    const baseWhere: any = {
      storeId,
      branchId,
      posCreatedAt: { gte: startDate, lte: endDate },
    };

    switch (threshold.metricType) {
      case LossPreventionMetricType.VOID_COUNT:
      case LossPreventionMetricType.VOID_AMOUNT: {
        const voidedOrders = await this.prisma.order.findMany({
          where: { ...baseWhere, status: 'VOIDED' },
          select: { id: true, grandTotal: true },
        });

        if (threshold.metricType === LossPreventionMetricType.VOID_COUNT) {
          value = voidedOrders.length;
        } else {
          value = voidedOrders.reduce(
            (sum, o) => sum + Number(o.grandTotal),
            0,
          );
        }
        transactions.push(...voidedOrders.map((o) => o.id));
        break;
      }

      case LossPreventionMetricType.REFUND_COUNT:
      case LossPreventionMetricType.REFUND_AMOUNT: {
        const refunds = await this.prisma.refund.findMany({
          where: {
            order: baseWhere,
          },
          select: { id: true, amount: true, orderId: true },
        });

        if (threshold.metricType === LossPreventionMetricType.REFUND_COUNT) {
          value = refunds.length;
        } else {
          value = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
        }
        transactions.push(...refunds.map((r) => r.orderId));
        break;
      }

      case LossPreventionMetricType.DISCOUNT_PERCENTAGE: {
        const orders = await this.prisma.order.findMany({
          where: { ...baseWhere, status: 'COMPLETED' },
          select: { id: true, subtotal: true, discountTotal: true },
        });

        if (orders.length > 0) {
          const totalSubtotal = orders.reduce(
            (sum, o) => sum + Number(o.subtotal),
            0,
          );
          const totalDiscount = orders.reduce(
            (sum, o) => sum + Number(o.discountTotal),
            0,
          );
          value = totalSubtotal > 0 ? (totalDiscount / totalSubtotal) * 100 : 0;
        }
        break;
      }

      case LossPreventionMetricType.CONSECUTIVE_VOIDS: {
        // This requires more complex logic to detect consecutive voids
        // For now, we'll count voids within a short time period
        const recentVoids = await this.prisma.order.findMany({
          where: {
            ...baseWhere,
            status: 'VOIDED',
          },
          orderBy: { posCreatedAt: 'desc' },
          take: 10,
          select: { id: true, posCreatedAt: true },
        });

        // Check for consecutive voids (within 5 minutes of each other)
        let consecutiveCount = 0;
        for (let i = 0; i < recentVoids.length - 1; i++) {
          const timeDiff =
            new Date(recentVoids[i].posCreatedAt).getTime() -
            new Date(recentVoids[i + 1].posCreatedAt).getTime();
          if (timeDiff < 5 * 60 * 1000) {
            // 5 minutes
            consecutiveCount++;
          } else {
            break;
          }
        }
        value = consecutiveCount + 1; // +1 for the first void
        if (consecutiveCount > 0) {
          transactions.push(
            ...recentVoids.slice(0, consecutiveCount + 1).map((v) => v.id),
          );
        }
        break;
      }
    }

    const thresholdValue = Number(threshold.threshold);
    const isExceeded = value > thresholdValue;
    const percentageOver = isExceeded
      ? ((value - thresholdValue) / thresholdValue) * 100
      : 0;

    return {
      metricType: threshold.metricType as LossPreventionMetricType,
      value,
      threshold: thresholdValue,
      isExceeded,
      percentageOver,
      transactions,
    };
  }

  /**
   * Create an incident if one doesn't already exist for this metric in the current window
   */
  private async createIncidentIfNew(
    storeId: string,
    branchId: string,
    staffId: string | null,
    posDeviceId: string | null,
    threshold: LossPreventionThreshold,
    metricData: MetricData,
  ): Promise<any> {
    const { startDate } = this.getTimeWindowDates(
      threshold.timeWindow as LossPreventionTimeWindow,
    );

    // Check if incident already exists for this combination in current window
    const existingIncident = await (
      this.prisma as any
    ).lossPreventionIncident.findFirst({
      where: {
        storeId,
        branchId,
        staffId: staffId || null,
        posDeviceId: posDeviceId || null,
        metricType: threshold.metricType,
        timeWindow: threshold.timeWindow,
        createdAt: { gte: startDate },
        status: { not: 'RESOLVED' },
      },
    });

    if (existingIncident) {
      return null; // Don't create duplicate
    }

    return this.lossPreventionService.createIncident({
      storeId,
      branchId,
      staffId: staffId || undefined,
      posDeviceId: posDeviceId || undefined,
      metricType: threshold.metricType as LossPreventionMetricType,
      actualValue: metricData.value,
      thresholdValue: metricData.threshold,
      timeWindow: threshold.timeWindow as LossPreventionTimeWindow,
      transactions: metricData.transactions,
    });
  }

  /**
   * Get time window date range
   */
  private getTimeWindowDates(timeWindow: LossPreventionTimeWindow): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeWindow) {
      case LossPreventionTimeWindow.SHIFT:
        // Assume 8-hour shifts, round to nearest shift start
        startDate.setHours(startDate.getHours() - 8);
        break;
      case LossPreventionTimeWindow.DAY:
        startDate.setHours(0, 0, 0, 0);
        break;
      case LossPreventionTimeWindow.WEEK:
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Get staff who have processed orders in a branch during time window
   */
  private async getActiveStaffForBranch(
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<string[]> {
    // Get unique operators from shifts in this time window
    const shifts = await this.prisma.shift.findMany({
      where: {
        branchId,
        openedAt: { gte: startDate, lte: endDate },
        operatorId: { not: null },
      },
      select: { operatorId: true },
      distinct: ['operatorId'],
    });

    return shifts.map((s) => s.operatorId!).filter(Boolean);
  }

  /**
   * Send notifications for new incidents
   */
  private async sendIncidentNotifications(
    storeId: string,
    incidents: any[],
  ): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });

    for (const incident of incidents) {
      try {
        await this.notificationsService.sendAlertNotification(storeId, {
          storeId,
          storeName: store?.name || 'Unknown Store',
          alertType: 'LOSS_PREVENTION',
          severity: incident.severity || AlertSeverity.WARNING,
          title: `Loss Prevention Alert: ${incident.metricType}`,
          message: `${incident.metricType} exceeded threshold: ${incident.actualValue} (threshold: ${incident.thresholdValue})`,
          metadata: {
            branchId: incident.branchId,
            staffId: incident.staffId,
            metricType: incident.metricType,
            actualValue: incident.actualValue,
            thresholdValue: incident.thresholdValue,
          },
          createdAt: new Date(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to send notification for incident ${incident.id}`,
          error,
        );
      }
    }
  }

  /**
   * Manual evaluation trigger for a specific store
   */
  async triggerEvaluation(storeId: string): Promise<EvaluationResult[]> {
    this.logger.log(`Manual evaluation triggered for store ${storeId}`);
    return this.evaluateStore(storeId);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertType, AlertSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import {
  AlertConfigService,
  ResolvedAlertConfig,
} from './alert-config.service';

@Injectable()
export class AlertEvaluatorService {
  private readonly logger = new Logger(AlertEvaluatorService.name);

  constructor(
    private prisma: PrismaService,
    private alertsService: AlertsService,
    private alertConfigService: AlertConfigService,
  ) {}

  @Cron('*/5 * * * *')
  async evaluateAlerts() {
    this.logger.log('Starting alert evaluation cycle...');

    const stores = await this.prisma.store.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
    });

    for (const store of stores) {
      const results = await Promise.allSettled([
        this.evaluateZeroSalesBranch(store.id),
        this.evaluateExcessiveVoidRefund(store.id),
        this.evaluateInventoryAnomaly(store.id),
        this.evaluatePosSyncFailure(store.id),
      ]);

      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(
            `Alert evaluation failed for store ${store.id}: ${result.reason}`,
          );
        }
      }
    }

    this.logger.log('Alert evaluation cycle complete.');
  }

  private async evaluateZeroSalesBranch(storeId: string) {
    const config = await this.alertConfigService.getConfig(
      storeId,
      AlertType.ZERO_SALES_BRANCH,
    );
    if (!config.enabled) return;

    const thresholds = config.thresholds as {
      noSalesHours: number;
      businessStartHour: number;
      businessEndHour: number;
    };

    const currentHour = new Date().getHours();
    if (
      currentHour < thresholds.businessStartHour ||
      currentHour >= thresholds.businessEndHour
    ) {
      return;
    }

    const branches = await this.prisma.branch.findMany({
      where: {
        storeId,
        deletedAt: null,
        status: { not: 'MAINTENANCE' },
      },
      select: { id: true, name: true },
    });

    const sinceDate = new Date(
      Date.now() - thresholds.noSalesHours * 60 * 60 * 1000,
    );

    for (const branch of branches) {
      const orderCount = await this.prisma.order.count({
        where: {
          storeId,
          branchId: branch.id,
          status: 'COMPLETED',
          posCreatedAt: { gte: sinceDate },
        },
      });

      if (orderCount === 0) {
        await this.alertsService.createAlertIfNotDuplicate({
          storeId,
          type: AlertType.ZERO_SALES_BRANCH,
          severity: AlertSeverity.WARNING,
          title: `No sales at ${branch.name}`,
          message: `Branch "${branch.name}" has had no completed sales in the last ${thresholds.noSalesHours} hours during business hours.`,
          metadata: { branchId: branch.id, branchName: branch.name },
        });
      }
    }
  }

  private async evaluateExcessiveVoidRefund(storeId: string) {
    const config = await this.alertConfigService.getConfig(
      storeId,
      AlertType.EXCESSIVE_VOID_REFUND,
    );
    if (!config.enabled) return;

    const thresholds = config.thresholds as {
      windowHours: number;
      warningThreshold: number;
      criticalThreshold: number;
    };

    const sinceDate = new Date(
      Date.now() - thresholds.windowHours * 60 * 60 * 1000,
    );

    const branches = await this.prisma.branch.findMany({
      where: { storeId, deletedAt: null },
      select: { id: true, name: true },
    });

    for (const branch of branches) {
      const [totalOrders, voidedOrders, refundCount] = await Promise.all([
        this.prisma.order.count({
          where: {
            storeId,
            branchId: branch.id,
            posCreatedAt: { gte: sinceDate },
          },
        }),
        this.prisma.order.count({
          where: {
            storeId,
            branchId: branch.id,
            status: 'VOIDED',
            posCreatedAt: { gte: sinceDate },
          },
        }),
        this.prisma.refund.count({
          where: {
            order: {
              storeId,
              branchId: branch.id,
            },
            processedAt: { gte: sinceDate },
          },
        }),
      ]);

      if (totalOrders === 0) continue;

      const ratio = (voidedOrders + refundCount) / totalOrders;

      let severity: AlertSeverity | null = null;
      if (ratio > thresholds.criticalThreshold) {
        severity = AlertSeverity.CRITICAL;
      } else if (ratio > thresholds.warningThreshold) {
        severity = AlertSeverity.WARNING;
      }

      if (severity) {
        await this.alertsService.createAlertIfNotDuplicate({
          storeId,
          type: AlertType.EXCESSIVE_VOID_REFUND,
          severity,
          title: `High void/refund rate at ${branch.name}`,
          message: `Branch "${branch.name}" has a ${(ratio * 100).toFixed(1)}% void/refund rate in the last ${thresholds.windowHours} hours (${voidedOrders} voided, ${refundCount} refunds out of ${totalOrders} orders).`,
          metadata: {
            branchId: branch.id,
            branchName: branch.name,
            ratio: Math.round(ratio * 1000) / 1000,
            voidedOrders,
            refundCount,
            totalOrders,
          },
        });
      }
    }
  }

  private async evaluateInventoryAnomaly(storeId: string) {
    const config = await this.alertConfigService.getConfig(
      storeId,
      AlertType.INVENTORY_ANOMALY,
    );
    if (!config.enabled) return;

    const thresholds = config.thresholds as {
      largeAdjustmentThreshold: number;
    };

    // Negative stock
    const negativeStock = await this.prisma.branchInventory.findMany({
      where: {
        storeId,
        isTracked: true,
        currentQuantity: { lt: 0 },
      },
      include: {
        item: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    for (const inv of negativeStock) {
      await this.alertsService.createAlertIfNotDuplicate({
        storeId,
        type: AlertType.INVENTORY_ANOMALY,
        severity: AlertSeverity.CRITICAL,
        title: `Negative stock: ${inv.item.name}`,
        message: `Item "${inv.item.name}" at branch "${inv.branch.name}" has negative stock (${inv.currentQuantity}).`,
        metadata: {
          subType: 'NEGATIVE_STOCK',
          itemId: inv.item.id,
          branchId: inv.branch.id,
          itemName: inv.item.name,
          branchName: inv.branch.name,
          quantity: inv.currentQuantity,
        },
      });
    }

    // Low stock
    const lowStock = await this.prisma.branchInventory.findMany({
      where: {
        storeId,
        isTracked: true,
        lowStockThreshold: { not: null },
        currentQuantity: { gte: 0 },
      },
      include: {
        item: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    for (const inv of lowStock) {
      if (
        inv.lowStockThreshold !== null &&
        inv.currentQuantity <= inv.lowStockThreshold
      ) {
        await this.alertsService.createAlertIfNotDuplicate({
          storeId,
          type: AlertType.INVENTORY_ANOMALY,
          severity: AlertSeverity.WARNING,
          title: `Low stock: ${inv.item.name}`,
          message: `Item "${inv.item.name}" at branch "${inv.branch.name}" is at low stock (${inv.currentQuantity}, threshold: ${inv.lowStockThreshold}).`,
          metadata: {
            subType: 'LOW_STOCK',
            itemId: inv.item.id,
            branchId: inv.branch.id,
            itemName: inv.item.name,
            branchName: inv.branch.name,
            quantity: inv.currentQuantity,
          },
        });
      }
    }

    // Large adjustments in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const largeAdjustments = await this.prisma.inventoryMovement.findMany({
      where: {
        storeId,
        movementType: { in: ['ADJUSTED_UP', 'ADJUSTED_DOWN', 'WASTED'] },
        quantity: { gte: thresholds.largeAdjustmentThreshold },
        createdAt: { gte: fiveMinAgo },
      },
      include: {
        branchInventory: {
          include: {
            item: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    for (const movement of largeAdjustments) {
      const item = movement.branchInventory.item;
      const branch = movement.branchInventory.branch;

      await this.alertsService.createAlertIfNotDuplicate({
        storeId,
        type: AlertType.INVENTORY_ANOMALY,
        severity: AlertSeverity.WARNING,
        title: `Large ${movement.movementType.toLowerCase()} adjustment: ${item.name}`,
        message: `A ${movement.movementType.toLowerCase()} of ${movement.quantity} units for "${item.name}" at branch "${branch.name}" was recorded.`,
        metadata: {
          subType: 'LARGE_ADJUSTMENT',
          itemId: item.id,
          branchId: branch.id,
          itemName: item.name,
          branchName: branch.name,
          quantity: movement.quantity,
        },
      });
    }
  }

  private async evaluatePosSyncFailure(storeId: string) {
    const config = await this.alertConfigService.getConfig(
      storeId,
      AlertType.POS_SYNC_FAILURE,
    );
    if (!config.enabled) return;

    const thresholds = config.thresholds as {
      syncMissingMinutes: number;
      heartbeatMissingMinutes: number;
      consecutiveFailures: number;
    };

    const devices = await this.prisma.posDevice.findMany({
      where: {
        isRegistered: true,
        deletedAt: null,
        branch: { storeId, deletedAt: null },
      },
      include: {
        branch: { select: { id: true, name: true, storeId: true } },
      },
    });

    const now = new Date();

    for (const device of devices) {
      const deviceName = device.name || device.deviceIdentifier || device.id;

      // Heartbeat missing
      if (
        device.status === 'ONLINE' &&
        device.lastHeartbeatAt &&
        now.getTime() - device.lastHeartbeatAt.getTime() >
          thresholds.heartbeatMissingMinutes * 60 * 1000
      ) {
        await this.alertsService.createAlertIfNotDuplicate({
          storeId,
          type: AlertType.POS_SYNC_FAILURE,
          severity: AlertSeverity.WARNING,
          title: `Heartbeat missing: ${deviceName}`,
          message: `Device "${deviceName}" at branch "${device.branch.name}" is marked ONLINE but has not sent a heartbeat in ${thresholds.heartbeatMissingMinutes} minutes.`,
          metadata: {
            subType: 'HEARTBEAT_MISSING',
            posDeviceId: device.id,
            deviceName,
            branchName: device.branch.name,
          },
        });
      }

      // Sync overdue
      if (
        device.status === 'ONLINE' &&
        device.lastSyncAt &&
        now.getTime() - device.lastSyncAt.getTime() >
          thresholds.syncMissingMinutes * 60 * 1000
      ) {
        await this.alertsService.createAlertIfNotDuplicate({
          storeId,
          type: AlertType.POS_SYNC_FAILURE,
          severity: AlertSeverity.WARNING,
          title: `Sync overdue: ${deviceName}`,
          message: `Device "${deviceName}" at branch "${device.branch.name}" is marked ONLINE but has not synced in ${thresholds.syncMissingMinutes} minutes.`,
          metadata: {
            subType: 'SYNC_OVERDUE',
            posDeviceId: device.id,
            deviceName,
            branchName: device.branch.name,
          },
        });
      }

      // Consecutive sync failures
      const recentSyncLogs = await this.prisma.syncLog.findMany({
        where: {
          posDeviceId: device.id,
          syncType: { not: 'HEARTBEAT' },
        },
        orderBy: { createdAt: 'desc' },
        take: thresholds.consecutiveFailures,
        select: { status: true },
      });

      if (
        recentSyncLogs.length >= thresholds.consecutiveFailures &&
        recentSyncLogs.every((log) => log.status === 'FAILED')
      ) {
        await this.alertsService.createAlertIfNotDuplicate({
          storeId,
          type: AlertType.POS_SYNC_FAILURE,
          severity: AlertSeverity.CRITICAL,
          title: `Consecutive sync failures: ${deviceName}`,
          message: `Device "${deviceName}" at branch "${device.branch.name}" has ${thresholds.consecutiveFailures} consecutive failed sync attempts.`,
          metadata: {
            subType: 'CONSECUTIVE_FAILURES',
            posDeviceId: device.id,
            deviceName,
            branchName: device.branch.name,
          },
        });
      }
    }
  }
}

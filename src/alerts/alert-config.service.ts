import { Injectable } from '@nestjs/common';
import { AlertType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAlertConfigDto } from './dto';

export interface AlertThresholds {
  [key: string]: unknown;
}

export interface ResolvedAlertConfig {
  alertType: AlertType;
  enabled: boolean;
  thresholds: AlertThresholds;
  cooldownMinutes: number;
}

const DEFAULT_CONFIGS: Record<AlertType, { thresholds: AlertThresholds; cooldownMinutes: number }> = {
  ZERO_SALES_BRANCH: {
    thresholds: {
      noSalesHours: 4,
      businessStartHour: 8,
      businessEndHour: 22,
    },
    cooldownMinutes: 60,
  },
  EXCESSIVE_VOID_REFUND: {
    thresholds: {
      windowHours: 4,
      warningThreshold: 0.15,
      criticalThreshold: 0.30,
    },
    cooldownMinutes: 60,
  },
  INVENTORY_ANOMALY: {
    thresholds: {
      largeAdjustmentThreshold: 50,
    },
    cooldownMinutes: 120,
  },
  POS_SYNC_FAILURE: {
    thresholds: {
      syncMissingMinutes: 30,
      heartbeatMissingMinutes: 15,
      consecutiveFailures: 5,
    },
    cooldownMinutes: 30,
  },
};

@Injectable()
export class AlertConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(storeId: string, alertType: AlertType): Promise<ResolvedAlertConfig> {
    const dbConfig = await this.prisma.alertConfig.findUnique({
      where: { storeId_alertType: { storeId, alertType } },
    });

    const defaults = DEFAULT_CONFIGS[alertType];

    if (!dbConfig) {
      return {
        alertType,
        enabled: true,
        thresholds: defaults.thresholds,
        cooldownMinutes: defaults.cooldownMinutes,
      };
    }

    return {
      alertType,
      enabled: dbConfig.enabled,
      thresholds: (dbConfig.thresholds as AlertThresholds) || defaults.thresholds,
      cooldownMinutes: dbConfig.cooldownMinutes,
    };
  }

  async getAllConfigs(storeId: string): Promise<ResolvedAlertConfig[]> {
    const alertTypes = Object.values(AlertType);
    const dbConfigs = await this.prisma.alertConfig.findMany({
      where: { storeId },
    });

    const dbConfigMap = new Map(dbConfigs.map((c) => [c.alertType, c]));

    return alertTypes.map((alertType) => {
      const dbConfig = dbConfigMap.get(alertType);
      const defaults = DEFAULT_CONFIGS[alertType];

      if (!dbConfig) {
        return {
          alertType,
          enabled: true,
          thresholds: defaults.thresholds,
          cooldownMinutes: defaults.cooldownMinutes,
        };
      }

      return {
        alertType,
        enabled: dbConfig.enabled,
        thresholds: (dbConfig.thresholds as AlertThresholds) || defaults.thresholds,
        cooldownMinutes: dbConfig.cooldownMinutes,
      };
    });
  }

  async upsertConfig(
    storeId: string,
    alertType: AlertType,
    dto: UpdateAlertConfigDto,
  ) {
    const data: Record<string, unknown> = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.thresholds !== undefined) data.thresholds = dto.thresholds;
    if (dto.cooldownMinutes !== undefined) data.cooldownMinutes = dto.cooldownMinutes;

    return this.prisma.alertConfig.upsert({
      where: { storeId_alertType: { storeId, alertType } },
      update: data,
      create: {
        storeId,
        alertType,
        enabled: dto.enabled ?? true,
        thresholds: (dto.thresholds ?? DEFAULT_CONFIGS[alertType].thresholds) as Prisma.InputJsonValue,
        cooldownMinutes: dto.cooldownMinutes ?? DEFAULT_CONFIGS[alertType].cooldownMinutes,
      },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertType, AlertSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertConfigService } from './alert-config.service';
import { AlertQueryDto, BulkDismissDto } from './dto';

export interface CreateAlertData {
  storeId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  deduplicateKey?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private alertConfigService: AlertConfigService,
  ) {}

  async getAlerts(storeId: string, dto: AlertQueryDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const status = dto.status || 'active';

    const where: Prisma.AlertWhereInput = { storeId };

    if (dto.type) where.type = dto.type;
    if (dto.severity) where.severity = dto.severity;

    switch (status) {
      case 'active':
        where.dismissedAt = null;
        break;
      case 'acknowledged':
        where.acknowledgedAt = { not: null };
        where.dismissedAt = null;
        break;
      case 'dismissed':
        where.dismissedAt = { not: null };
        break;
      case 'all':
        break;
    }

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getActiveAlertCount(storeId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { storeId, dismissedAt: null },
      select: { severity: true },
    });

    const bySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 };
    for (const alert of alerts) {
      bySeverity[alert.severity]++;
    }

    return {
      count: alerts.length,
      bySeverity,
    };
  }

  async acknowledgeAlert(id: string, userId: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.alert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });
  }

  async dismissAlert(id: string, userId: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.alert.update({
      where: { id },
      data: {
        dismissedAt: new Date(),
        dismissedBy: userId,
      },
    });
  }

  async bulkDismiss(dto: BulkDismissDto, userId: string) {
    const result = await this.prisma.alert.updateMany({
      where: { id: { in: dto.alertIds } },
      data: {
        dismissedAt: new Date(),
        dismissedBy: userId,
      },
    });

    return { dismissed: result.count };
  }

  async createAlertIfNotDuplicate(data: CreateAlertData) {
    const config = await this.alertConfigService.getConfig(data.storeId, data.type);

    if (!config.enabled) return null;

    const cooldownDate = new Date(Date.now() - config.cooldownMinutes * 60 * 1000);

    // Build duplicate check query
    const duplicateWhere: Prisma.AlertWhereInput = {
      storeId: data.storeId,
      type: data.type,
      dismissedAt: null,
      createdAt: { gte: cooldownDate },
    };

    // For branch/device-specific alerts, also check metadata
    if (data.metadata?.branchId) {
      duplicateWhere.metadata = {
        path: '$.branchId',
        equals: data.metadata.branchId as string,
      };
    } else if (data.metadata?.posDeviceId) {
      duplicateWhere.metadata = {
        path: '$.posDeviceId',
        equals: data.metadata.posDeviceId as string,
      };
    }

    const existing = await this.prisma.alert.findFirst({
      where: duplicateWhere,
    });

    if (existing) return null;

    return this.prisma.alert.create({
      data: {
        storeId: data.storeId,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }
}

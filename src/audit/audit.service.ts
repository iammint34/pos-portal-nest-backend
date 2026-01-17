import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

export interface AuditLogData {
  userId?: string;
  storeId?: string;
  action: keyof typeof AuditAction;
  entityType: string;
  entityId?: string;
  oldValue?: object;
  newValue?: object;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          storeId: data.storeId,
          action: data.action as AuditAction,
          entityType: data.entityType,
          entityId: data.entityId,
          oldValue: data.oldValue as Prisma.InputJsonValue,
          newValue: data.newValue as Prisma.InputJsonValue,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break main operations
      console.error('Audit log error:', error);
    }
  }

  async getAuditLogs(params: {
    storeId?: string;
    userId?: string;
    entityType?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      storeId,
      userId,
      entityType,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params;

    const where = {
      ...(storeId && { storeId }),
      ...(userId && { userId }),
      ...(entityType && { entityType }),
      ...(action && { action }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

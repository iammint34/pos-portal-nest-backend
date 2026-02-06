import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NotificationPreference,
  CreatePreferenceDto,
  UpdatePreferenceDto,
} from './notifications.types';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get or create notification preferences for a user
   */
  async getOrCreate(
    storeId: string,
    userId: string,
  ): Promise<NotificationPreference> {
    let preference = await (
      this.prisma as any
    ).notificationPreference.findUnique({
      where: {
        storeId_userId: { storeId, userId },
      },
    });

    if (!preference) {
      // Create default preferences
      preference = await (this.prisma as any).notificationPreference.create({
        data: {
          storeId,
          userId,
          emailEnabled: true,
          smsEnabled: false,
          dailyDigest: true,
          weeklySummary: false,
          alertsEnabled: true,
        },
      });
      this.logger.log(
        `Created default preferences for user ${userId} in store ${storeId}`,
      );
    }

    return preference;
  }

  /**
   * Get notification preferences for a user
   */
  async get(
    storeId: string,
    userId: string,
  ): Promise<NotificationPreference | null> {
    return (this.prisma as any).notificationPreference.findUnique({
      where: {
        storeId_userId: { storeId, userId },
      },
    });
  }

  /**
   * Create notification preferences
   */
  async create(dto: CreatePreferenceDto): Promise<NotificationPreference> {
    return (this.prisma as any).notificationPreference.create({
      data: {
        storeId: dto.storeId,
        userId: dto.userId,
        emailEnabled: dto.emailEnabled ?? true,
        smsEnabled: dto.smsEnabled ?? false,
        dailyDigest: dto.dailyDigest ?? true,
        weeklySummary: dto.weeklySummary ?? false,
        alertsEnabled: dto.alertsEnabled ?? true,
        email: dto.email || null,
        phone: dto.phone || null,
      },
    });
  }

  /**
   * Update notification preferences
   */
  async update(
    storeId: string,
    userId: string,
    dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    const existing = await this.get(storeId, userId);

    if (!existing) {
      throw new NotFoundException('Notification preferences not found');
    }

    return (this.prisma as any).notificationPreference.update({
      where: {
        storeId_userId: { storeId, userId },
      },
      data: dto,
    });
  }

  /**
   * Delete notification preferences
   */
  async delete(storeId: string, userId: string): Promise<void> {
    await (this.prisma as any).notificationPreference.delete({
      where: {
        storeId_userId: { storeId, userId },
      },
    });
  }

  /**
   * Get all users with specific preference settings
   */
  async findByPreferences(
    storeId: string,
    filters: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      dailyDigest?: boolean;
      weeklySummary?: boolean;
      alertsEnabled?: boolean;
    },
  ): Promise<NotificationPreference[]> {
    const where: any = { storeId };

    if (filters.emailEnabled !== undefined)
      where.emailEnabled = filters.emailEnabled;
    if (filters.smsEnabled !== undefined) where.smsEnabled = filters.smsEnabled;
    if (filters.dailyDigest !== undefined)
      where.dailyDigest = filters.dailyDigest;
    if (filters.weeklySummary !== undefined)
      where.weeklySummary = filters.weeklySummary;
    if (filters.alertsEnabled !== undefined)
      where.alertsEnabled = filters.alertsEnabled;

    return (this.prisma as any).notificationPreference.findMany({
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
    });
  }

  /**
   * Get all preferences for a store
   */
  async getAllForStore(storeId: string): Promise<NotificationPreference[]> {
    return (this.prisma as any).notificationPreference.findMany({
      where: { storeId },
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
    });
  }

  /**
   * Bulk update preferences for testing notifications
   */
  async enableAllForUser(userId: string): Promise<number> {
    const result = await (this.prisma as any).notificationPreference.updateMany(
      {
        where: { userId },
        data: {
          emailEnabled: true,
          smsEnabled: true,
          dailyDigest: true,
          weeklySummary: true,
          alertsEnabled: true,
        },
      },
    );
    return result.count;
  }
}

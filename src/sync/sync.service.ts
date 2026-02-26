import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PosService } from '../pos/pos.service';
import {
  SyncRequestDto,
  HeartbeatDto,
  SyncUserDto,
  SyncCategoryDto,
  SyncItemDto,
  DeletedRecordDto,
} from './dto';
import { SyncType, SyncStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private posService: PosService,
    private auditService: AuditService,
  ) {}

  async sync(syncRequestDto: SyncRequestDto) {
    const startedAt = new Date();

    // Validate device token
    const isValid = await this.posService.validateDeviceToken(
      syncRequestDto.deviceIdentifier,
      syncRequestDto.deviceToken,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid device credentials');
    }

    // Get POS device info
    const posDevice = await this.prisma.posDevice.findFirst({
      where: {
        deviceIdentifier: syncRequestDto.deviceIdentifier,
        deletedAt: null,
      },
      include: {
        branch: {
          include: {
            store: true,
          },
        },
      },
    });

    if (!posDevice) {
      throw new NotFoundException('POS device not found');
    }

    const storeId = posDevice.branch.storeId;
    const branchId = posDevice.branchId;
    const syncType = syncRequestDto.syncType || SyncType.FULL;
    const lastSyncAt = syncRequestDto.lastSyncAt
      ? new Date(syncRequestDto.lastSyncAt)
      : undefined;

    let syncLog;
    try {
      // Create sync log entry
      syncLog = await this.prisma.syncLog.create({
        data: {
          posDeviceId: posDevice.id,
          syncType,
          status: SyncStatus.SUCCESS,
          startedAt,
        },
      });

      // Get comprehensive sync data
      const syncData = await this.getComprehensiveSyncData(
        storeId,
        branchId,
        syncType,
        syncRequestDto.lastVersion,
        lastSyncAt,
      );

      // Calculate item count
      const itemCount =
        (syncData.users?.length || 0) +
        (syncData.categories?.length || 0) +
        (syncData.items?.length || 0);

      // Update sync log with results
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: SyncStatus.SUCCESS,
          version: syncData.version,
          itemCount,
          completedAt: new Date(),
        },
      });

      // Update device sync timestamp
      await this.prisma.posDevice.update({
        where: { id: posDevice.id },
        data: {
          lastSyncAt: new Date(),
          status: 'ONLINE',
          lastHeartbeatAt: new Date(),
        },
      });

      // Update branch sync timestamp
      await this.prisma.branch.update({
        where: { id: branchId },
        data: {
          lastSyncAt: new Date(),
          status: 'ONLINE',
        },
      });

      await this.auditService.log({
        storeId,
        action: 'SYNC',
        entityType: 'PosDevice',
        entityId: posDevice.id,
        newValue: { syncType, itemCount },
      });

      // Get BIR configuration from store, branch, and device
      const birConfig = {
        // Store-level BIR info
        registeredName:
          posDevice.branch.store.registeredName || posDevice.branch.store.name,
        registeredAddress:
          posDevice.branch.store.registeredAddress ||
          posDevice.branch.store.address ||
          '',
        vatTin: posDevice.branch.store.vatTin || '',
        isVatRegistered: posDevice.branch.store.isVatRegistered ?? true,
        // Branch-level PTU info
        ptuNo: posDevice.branch.ptuNo || '',
        ptuDateIssued:
          posDevice.branch.ptuDateIssued?.toISOString().split('T')[0] || '',
        ptuValidUntil:
          posDevice.branch.ptuValidUntil?.toISOString().split('T')[0] || '',
        accreditationNo: posDevice.branch.accreditationNo || '',
        // Device-level MIN info
        min: posDevice.min || '',
        serialNumber: posDevice.serialNumber || '',
        permitNumber: posDevice.permitNumber || '',
      };

      return {
        success: true,
        ...syncData,
        storeId,
        branchId,
        storeName: posDevice.branch.store.name,
        branchName: posDevice.branch.name,
        birConfig,
        syncedAt: new Date(),
      };
    } catch (error) {
      // Log sync failure
      if (syncLog) {
        await this.prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: SyncStatus.FAILED,
            errorMsg: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          },
        });
      }
      throw error;
    }
  }

  async heartbeat(heartbeatDto: HeartbeatDto) {
    // Validate device token
    const isValid = await this.posService.validateDeviceToken(
      heartbeatDto.deviceIdentifier,
      heartbeatDto.deviceToken,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid device credentials');
    }

    const posDevice = await this.prisma.posDevice.findFirst({
      where: {
        deviceIdentifier: heartbeatDto.deviceIdentifier,
        deletedAt: null,
      },
    });

    if (!posDevice) {
      throw new NotFoundException('POS device not found');
    }

    // Update heartbeat
    const updateData: Record<string, unknown> = {
      lastHeartbeatAt: new Date(),
      status: 'ONLINE',
    };

    if (heartbeatDto.appVersion) {
      updateData.appVersion = heartbeatDto.appVersion;
    }

    await this.prisma.posDevice.update({
      where: { id: posDevice.id },
      data: updateData,
    });

    // Log heartbeat
    await this.prisma.syncLog.create({
      data: {
        posDeviceId: posDevice.id,
        syncType: SyncType.HEARTBEAT,
        status: SyncStatus.SUCCESS,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      timestamp: new Date(),
    };
  }

  private async getComprehensiveSyncData(
    storeId: string,
    branchId: string,
    syncType: SyncType,
    lastVersion?: number,
    lastSyncAt?: Date,
  ) {
    // Get the highest item version as the sync version
    const maxVersionResult = await this.prisma.item.aggregate({
      where: { storeId, deletedAt: null },
      _max: { version: true },
    });
    const currentVersion = maxVersionResult._max.version || 1;

    let users: SyncUserDto[] | null = null;
    let categories: SyncCategoryDto[] | null = null;
    let items: SyncItemDto[] | null = null;
    let inventory: Array<{
      id: string;
      itemId: string;
      currentQuantity: number;
      lowStockThreshold: number | null;
      isTracked: boolean;
    }> | null = null;
    let deletedUsers: DeletedRecordDto[] | null = null;
    let deletedCategories: DeletedRecordDto[] | null = null;
    let deletedItems: DeletedRecordDto[] | null = null;

    const isFullSync = syncType === SyncType.FULL;
    const isIncrementalSync = lastSyncAt !== undefined;

    // Get users for this store (all store users can access any branch)
    if (isFullSync) {
      const storeUsers = await this.prisma.storeUser.findMany({
        where: {
          storeId,
          isActive: true,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              passwordHash: true,
              firstName: true,
              lastName: true,
            },
          },
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: {
                    select: { code: true },
                  },
                },
              },
            },
          },
        },
      });

      users = storeUsers.map((su) => {
        // Determine role based on permissions
        const hasManagerPermissions = su.role?.rolePermissions?.some(
          (rp) =>
            rp.permission.code.includes('void') ||
            rp.permission.code.includes('refund') ||
            rp.permission.code.includes('discount'),
        );

        // Collect POS-specific permission codes for fine-grained feature gating
        const permissionCodes =
          su.role?.rolePermissions
            ?.map((rp) => rp.permission.code)
            .filter((code) => code.startsWith('pos_function.')) ?? [];

        return {
          id: su.user.id,
          email: su.user.email,
          passwordHash: su.user.passwordHash,
          firstName: su.user.firstName,
          lastName: su.user.lastName,
          role: hasManagerPermissions ? 'MANAGER' : 'STAFF',
          pin: undefined, // PIN not stored in Portal - set on POS device
          isActive: su.isActive,
          permissions: permissionCodes.length > 0 ? permissionCodes : undefined,
        } as SyncUserDto;
      });

      // Get deleted/deactivated users if incremental sync
      if (isIncrementalSync) {
        const deletedStoreUsers = await this.prisma.storeUser.findMany({
          where: {
            storeId,
            OR: [
              { deletedAt: { gte: lastSyncAt } },
              { isActive: false, updatedAt: { gte: lastSyncAt } },
            ],
          },
          select: {
            userId: true,
            deletedAt: true,
            updatedAt: true,
          },
        });

        deletedUsers = deletedStoreUsers.map((su) => ({
          id: su.userId,
          deletedAt: su.deletedAt || su.updatedAt,
        }));
      }
    }

    // Get categories
    if (isFullSync || syncType === SyncType.CATEGORIES) {
      const categoryQuery: Record<string, unknown> = {
        storeId,
        deletedAt: null,
        isActive: true,
      };

      // For incremental sync, get updated categories
      if (isIncrementalSync) {
        categoryQuery.updatedAt = { gte: lastSyncAt };
      }

      const fetchedCategories = await this.prisma.category.findMany({
        where: categoryQuery,
        select: {
          id: true,
          name: true,
          description: true,
          sortOrder: true,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      categories = fetchedCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || undefined,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      }));

      // Get deleted categories if incremental sync
      if (isIncrementalSync) {
        const deletedCats = await this.prisma.category.findMany({
          where: {
            storeId,
            OR: [
              { deletedAt: { gte: lastSyncAt } },
              { isActive: false, updatedAt: { gte: lastSyncAt } },
            ],
          },
          select: {
            id: true,
            deletedAt: true,
            updatedAt: true,
          },
        });

        deletedCategories = deletedCats.map((c) => ({
          id: c.id,
          deletedAt: c.deletedAt || c.updatedAt,
        }));
      }
    }

    // Get ALL items for the store (all branches should have access to all store items)
    if (
      isFullSync ||
      syncType === SyncType.ITEMS ||
      syncType === SyncType.CONFIG
    ) {
      const itemsQuery: Record<string, unknown> = {
        storeId,
        deletedAt: null,
        // Don't filter by isActive - sync all items, POS will handle display based on isActive/isAvailable
      };

      // Version-based incremental sync
      if (lastVersion) {
        itemsQuery.version = { gt: lastVersion };
      }

      // Time-based incremental sync
      if (isIncrementalSync && !lastVersion) {
        itemsQuery.updatedAt = { gte: lastSyncAt };
      }

      const fetchedItems = await this.prisma.item.findMany({
        where: itemsQuery,
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          imageUrl: true,
          price: true,
          categoryId: true,
          isActive: true,
          version: true,
          itemBranches: {
            where: { branchId },
            select: {
              isAvailable: true,
              customPrice: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Transform items - use branch-specific price/availability if exists
      items = fetchedItems.map((item) => {
        const branchData = item.itemBranches[0];
        return {
          id: item.id,
          sku: item.sku || undefined,
          name: item.name,
          description: item.description || undefined,
          imageUrl: item.imageUrl || undefined,
          price: Number(branchData?.customPrice || item.price),
          categoryId: item.categoryId || undefined,
          isActive: item.isActive,
          isAvailable: branchData?.isAvailable ?? item.isActive, // Default to isActive if no branch override
          version: item.version,
        };
      });

      // Get deleted items if incremental sync
      if (isIncrementalSync) {
        const deletedItms = await this.prisma.item.findMany({
          where: {
            storeId,
            OR: [
              { deletedAt: { gte: lastSyncAt } },
              { isActive: false, updatedAt: { gte: lastSyncAt } },
            ],
          },
          select: {
            id: true,
            deletedAt: true,
            updatedAt: true,
          },
        });

        deletedItems = deletedItms.map((i) => ({
          id: i.id,
          deletedAt: i.deletedAt || i.updatedAt,
        }));
      }

      // Get inventory for this branch
      const branchInventory = await this.prisma.branchInventory.findMany({
        where: { branchId, storeId },
        select: {
          id: true,
          itemId: true,
          currentQuantity: true,
          lowStockThreshold: true,
          isTracked: true,
        },
      });
      inventory = branchInventory;
    }

    return {
      version: currentVersion,
      users,
      categories,
      items,
      inventory: inventory?.length ? inventory : undefined,
      deletedUsers: deletedUsers?.length ? deletedUsers : undefined,
      deletedCategories: deletedCategories?.length
        ? deletedCategories
        : undefined,
      deletedItems: deletedItems?.length ? deletedItems : undefined,
    };
  }

  async getSyncLogs(
    storeId?: string,
    options: {
      posDeviceId?: string;
      syncType?: SyncType;
      status?: SyncStatus;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { posDeviceId, syncType, status, page = 1, limit = 20 } = options;

    const where = {
      posDevice: {
        deletedAt: null,
        ...(storeId && { branch: { storeId } }),
      },
      ...(posDeviceId && { posDeviceId }),
      ...(syncType && { syncType }),
      ...(status && { status }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.syncLog.findMany({
        where,
        include: {
          posDevice: {
            select: {
              id: true,
              name: true,
              deviceIdentifier: true,
              branch: {
                select: {
                  id: true,
                  name: true,
                  store: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.syncLog.count({ where }),
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

  async getSyncStats(storeId?: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const branchFilter = storeId ? { posDevice: { branch: { storeId } } } : {};

    const [totalSyncs24h, successfulSyncs24h, failedSyncs24h, syncsLastHour] =
      await Promise.all([
        this.prisma.syncLog.count({
          where: {
            ...branchFilter,
            createdAt: { gte: oneDayAgo },
            syncType: { not: SyncType.HEARTBEAT },
          },
        }),
        this.prisma.syncLog.count({
          where: {
            ...branchFilter,
            createdAt: { gte: oneDayAgo },
            status: SyncStatus.SUCCESS,
            syncType: { not: SyncType.HEARTBEAT },
          },
        }),
        this.prisma.syncLog.count({
          where: {
            ...branchFilter,
            createdAt: { gte: oneDayAgo },
            status: SyncStatus.FAILED,
            syncType: { not: SyncType.HEARTBEAT },
          },
        }),
        this.prisma.syncLog.count({
          where: {
            ...branchFilter,
            createdAt: { gte: oneHourAgo },
            syncType: { not: SyncType.HEARTBEAT },
          },
        }),
      ]);

    return {
      last24Hours: {
        total: totalSyncs24h,
        successful: successfulSyncs24h,
        failed: failedSyncs24h,
        successRate:
          totalSyncs24h > 0
            ? ((successfulSyncs24h / totalSyncs24h) * 100).toFixed(2)
            : '100',
      },
      lastHour: syncsLastHour,
    };
  }
}

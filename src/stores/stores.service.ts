import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto, UpdateStoreDto } from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StoresService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createStoreDto: CreateStoreDto, createdBy?: string) {
    const store = await this.prisma.store.create({
      data: {
        name: createStoreDto.name,
        type: createStoreDto.type,
        address: createStoreDto.address,
        phone: createStoreDto.phone,
        email: createStoreDto.email,
      },
    });

    // Create default Administrator role for the store
    const adminRole = await this.prisma.role.create({
      data: {
        name: 'Administrator',
        description: 'Full access to all store operations',
        storeId: store.id,
        isSystem: true,
      },
    });

    // Assign all permissions to Administrator role
    const allPermissions = await this.prisma.permission.findMany();
    if (allPermissions.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: allPermissions.map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
      });
    }

    await this.auditService.log({
      userId: createdBy,
      storeId: store.id,
      action: 'CREATE',
      entityType: 'Store',
      entityId: store.id,
      newValue: createStoreDto,
    });

    return store;
  }

  async findAll(page = 1, limit = 20) {
    const where = { deletedAt: null };

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        include: {
          _count: {
            select: {
              branches: { where: { deletedAt: null } },
              storeUsers: { where: { deletedAt: null } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      data: stores,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
      include: {
        branches: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            lastSyncAt: true,
          },
        },
        _count: {
          select: {
            storeUsers: { where: { deletedAt: null } },
            items: { where: { deletedAt: null } },
            categories: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async findByUser(userId: string) {
    return this.prisma.store.findMany({
      where: {
        deletedAt: null,
        storeUsers: {
          some: {
            userId,
            deletedAt: null,
            isActive: true,
          },
        },
      },
      include: {
        storeUsers: {
          where: { userId, deletedAt: null },
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async update(
    id: string,
    updateStoreDto: UpdateStoreDto,
    updatedBy?: string,
  ) {
    const store = await this.findOne(id);

    const updatedStore = await this.prisma.store.update({
      where: { id },
      data: updateStoreDto,
    });

    await this.auditService.log({
      userId: updatedBy,
      storeId: id,
      action: 'UPDATE',
      entityType: 'Store',
      entityId: id,
      oldValue: { name: store.name, status: store.status },
      newValue: updateStoreDto,
    });

    return updatedStore;
  }

  async remove(id: string, deletedBy?: string) {
    await this.findOne(id);

    await this.prisma.store.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId: id,
      action: 'DELETE',
      entityType: 'Store',
      entityId: id,
    });

    return { message: 'Store deleted successfully' };
  }

  async getStoreStats(storeId: string) {
    const [
      branchCount,
      userCount,
      itemCount,
      categoryCount,
      posDeviceCount,
      activePosCount,
    ] = await Promise.all([
      this.prisma.branch.count({
        where: { storeId, deletedAt: null },
      }),
      this.prisma.storeUser.count({
        where: { storeId, deletedAt: null, isActive: true },
      }),
      this.prisma.item.count({
        where: { storeId, deletedAt: null, isActive: true },
      }),
      this.prisma.category.count({
        where: { storeId, deletedAt: null, isActive: true },
      }),
      this.prisma.posDevice.count({
        where: { branch: { storeId }, deletedAt: null },
      }),
      this.prisma.posDevice.count({
        where: { branch: { storeId }, deletedAt: null, status: 'ONLINE' },
      }),
    ]);

    return {
      branches: branchCount,
      users: userCount,
      items: itemCount,
      categories: categoryCount,
      posDevices: posDeviceCount,
      activePosDevices: activePosCount,
    };
  }
}

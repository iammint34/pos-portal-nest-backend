import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(
    storeId: string,
    createBranchDto: CreateBranchDto,
    createdBy?: string,
  ) {
    const branch = await this.prisma.branch.create({
      data: {
        storeId,
        name: createBranchDto.name,
        address: createBranchDto.address,
        phone: createBranchDto.phone,
      },
    });

    await this.auditService.log({
      userId: createdBy,
      storeId,
      action: 'CREATE',
      entityType: 'Branch',
      entityId: branch.id,
      newValue: createBranchDto,
    });

    return branch;
  }

  async findAll(storeId?: string, page = 1, limit = 20) {
    const where = {
      deletedAt: null,
      ...(storeId && { storeId }),
    };

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        include: {
          store: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              posDevices: { where: { deletedAt: null } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      data: branches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, storeId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(storeId && { storeId }),
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        posDevices: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            deviceIdentifier: true,
            status: true,
            lastHeartbeatAt: true,
          },
        },
        _count: {
          select: {
            itemBranches: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(
    id: string,
    updateBranchDto: UpdateBranchDto,
    storeId?: string,
    updatedBy?: string,
  ) {
    const branch = await this.findOne(id, storeId);

    const updatedBranch = await this.prisma.branch.update({
      where: { id },
      data: updateBranchDto,
    });

    await this.auditService.log({
      userId: updatedBy,
      storeId: branch.storeId,
      action: 'UPDATE',
      entityType: 'Branch',
      entityId: id,
      oldValue: { name: branch.name, status: branch.status },
      newValue: updateBranchDto,
    });

    return updatedBranch;
  }

  async remove(id: string, storeId?: string, deletedBy?: string) {
    const branch = await this.findOne(id, storeId);

    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId: branch.storeId,
      action: 'DELETE',
      entityType: 'Branch',
      entityId: id,
    });

    return { message: 'Branch deleted successfully' };
  }

  async updateSyncStatus(branchId: string) {
    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        lastSyncAt: new Date(),
        status: 'ONLINE',
      },
    });
  }

  async getBranchStats(branchId: string) {
    const [posDevices, onlineDevices, itemsAvailable] = await Promise.all([
      this.prisma.posDevice.count({
        where: { branchId, deletedAt: null },
      }),
      this.prisma.posDevice.count({
        where: { branchId, deletedAt: null, status: 'ONLINE' },
      }),
      this.prisma.itemBranch.count({
        where: { branchId, isAvailable: true },
      }),
    ]);

    return {
      posDevices,
      onlineDevices,
      itemsAvailable,
    };
  }
}

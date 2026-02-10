import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CloneType,
  CloneStatus,
  DEFAULT_BRANCH_CLONE_CONFIG,
  DEFAULT_STORE_CLONE_CONFIG,
} from './clone.constants';
import { CloneBranchDto } from './dto/clone-branch.dto';
import { CloneStoreDto } from './dto/clone-store.dto';
import {
  ClonePreviewDto,
  ClonePreviewResponse,
  ClonePreviewItem,
} from './dto/clone-preview.dto';
import type { CloneJob } from './clone.types';

@Injectable()
export class CloneService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ==================== Clone Jobs Management ====================

  /**
   * Get all clone jobs for a store
   */
  async getCloneJobs(storeId: string, limit = 20) {
    const jobs: CloneJob[] = await (this.prisma as any).cloneJob.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jobs;
  }

  /**
   * Get a specific clone job by ID
   */
  async getCloneJob(jobId: string) {
    const job: CloneJob | null = await (this.prisma as any).cloneJob.findUnique(
      {
        where: { id: jobId },
      },
    );

    if (!job) {
      throw new NotFoundException('Clone job not found');
    }

    return job;
  }

  // ==================== Preview ====================

  /**
   * Preview what will be cloned (dry run)
   */
  async previewClone(
    storeId: string,
    dto: ClonePreviewDto,
  ): Promise<ClonePreviewResponse> {
    if (dto.type === CloneType.BRANCH) {
      return this.previewBranchClone(storeId, dto.sourceId, dto.config);
    } else {
      return this.previewStoreClone(dto.sourceId, dto.config);
    }
  }

  private async previewBranchClone(
    storeId: string,
    sourceBranchId: string,
    config?: Record<string, boolean>,
  ): Promise<ClonePreviewResponse> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: sourceBranchId, storeId, deletedAt: null },
    });

    if (!branch) {
      throw new NotFoundException('Source branch not found');
    }

    const mergedConfig = { ...DEFAULT_BRANCH_CLONE_CONFIG, ...config };
    const elements: ClonePreviewItem[] = [];

    // Count item branches
    const itemBranchCount = await this.prisma.itemBranch.count({
      where: { branchId: sourceBranchId },
    });
    elements.push({
      element: 'Item Availability Settings',
      count: itemBranchCount,
      willClone: mergedConfig.itemBranches ?? true,
    });

    const totalItems = elements
      .filter((e) => e.willClone)
      .reduce((sum, e) => sum + e.count, 0);

    return {
      type: CloneType.BRANCH,
      sourceName: branch.name,
      sourceId: sourceBranchId,
      elements,
      totalItems,
      estimatedTime: totalItems < 100 ? 'Less than 1 minute' : '1-2 minutes',
    };
  }

  private async previewStoreClone(
    sourceStoreId: string,
    config?: Record<string, boolean>,
  ): Promise<ClonePreviewResponse> {
    const store = await this.prisma.store.findFirst({
      where: { id: sourceStoreId, deletedAt: null },
    });

    if (!store) {
      throw new NotFoundException('Source store not found');
    }

    const mergedConfig = { ...DEFAULT_STORE_CLONE_CONFIG, ...config };
    const elements: ClonePreviewItem[] = [];

    // Count categories
    const categoryCount = await this.prisma.category.count({
      where: { storeId: sourceStoreId, deletedAt: null },
    });
    elements.push({
      element: 'Categories',
      count: categoryCount,
      willClone: mergedConfig.categories ?? true,
    });

    // Count items
    const itemCount = await this.prisma.item.count({
      where: { storeId: sourceStoreId, deletedAt: null },
    });
    elements.push({
      element: 'Items',
      count: itemCount,
      willClone: mergedConfig.items ?? true,
    });

    // Count roles
    const roleCount = await this.prisma.role.count({
      where: { storeId: sourceStoreId, deletedAt: null, isSystem: false },
    });
    elements.push({
      element: 'Roles',
      count: roleCount,
      willClone: mergedConfig.roles ?? true,
    });

    // Count loss prevention thresholds
    try {
      const thresholdCount = await (
        this.prisma as any
      ).lossPreventionThreshold.count({
        where: { storeId: sourceStoreId },
      });
      elements.push({
        element: 'Loss Prevention Thresholds',
        count: thresholdCount,
        willClone: mergedConfig.lossPreventionThresholds ?? true,
      });
    } catch {
      // Table might not exist yet
    }

    const totalItems = elements
      .filter((e) => e.willClone)
      .reduce((sum, e) => sum + e.count, 0);

    return {
      type: CloneType.STORE,
      sourceName: store.name,
      sourceId: sourceStoreId,
      elements,
      totalItems,
      estimatedTime: totalItems < 100 ? 'Less than 1 minute' : '1-3 minutes',
    };
  }

  // ==================== Clone Branch ====================

  /**
   * Clone a branch with all its configurations
   */
  async cloneBranch(storeId: string, dto: CloneBranchDto, userId: string) {
    // Validate source branch exists and belongs to store
    const sourceBranch = await this.prisma.branch.findFirst({
      where: { id: dto.sourceBranchId, storeId, deletedAt: null },
    });

    if (!sourceBranch) {
      throw new NotFoundException('Source branch not found');
    }

    // Check for duplicate branch name
    const existingBranch = await this.prisma.branch.findFirst({
      where: { storeId, name: dto.name, deletedAt: null },
    });

    if (existingBranch) {
      throw new BadRequestException('A branch with this name already exists');
    }

    const config = { ...DEFAULT_BRANCH_CLONE_CONFIG, ...dto.config };

    // Create clone job record
    const job: CloneJob = await (this.prisma as any).cloneJob.create({
      data: {
        storeId,
        type: CloneType.BRANCH,
        sourceId: dto.sourceBranchId,
        targetName: dto.name,
        config,
        status: CloneStatus.IN_PROGRESS,
        createdBy: userId,
        startedAt: new Date(),
      },
    });

    try {
      // Execute clone in a transaction
      const newBranch = await this.prisma.$transaction(async (tx) => {
        // 1. Create the new branch
        const branch = await tx.branch.create({
          data: {
            storeId,
            name: dto.name,
            address: dto.address ?? sourceBranch.address,
            phone: dto.phone ?? sourceBranch.phone,
            status: 'OFFLINE',
            ptuNo: dto.ptuNo,
            accreditationNo: dto.accreditationNo,
          },
        });

        // 2. Clone item branches (availability settings)
        if (config.itemBranches) {
          const itemBranches = await tx.itemBranch.findMany({
            where: { branchId: dto.sourceBranchId },
          });

          if (itemBranches.length > 0) {
            await tx.itemBranch.createMany({
              data: itemBranches.map((ib) => ({
                itemId: ib.itemId,
                branchId: branch.id,
                isAvailable: ib.isAvailable,
                customPrice: ib.customPrice,
              })),
            });
          }
        }

        return branch;
      });

      // Update job status to completed
      await (this.prisma as any).cloneJob.update({
        where: { id: job.id },
        data: {
          status: CloneStatus.COMPLETED,
          targetId: newBranch.id,
          completedAt: new Date(),
        },
      });

      // Audit log
      await this.auditService.log({
        userId,
        storeId,
        action: 'CREATE',
        entityType: 'Branch',
        entityId: newBranch.id,
        newValue: { clonedFrom: dto.sourceBranchId, name: dto.name },
      });

      return {
        job: { ...job, status: CloneStatus.COMPLETED, targetId: newBranch.id },
        branch: newBranch,
      };
    } catch (error) {
      // Update job status to failed
      await (this.prisma as any).cloneJob.update({
        where: { id: job.id },
        data: {
          status: CloneStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      throw new InternalServerErrorException(
        `Failed to clone branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ==================== Clone Store ====================

  /**
   * Clone a store with all its configurations
   */
  async cloneStore(dto: CloneStoreDto, userId: string) {
    // Validate source store exists
    const sourceStore = await this.prisma.store.findFirst({
      where: { id: dto.sourceStoreId, deletedAt: null },
    });

    if (!sourceStore) {
      throw new NotFoundException('Source store not found');
    }

    const config = { ...DEFAULT_STORE_CLONE_CONFIG, ...dto.config };

    // Create clone job record
    const job: CloneJob = await (this.prisma as any).cloneJob.create({
      data: {
        storeId: dto.sourceStoreId, // Reference to source store
        type: CloneType.STORE,
        sourceId: dto.sourceStoreId,
        targetName: dto.name,
        config,
        status: CloneStatus.IN_PROGRESS,
        createdBy: userId,
        startedAt: new Date(),
      },
    });

    try {
      // Execute clone in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create the new store
        const newStore = await tx.store.create({
          data: {
            name: dto.name,
            type: (dto.type as any) ?? sourceStore.type,
            status: 'ACTIVE',
            address: dto.address,
            phone: dto.phone,
            email: dto.email,
            registeredName: dto.registeredName,
            registeredAddress: dto.registeredAddress,
            vatTin: dto.vatTin,
            isVatRegistered: dto.isVatRegistered ?? true,
          },
        });

        // Map old IDs to new IDs for relationships
        const categoryIdMap = new Map<string, string>();
        const roleIdMap = new Map<string, string>();

        // 2. Clone categories
        if (config.categories) {
          const categories = await tx.category.findMany({
            where: { storeId: dto.sourceStoreId, deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          });

          for (const category of categories) {
            const newCategory = await tx.category.create({
              data: {
                storeId: newStore.id,
                name: category.name,
                description: category.description,
                sortOrder: category.sortOrder,
                isActive: category.isActive,
              },
            });
            categoryIdMap.set(category.id, newCategory.id);
          }
        }

        // 3. Clone items
        if (config.items) {
          const items = await tx.item.findMany({
            where: { storeId: dto.sourceStoreId, deletedAt: null },
          });

          for (const item of items) {
            await tx.item.create({
              data: {
                storeId: newStore.id,
                categoryId: item.categoryId
                  ? categoryIdMap.get(item.categoryId)
                  : null,
                sku: item.sku, // May need to make unique per store if required
                name: item.name,
                description: item.description,
                price: item.price,
                isActive: item.isActive,
                version: 1,
              },
            });
          }
        }

        // 4. Clone roles (non-system roles)
        if (config.roles) {
          const roles = await tx.role.findMany({
            where: {
              storeId: dto.sourceStoreId,
              deletedAt: null,
              isSystem: false,
            },
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          });

          for (const role of roles) {
            const newRole = await tx.role.create({
              data: {
                storeId: newStore.id,
                name: role.name,
                description: role.description,
                isSystem: false,
              },
            });
            roleIdMap.set(role.id, newRole.id);

            // Clone role permissions
            if (role.rolePermissions.length > 0) {
              await tx.rolePermission.createMany({
                data: role.rolePermissions.map((rp) => ({
                  roleId: newRole.id,
                  permissionId: rp.permissionId,
                })),
              });
            }
          }
        }

        // 5. Clone loss prevention thresholds
        if (config.lossPreventionThresholds) {
          try {
            const thresholds = await (
              tx as any
            ).lossPreventionThreshold.findMany({
              where: { storeId: dto.sourceStoreId },
            });

            if (thresholds.length > 0) {
              await (tx as any).lossPreventionThreshold.createMany({
                data: thresholds.map((t: any) => ({
                  storeId: newStore.id,
                  metricType: t.metricType,
                  threshold: t.threshold,
                  timeWindow: t.timeWindow,
                  scope: t.scope,
                  enabled: t.enabled,
                })),
              });
            }
          } catch {
            // Table might not exist yet
          }
        }

        return { store: newStore, categoryIdMap, roleIdMap };
      });

      // Update job status to completed
      await (this.prisma as any).cloneJob.update({
        where: { id: job.id },
        data: {
          status: CloneStatus.COMPLETED,
          targetId: result.store.id,
          completedAt: new Date(),
        },
      });

      // Audit log
      await this.auditService.log({
        userId,
        storeId: result.store.id,
        action: 'CREATE',
        entityType: 'Store',
        entityId: result.store.id,
        newValue: { clonedFrom: dto.sourceStoreId, name: dto.name },
      });

      return {
        job: {
          ...job,
          status: CloneStatus.COMPLETED,
          targetId: result.store.id,
        },
        store: result.store,
      };
    } catch (error) {
      // Update job status to failed
      await (this.prisma as any).cloneJob.update({
        where: { id: job.id },
        data: {
          status: CloneStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      throw new InternalServerErrorException(
        `Failed to clone store: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ==================== Rollback ====================

  /**
   * Attempt to rollback a failed clone job
   * Note: This only works for jobs that partially completed
   */
  async rollbackCloneJob(jobId: string, userId: string) {
    const job = await this.getCloneJob(jobId);

    if (job.status !== CloneStatus.FAILED) {
      throw new BadRequestException('Can only rollback failed clone jobs');
    }

    if (!job.targetId) {
      // Nothing was created, just mark as rolled back
      await (this.prisma as any).cloneJob.update({
        where: { id: jobId },
        data: { status: CloneStatus.ROLLED_BACK },
      });

      return {
        message: 'Job marked as rolled back (no entities were created)',
      };
    }

    try {
      if (job.type === CloneType.BRANCH) {
        // Delete the partially created branch
        await this.prisma.branch.delete({
          where: { id: job.targetId },
        });
      } else if (job.type === CloneType.STORE) {
        // Delete the partially created store (cascades to related entities)
        await this.prisma.store.delete({
          where: { id: job.targetId },
        });
      }

      await (this.prisma as any).cloneJob.update({
        where: { id: jobId },
        data: { status: CloneStatus.ROLLED_BACK },
      });

      await this.auditService.log({
        userId,
        storeId: job.storeId,
        action: 'DELETE',
        entityType: job.type === CloneType.BRANCH ? 'Branch' : 'Store',
        entityId: job.targetId,
        oldValue: { rolledBack: true, jobId },
      });

      return { message: 'Clone job rolled back successfully' };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to rollback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

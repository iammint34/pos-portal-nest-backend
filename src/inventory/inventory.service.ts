import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateInventoryDto,
  BulkCreateInventoryDto,
  UpdateInventoryDto,
  AdjustInventoryDto,
  AdjustmentType,
  ReceiveStockDto,
  BulkReceiveStockDto,
  SyncMovementDto,
} from './dto';
import { MovementType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ========== Branch Inventory CRUD ==========

  async createBranchInventory(
    storeId: string,
    dto: CreateInventoryDto,
    performedBy?: string,
  ) {
    // Check if item exists and belongs to store
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, storeId, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException('Item not found in this store');
    }

    // Check if branch exists and belongs to store
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, storeId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found in this store');
    }

    // Check if inventory tracking already exists
    const existing = await this.prisma.branchInventory.findUnique({
      where: {
        itemId_branchId: { itemId: dto.itemId, branchId: dto.branchId },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Inventory tracking already exists for this item/branch',
      );
    }

    const inventory = await this.prisma.branchInventory.create({
      data: {
        itemId: dto.itemId,
        branchId: dto.branchId,
        storeId,
        currentQuantity: dto.initialQuantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold,
        isTracked: dto.isTracked ?? true,
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // If initial quantity > 0, create a RECEIVED movement
    if (dto.initialQuantity && dto.initialQuantity > 0) {
      await this.createMovement({
        branchInventoryId: inventory.id,
        itemId: dto.itemId,
        branchId: dto.branchId,
        storeId,
        movementType: MovementType.RECEIVED,
        quantity: dto.initialQuantity,
        previousQuantity: 0,
        newQuantity: dto.initialQuantity,
        referenceType: 'INITIAL',
        reason: 'Initial inventory setup',
        performedBy,
        performedAt: new Date(),
      });
    }

    await this.auditService.log({
      userId: performedBy,
      storeId,
      action: 'CREATE',
      entityType: 'BranchInventory',
      entityId: inventory.id,
      newValue: dto,
    });

    return inventory;
  }

  async bulkCreateInventory(
    storeId: string,
    dto: BulkCreateInventoryDto,
    performedBy?: string,
  ) {
    const results = [];
    for (const itemId of dto.itemIds) {
      try {
        const inventory = await this.createBranchInventory(
          storeId,
          {
            itemId,
            branchId: dto.branchId,
            lowStockThreshold: dto.defaultLowStockThreshold,
          },
          performedBy,
        );
        results.push({ itemId, success: true, inventory });
      } catch (error) {
        results.push({ itemId, success: false, error: error.message });
      }
    }
    return results;
  }

  async findAllInventory(
    storeId: string,
    options: {
      branchId?: string;
      page?: number;
      limit?: number;
      lowStockOnly?: boolean;
      search?: string;
    } = {},
  ) {
    const { branchId, page = 1, limit = 50, lowStockOnly, search } = options;

    const where = {
      storeId,
      ...(branchId && { branchId }),
      ...(lowStockOnly && {
        AND: [
          { lowStockThreshold: { not: null } },
          {
            currentQuantity: {
              lte: this.prisma.branchInventory.fields.lowStockThreshold,
            },
          },
        ],
      }),
      ...(search && {
        item: {
          OR: [{ name: { contains: search } }, { sku: { contains: search } }],
        },
      }),
    };

    const [inventory, total] = await Promise.all([
      this.prisma.branchInventory.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sku: true, price: true } },
          branch: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { item: { name: 'asc' } },
      }),
      this.prisma.branchInventory.count({ where }),
    ]);

    return {
      data: inventory,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneInventory(id: string, storeId?: string) {
    const inventory = await this.prisma.branchInventory.findFirst({
      where: {
        id,
        ...(storeId && { storeId }),
      },
      include: {
        item: { select: { id: true, name: true, sku: true, price: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    return inventory;
  }

  async updateInventory(
    id: string,
    dto: UpdateInventoryDto,
    storeId?: string,
    updatedBy?: string,
  ) {
    const inventory = await this.findOneInventory(id, storeId);

    const updated = await this.prisma.branchInventory.update({
      where: { id },
      data: {
        lowStockThreshold: dto.lowStockThreshold,
        isTracked: dto.isTracked,
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      storeId: inventory.storeId,
      action: 'UPDATE',
      entityType: 'BranchInventory',
      entityId: id,
      oldValue: {
        lowStockThreshold: inventory.lowStockThreshold,
        isTracked: inventory.isTracked,
      },
      newValue: dto,
    });

    return updated;
  }

  // ========== Stock Operations ==========

  async receiveStock(
    storeId: string,
    dto: ReceiveStockDto,
    performedBy?: string,
  ) {
    const inventory = await this.findOneInventory(dto.inventoryId, storeId);

    const previousQuantity = inventory.currentQuantity;
    const newQuantity = previousQuantity + dto.quantity;

    // Update quantity and create movement in a transaction
    const [updatedInventory, movement] = await this.prisma.$transaction([
      this.prisma.branchInventory.update({
        where: { id: dto.inventoryId },
        data: { currentQuantity: newQuantity },
        include: {
          item: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.inventoryMovement.create({
        data: {
          movementId: uuidv4(),
          branchInventoryId: dto.inventoryId,
          itemId: inventory.itemId,
          branchId: inventory.branchId,
          storeId: inventory.storeId,
          movementType: MovementType.RECEIVED,
          quantity: dto.quantity,
          previousQuantity,
          newQuantity,
          referenceType: 'RECEIPT',
          referenceId: dto.referenceNumber,
          reason: dto.notes,
          performedBy,
          performedAt: new Date(),
        },
      }),
    ]);

    await this.auditService.log({
      userId: performedBy,
      storeId: inventory.storeId,
      action: 'UPDATE',
      entityType: 'BranchInventory',
      entityId: dto.inventoryId,
      oldValue: { currentQuantity: previousQuantity },
      newValue: { currentQuantity: newQuantity, received: dto.quantity },
    });

    return { inventory: updatedInventory, movement };
  }

  async bulkReceiveStock(
    storeId: string,
    dto: BulkReceiveStockDto,
    performedBy?: string,
  ) {
    const results = [];
    for (const item of dto.items) {
      try {
        // Find inventory by item and branch
        const inventory = await this.prisma.branchInventory.findUnique({
          where: {
            itemId_branchId: { itemId: item.itemId, branchId: dto.branchId },
          },
        });
        if (!inventory) {
          results.push({
            itemId: item.itemId,
            success: false,
            error: 'Inventory not found',
          });
          continue;
        }

        const result = await this.receiveStock(
          storeId,
          {
            inventoryId: inventory.id,
            quantity: item.quantity,
            referenceNumber: dto.referenceNumber,
            notes: dto.notes,
          },
          performedBy,
        );
        results.push({ itemId: item.itemId, success: true, ...result });
      } catch (error) {
        results.push({
          itemId: item.itemId,
          success: false,
          error: error.message,
        });
      }
    }
    return results;
  }

  async adjustInventory(
    storeId: string,
    dto: AdjustInventoryDto,
    performedBy?: string,
  ) {
    const inventory = await this.findOneInventory(dto.inventoryId, storeId);

    const previousQuantity = inventory.currentQuantity;
    let newQuantity: number;
    let movementType: MovementType;

    switch (dto.adjustmentType) {
      case AdjustmentType.ADJUSTED_UP:
        newQuantity = previousQuantity + dto.quantity;
        movementType = MovementType.ADJUSTED_UP;
        break;
      case AdjustmentType.ADJUSTED_DOWN:
        newQuantity = Math.max(0, previousQuantity - dto.quantity);
        movementType = MovementType.ADJUSTED_DOWN;
        break;
      case AdjustmentType.WASTED:
        newQuantity = Math.max(0, previousQuantity - dto.quantity);
        movementType = MovementType.WASTED;
        break;
      default:
        throw new BadRequestException('Invalid adjustment type');
    }

    const [updatedInventory, movement] = await this.prisma.$transaction([
      this.prisma.branchInventory.update({
        where: { id: dto.inventoryId },
        data: { currentQuantity: newQuantity },
        include: {
          item: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.inventoryMovement.create({
        data: {
          movementId: uuidv4(),
          branchInventoryId: dto.inventoryId,
          itemId: inventory.itemId,
          branchId: inventory.branchId,
          storeId: inventory.storeId,
          movementType,
          quantity: dto.quantity,
          previousQuantity,
          newQuantity,
          referenceType: 'ADJUSTMENT',
          reason: dto.reason,
          performedBy,
          performedAt: new Date(),
        },
      }),
    ]);

    await this.auditService.log({
      userId: performedBy,
      storeId: inventory.storeId,
      action: 'UPDATE',
      entityType: 'BranchInventory',
      entityId: dto.inventoryId,
      oldValue: { currentQuantity: previousQuantity },
      newValue: {
        currentQuantity: newQuantity,
        adjustmentType: dto.adjustmentType,
        quantity: dto.quantity,
      },
    });

    return { inventory: updatedInventory, movement };
  }

  // ========== Movement History ==========

  async getMovementHistory(
    inventoryId: string,
    storeId?: string,
    options: { page?: number; limit?: number } = {},
  ) {
    const inventory = await this.findOneInventory(inventoryId, storeId);
    const { page = 1, limit = 50 } = options;

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { branchInventoryId: inventoryId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { performedAt: 'desc' },
      }),
      this.prisma.inventoryMovement.count({
        where: { branchInventoryId: inventoryId },
      }),
    ]);

    return {
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ========== Low Stock ==========

  async getLowStockItems(storeId: string, branchId?: string) {
    const inventory = await this.prisma.branchInventory.findMany({
      where: {
        storeId,
        ...(branchId && { branchId }),
        isTracked: true,
        lowStockThreshold: { not: null },
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Filter items where currentQuantity <= lowStockThreshold
    return inventory.filter(
      (inv) =>
        inv.lowStockThreshold !== null &&
        inv.currentQuantity <= inv.lowStockThreshold,
    );
  }

  // ========== POS Sync ==========

  async syncMovement(storeId: string, branchId: string, dto: SyncMovementDto) {
    // Check for idempotency - if movement already exists, return success
    const existing = await this.prisma.inventoryMovement.findUnique({
      where: { movementId: dto.movementId },
    });
    if (existing) {
      return {
        success: true,
        message: 'Movement already synced',
        movement: existing,
      };
    }

    // Find the branch inventory for this item
    let inventory = await this.prisma.branchInventory.findUnique({
      where: { itemId_branchId: { itemId: dto.itemId, branchId } },
    });

    // If inventory doesn't exist, create it (for items that weren't tracked before)
    if (!inventory) {
      inventory = await this.prisma.branchInventory.create({
        data: {
          itemId: dto.itemId,
          branchId,
          storeId,
          currentQuantity: dto.newQuantity,
          isTracked: true,
        },
      });
    } else {
      // Update the current quantity to match POS
      await this.prisma.branchInventory.update({
        where: { id: inventory.id },
        data: { currentQuantity: dto.newQuantity },
      });
    }

    // Create the movement record
    const movement = await this.prisma.inventoryMovement.create({
      data: {
        movementId: dto.movementId,
        branchInventoryId: inventory.id,
        itemId: dto.itemId,
        branchId,
        storeId,
        movementType: dto.movementType as MovementType,
        quantity: dto.quantity,
        previousQuantity: dto.previousQuantity,
        newQuantity: dto.newQuantity,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        posDeviceId: dto.posDeviceId,
        reason: dto.reason,
        performedBy: dto.performedBy,
        performedAt: new Date(dto.performedAt),
        syncedAt: new Date(),
      },
    });

    return { success: true, movement };
  }

  // ========== Internal Helper ==========

  private async createMovement(data: {
    branchInventoryId: string;
    itemId: string;
    branchId: string;
    storeId: string;
    movementType: MovementType;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    referenceType?: string;
    referenceId?: string;
    posDeviceId?: string;
    reason?: string;
    performedBy?: string;
    performedAt: Date;
  }) {
    return this.prisma.inventoryMovement.create({
      data: {
        movementId: uuidv4(),
        ...data,
      },
    });
  }

  // ========== Get inventory for sync ==========

  async getInventoryForSync(storeId: string, branchId: string) {
    return this.prisma.branchInventory.findMany({
      where: { storeId, branchId },
      select: {
        id: true,
        itemId: true,
        currentQuantity: true,
        lowStockThreshold: true,
        isTracked: true,
      },
    });
  }
}

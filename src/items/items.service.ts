import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateItemDto,
  UpdateItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ItemBranchAvailabilityDto,
} from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ========== Items ==========

  async createItem(
    storeId: string,
    createItemDto: CreateItemDto,
    createdBy?: string,
  ) {
    // Check for duplicate SKU if provided
    if (createItemDto.sku) {
      const existingSku = await this.prisma.item.findUnique({
        where: { storeId_sku: { storeId, sku: createItemDto.sku } },
      });
      if (existingSku) {
        throw new ConflictException('SKU already exists in this store');
      }
    }

    const item = await this.prisma.item.create({
      data: {
        storeId,
        name: createItemDto.name,
        sku: createItemDto.sku,
        description: createItemDto.description,
        price: createItemDto.price,
        categoryId: createItemDto.categoryId,
        isActive: createItemDto.isActive ?? true,
        version: 1,
      },
      include: {
        category: true,
      },
    });

    // Create initial version record
    await this.prisma.itemVersion.create({
      data: {
        itemId: item.id,
        version: 1,
        name: item.name,
        description: item.description,
        price: item.price,
        changedBy: createdBy,
      },
    });

    await this.auditService.log({
      userId: createdBy,
      storeId,
      action: 'CREATE',
      entityType: 'Item',
      entityId: item.id,
      newValue: createItemDto,
    });

    return item;
  }

  async findAllItems(
    storeId?: string,
    options: {
      page?: number;
      limit?: number;
      categoryId?: string;
      isActive?: boolean;
      search?: string;
    } = {},
  ) {
    const { page = 1, limit = 20, categoryId, isActive, search } = options;

    const where = {
      deletedAt: null,
      ...(storeId && { storeId }),
      ...(categoryId && { categoryId }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          store: {
            select: { id: true, name: true },
          },
          category: {
            select: { id: true, name: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.item.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneItem(id: string, storeId?: string) {
    const item = await this.prisma.item.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(storeId && { storeId }),
      },
      include: {
        category: true,
        itemBranches: {
          include: {
            branch: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async updateItem(
    id: string,
    updateItemDto: UpdateItemDto,
    storeId?: string,
    updatedBy?: string,
  ) {
    const item = await this.findOneItem(id, storeId);

    // Check for duplicate SKU if updating SKU
    if (updateItemDto.sku && updateItemDto.sku !== item.sku) {
      const existingSku = await this.prisma.item.findUnique({
        where: { storeId_sku: { storeId: item.storeId, sku: updateItemDto.sku } },
      });
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException('SKU already exists in this store');
      }
    }

    // Increment version if price or name changes
    const shouldIncrementVersion =
      (updateItemDto.price !== undefined &&
        Number(updateItemDto.price) !== Number(item.price)) ||
      (updateItemDto.name && updateItemDto.name !== item.name);

    const newVersion = shouldIncrementVersion ? item.version + 1 : item.version;

    const updatedItem = await this.prisma.item.update({
      where: { id },
      data: {
        ...updateItemDto,
        version: newVersion,
      },
      include: {
        category: true,
      },
    });

    // Create version record if version changed
    if (shouldIncrementVersion) {
      await this.prisma.itemVersion.create({
        data: {
          itemId: id,
          version: newVersion,
          name: updatedItem.name,
          description: updatedItem.description,
          price: updatedItem.price,
          changedBy: updatedBy,
        },
      });
    }

    await this.auditService.log({
      userId: updatedBy,
      storeId: item.storeId,
      action: 'UPDATE',
      entityType: 'Item',
      entityId: id,
      oldValue: {
        name: item.name,
        price: Number(item.price),
        version: item.version,
      },
      newValue: { ...updateItemDto, version: newVersion },
    });

    return updatedItem;
  }

  async removeItem(id: string, storeId?: string, deletedBy?: string) {
    const item = await this.findOneItem(id, storeId);

    await this.prisma.item.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId: item.storeId,
      action: 'DELETE',
      entityType: 'Item',
      entityId: id,
    });

    return { message: 'Item deleted successfully' };
  }

  async getItemVersions(itemId: string) {
    return this.prisma.itemVersion.findMany({
      where: { itemId },
      orderBy: { version: 'desc' },
    });
  }

  // ========== Branch Availability ==========

  async setItemBranchAvailability(
    itemId: string,
    availability: ItemBranchAvailabilityDto,
    storeId?: string,
  ) {
    await this.findOneItem(itemId, storeId);

    const existing = await this.prisma.itemBranch.findUnique({
      where: {
        itemId_branchId: {
          itemId,
          branchId: availability.branchId,
        },
      },
    });

    if (existing) {
      return this.prisma.itemBranch.update({
        where: { id: existing.id },
        data: {
          isAvailable: availability.isAvailable,
          customPrice: availability.customPrice,
        },
      });
    }

    return this.prisma.itemBranch.create({
      data: {
        itemId,
        branchId: availability.branchId,
        isAvailable: availability.isAvailable,
        customPrice: availability.customPrice,
      },
    });
  }

  async bulkSetBranchAvailability(
    itemId: string,
    availabilities: ItemBranchAvailabilityDto[],
    storeId?: string,
  ) {
    await this.findOneItem(itemId, storeId);

    const results = await Promise.all(
      availabilities.map((a) => this.setItemBranchAvailability(itemId, a, storeId)),
    );

    return results;
  }

  // ========== Categories ==========

  async createCategory(
    storeId: string,
    createCategoryDto: CreateCategoryDto,
    createdBy?: string,
  ) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { storeId_name: { storeId, name: createCategoryDto.name } },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    const category = await this.prisma.category.create({
      data: {
        storeId,
        name: createCategoryDto.name,
        description: createCategoryDto.description,
        sortOrder: createCategoryDto.sortOrder ?? 0,
      },
    });

    await this.auditService.log({
      userId: createdBy,
      storeId,
      action: 'CREATE',
      entityType: 'Category',
      entityId: category.id,
      newValue: createCategoryDto,
    });

    return category;
  }

  async findAllCategories(storeId?: string) {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        ...(storeId && { storeId }),
      },
      include: {
        store: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            items: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOneCategory(id: string, storeId?: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(storeId && { storeId }),
      },
      include: {
        items: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    storeId?: string,
    updatedBy?: string,
  ) {
    const category = await this.findOneCategory(id, storeId);

    // Check for duplicate name
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existing = await this.prisma.category.findUnique({
        where: {
          storeId_name: { storeId: category.storeId, name: updateCategoryDto.name },
        },
      });
      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    await this.auditService.log({
      userId: updatedBy,
      storeId: category.storeId,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: id,
      oldValue: { name: category.name },
      newValue: updateCategoryDto,
    });

    return updatedCategory;
  }

  async removeCategory(id: string, storeId?: string, deletedBy?: string) {
    const category = await this.findOneCategory(id, storeId);

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId: category.storeId,
      action: 'DELETE',
      entityType: 'Category',
      entityId: id,
    });

    return { message: 'Category deleted successfully' };
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryDto,
  BulkCreateInventoryDto,
  UpdateInventoryDto,
  AdjustInventoryDto,
  ReceiveStockDto,
  BulkReceiveStockDto,
  SyncMovementDto,
} from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
  PosDevice,
  CurrentPosDevice,
  Public,
} from '../common/decorators';

@ApiTags('inventory')
@Controller('inventory')
@ApiBearerAuth('JWT-auth')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ========== Branch Inventory Management ==========

  @Post()
  @Permissions('inventory.create')
  @ApiOperation({ summary: 'Create inventory tracking for an item at a branch' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Store ID' })
  createInventory(
    @Body() dto: CreateInventoryDto,
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.createBranchInventory(
      effectiveStoreId,
      dto,
      user.userId,
    );
  }

  @Post('bulk')
  @Permissions('inventory.create')
  @ApiOperation({ summary: 'Bulk create inventory tracking for multiple items at a branch' })
  bulkCreateInventory(
    @Body() dto: BulkCreateInventoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!user?.storeId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.bulkCreateInventory(
      user.storeId,
      dto,
      user.userId,
    );
  }

  @Get()
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get all inventory records' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'lowStockOnly', required: false, description: 'Only show low stock items' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by item name or SKU' })
  findAllInventory(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('lowStockOnly') lowStockOnly?: boolean,
    @Query('search') search?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.findAllInventory(effectiveStoreId, {
      branchId,
      page,
      limit,
      lowStockOnly,
      search,
    });
  }

  @Get('low-stock')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get items below low stock threshold' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch' })
  getLowStockItems(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.getLowStockItems(effectiveStoreId, branchId);
  }

  @Get(':id')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get inventory record by ID' })
  findOneInventory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.inventoryService.findOneInventory(id, user?.storeId);
  }

  @Get(':id/movements')
  @Permissions('inventory.read')
  @ApiOperation({ summary: 'Get movement history for an inventory record' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMovementHistory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getMovementHistory(id, user?.storeId, {
      page,
      limit,
    });
  }

  @Patch(':id')
  @Permissions('inventory.update')
  @ApiOperation({ summary: 'Update inventory settings (threshold, tracking)' })
  updateInventory(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.inventoryService.updateInventory(
      id,
      dto,
      user?.storeId,
      user.userId,
    );
  }

  // ========== Stock Operations ==========

  @Post('receive')
  @Permissions('inventory.receive')
  @ApiOperation({ summary: 'Receive stock for a single inventory item' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Store ID' })
  receiveStock(
    @Body() dto: ReceiveStockDto,
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.receiveStock(
      effectiveStoreId,
      dto,
      user.userId,
    );
  }

  @Post('receive/bulk')
  @Permissions('inventory.receive')
  @ApiOperation({ summary: 'Receive stock for multiple items' })
  bulkReceiveStock(
    @Body() dto: BulkReceiveStockDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!user?.storeId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.bulkReceiveStock(
      user.storeId,
      dto,
      user.userId,
    );
  }

  @Post('adjust')
  @Permissions('inventory.adjust')
  @ApiOperation({ summary: 'Adjust inventory (up, down, or waste)' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Store ID' })
  adjustInventory(
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.inventoryService.adjustInventory(
      effectiveStoreId,
      dto,
      user.userId,
    );
  }

  // ========== POS Sync Endpoint ==========

  @Post('sync')
  @Public()
  @PosDevice()
  @ApiOperation({ summary: 'Sync inventory movement from POS device' })
  syncMovement(
    @Body() dto: SyncMovementDto,
    @CurrentPosDevice() device: { deviceId: string; branchId: string; storeId: string },
  ) {
    return this.inventoryService.syncMovement(
      device.storeId,
      device.branchId,
      dto,
    );
  }
}

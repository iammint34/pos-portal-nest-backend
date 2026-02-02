import {
  Controller,
  Get,
  Post,
  Body,
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
import { SalesService } from './sales.service';
import {
  SyncOrderDto,
  SyncOrdersBatchDto,
  VoidOrderDto,
  OrderStatus,
  SyncResult,
  BatchSyncResult,
} from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
  PosDevice,
  CurrentPosDevice,
} from '../common/decorators';

@ApiTags('sales')
@Controller('sales')
@ApiBearerAuth('JWT-auth')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ========== POS Sync Endpoints ==========

  @Post('sync')
  @PosDevice()
  @ApiOperation({
    summary: 'Sync a single order from POS (idempotent)',
    description:
      'Syncs a single order from POS device. Safe to retry - duplicate orders are detected by posOrderId.',
  })
  async syncOrder(
    @Body() syncOrderDto: SyncOrderDto,
    @CurrentPosDevice()
    device: { id: string; branchId: string; storeId: string },
  ): Promise<SyncResult> {
    return this.salesService.syncOrder(
      device.id,
      device.branchId,
      device.storeId,
      syncOrderDto,
    );
  }

  @Post('sync/batch')
  @PosDevice()
  @ApiOperation({
    summary: 'Batch sync multiple orders from POS (idempotent)',
    description:
      'Syncs multiple orders in a batch. Each order is processed independently allowing partial success.',
  })
  async syncOrdersBatch(
    @Body() batchDto: SyncOrdersBatchDto,
    @CurrentPosDevice()
    device: { id: string; branchId: string; storeId: string },
  ): Promise<BatchSyncResult> {
    return this.salesService.syncOrdersBatch(
      device.id,
      device.branchId,
      device.storeId,
      batchDto,
    );
  }

  @Post('void')
  @PosDevice()
  @ApiOperation({
    summary: 'Void an order',
    description:
      'Marks an order as voided. Idempotent - can be called multiple times safely.',
  })
  async voidOrder(
    @Body() voidDto: VoidOrderDto,
    @CurrentPosDevice()
    device: { id: string; branchId: string; storeId: string },
  ) {
    return this.salesService.voidOrder(device.id, voidDto);
  }

  // ========== Portal Read Endpoints ==========

  @Get('orders')
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'Get orders with filtering',
    description: 'Retrieve orders for the current store with optional filters.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'posDeviceId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter orders from this date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter orders until this date (ISO string)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getOrders(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
    @Query('posDeviceId') posDeviceId?: string,
    @Query('status') status?: OrderStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const effectiveStoreId = user?.storeId || storeId;

    return this.salesService.getOrders(effectiveStoreId, {
      branchId,
      posDeviceId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
  }

  @Get('orders/:id')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get order by ID with full details' })
  async getOrderById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.salesService.getOrderById(id, user?.storeId);
  }

  @Get('summary')
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'Get sales summary for a period',
    description:
      'Returns aggregated sales data including totals, refunds, and payment breakdown.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Store ID (required for owners)',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO string)',
  })
  async getSalesSummary(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const effectiveStoreId = user?.storeId || storeId;

    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }

    if (!startDate || !endDate) {
      throw new BadRequestException('Start date and end date are required');
    }

    return this.salesService.getSalesSummary(effectiveStoreId, {
      branchId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }
}

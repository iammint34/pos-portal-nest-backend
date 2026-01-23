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
import { ShiftsService } from './shifts.service';
import { SyncShiftDto, SyncShiftResult, ShiftStatus } from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
  PosDevice,
  CurrentPosDevice,
} from '../common/decorators';

@ApiTags('shifts')
@Controller('shifts')
@ApiBearerAuth('JWT-auth')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  // ========== POS Sync Endpoint ==========

  @Post('sync')
  @PosDevice()
  @ApiOperation({
    summary: 'Sync a shift from POS (idempotent)',
    description: 'Syncs shift data from POS device. Safe to retry - duplicate shifts are detected by posShiftId.',
  })
  async syncShift(
    @Body() dto: SyncShiftDto,
    @CurrentPosDevice() device: { id: string; branchId: string; storeId: string },
  ): Promise<SyncShiftResult> {
    return this.shiftsService.syncShift(
      device.id,
      device.branchId,
      device.storeId,
      dto,
    );
  }

  // ========== Portal Read Endpoints ==========

  @Get()
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'Get shifts with filtering',
    description: 'Retrieve shifts for the current store with optional filters.',
  })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID (owners only)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'posDeviceId', required: false })
  @ApiQuery({ name: 'operatorId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ShiftStatus })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter shifts from this date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter shifts until this date (ISO string)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getShifts(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
    @Query('posDeviceId') posDeviceId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('status') status?: ShiftStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const effectiveStoreId = user?.storeId || storeId;

    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }

    return this.shiftsService.getShifts(effectiveStoreId, {
      branchId,
      posDeviceId,
      operatorId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
  }

  @Get('summary')
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'Get shifts summary for a period',
    description: 'Returns aggregated shift data including variances and totals.',
  })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getShiftsSummary(
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

    return this.shiftsService.getShiftsSummary(effectiveStoreId, {
      branchId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  @Get('variances')
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'Get shifts with cash discrepancies',
    description: 'Returns shifts that have non-zero cash variances.',
  })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'minVariance', required: false, description: 'Minimum absolute variance to include' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getShiftsWithVariances(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('branchId') branchId?: string,
    @Query('minVariance') minVariance?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const effectiveStoreId = user?.storeId || storeId;

    if (!effectiveStoreId) {
      throw new BadRequestException('Store ID is required');
    }

    return this.shiftsService.getShiftsWithVariances(effectiveStoreId, {
      branchId,
      minVariance,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
  }

  @Get(':id')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Get shift by ID with full details' })
  async getShiftById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.shiftsService.getShiftById(id, user?.storeId);
  }
}

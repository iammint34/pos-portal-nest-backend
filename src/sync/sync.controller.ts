import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncRequestDto, HeartbeatDto } from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
  Public,
} from '../common/decorators';
import { SyncType, SyncStatus } from '@prisma/client';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // ========== POS Device Sync Endpoints ==========

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync configuration to POS device' })
  sync(@Body() syncRequestDto: SyncRequestDto) {
    return this.syncService.sync(syncRequestDto);
  }

  @Public()
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'POS device heartbeat' })
  heartbeat(@Body() heartbeatDto: HeartbeatDto) {
    return this.syncService.heartbeat(heartbeatDto);
  }

  // ========== Portal Management Endpoints ==========

  @Get('logs')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.sync.view')
  @ApiOperation({
    summary:
      'Get sync logs. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  @ApiQuery({ name: 'posDeviceId', required: false })
  @ApiQuery({ name: 'syncType', required: false, enum: SyncType })
  @ApiQuery({ name: 'status', required: false, enum: SyncStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSyncLogs(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('posDeviceId') posDeviceId?: string,
    @Query('syncType') syncType?: SyncType,
    @Query('status') status?: SyncStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    return this.syncService.getSyncLogs(effectiveStoreId, {
      posDeviceId,
      syncType,
      status,
      page,
      limit,
    });
  }

  @Get('stats')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pos.sync.view')
  @ApiOperation({
    summary:
      'Get sync statistics. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  getSyncStats(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = storeId || user?.storeId;
    return this.syncService.getSyncStats(effectiveStoreId);
  }
}

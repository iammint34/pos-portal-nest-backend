import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertType } from '@prisma/client';
import { AlertsService } from './alerts.service';
import { AlertConfigService } from './alert-config.service';
import { AlertQueryDto, BulkDismissDto, UpdateAlertConfigDto } from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
} from '../common/decorators';

@ApiTags('alerts')
@Controller('alerts')
@ApiBearerAuth('JWT-auth')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly alertConfigService: AlertConfigService,
  ) {}

  @Get()
  @Permissions('alert.read')
  @ApiOperation({ summary: 'Get alerts for a store' })
  getAlerts(
    @Query() query: AlertQueryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const storeId = query.storeId || user.storeId;
    return this.alertsService.getAlerts(storeId, query);
  }

  @Get('count')
  @Permissions('alert.read')
  @ApiOperation({ summary: 'Get active alert count for a store' })
  getAlertCount(
    @Query('storeId') storeId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.alertsService.getActiveAlertCount(storeId || user.storeId);
  }

  @Patch(':id/acknowledge')
  @Permissions('alert.acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  acknowledgeAlert(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.alertsService.acknowledgeAlert(id, user.userId);
  }

  @Patch(':id/dismiss')
  @Permissions('alert.dismiss')
  @ApiOperation({ summary: 'Dismiss an alert' })
  dismissAlert(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.alertsService.dismissAlert(id, user.userId);
  }

  @Post('bulk-dismiss')
  @Permissions('alert.dismiss')
  @ApiOperation({ summary: 'Dismiss multiple alerts' })
  bulkDismiss(
    @Body() dto: BulkDismissDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.alertsService.bulkDismiss(dto, user.userId);
  }

  @Get('config')
  @Permissions('alert.config')
  @ApiOperation({ summary: 'Get all alert configurations for a store' })
  getConfigs(
    @Query('storeId') storeId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.alertConfigService.getAllConfigs(storeId || user.storeId);
  }

  @Put('config/:alertType')
  @Permissions('alert.config')
  @ApiOperation({ summary: 'Update alert configuration for a specific type' })
  updateConfig(
    @Param('alertType') alertType: AlertType,
    @Body() dto: UpdateAlertConfigDto,
    @Query('storeId') storeId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.alertConfigService.upsertConfig(
      storeId || user.storeId,
      alertType,
      dto,
    );
  }
}

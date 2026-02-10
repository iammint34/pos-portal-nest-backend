import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import {
  NotificationType,
  NotificationStatus,
} from './notifications.constants';

// DTOs
class UpdatePreferencesDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  dailyDigest?: boolean;
  weeklySummary?: boolean;
  alertsEnabled?: boolean;
  email?: string;
  phone?: string;
}

class SendTestNotificationDto {
  type: NotificationType;
  subject?: string;
  message: string;
}

class UpdateScheduleDto {
  schedule?: string;
  timezone?: string;
  enabled?: boolean;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('stores/:storeId/notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly schedulerService: NotificationSchedulerService,
  ) {}

  // ==================== Preferences ====================

  @Get('preferences')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  async getMyPreferences(
    @Param('storeId') storeId: string,
    @CurrentUser() user: any,
  ) {
    return this.preferencesService.getOrCreate(storeId, user.id);
  }

  @Patch('preferences')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updateMyPreferences(
    @Param('storeId') storeId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePreferencesDto,
  ) {
    // Ensure preferences exist first
    await this.preferencesService.getOrCreate(storeId, user.id);
    return this.preferencesService.update(storeId, user.id, dto);
  }

  @Get('preferences/all')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Get all user preferences for store (admin)' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'All preferences retrieved' })
  async getAllPreferences(@Param('storeId') storeId: string) {
    return this.preferencesService.getAllForStore(storeId);
  }

  @Get('preferences/user/:userId')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Get specific user preferences (admin)' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User preferences retrieved' })
  async getUserPreferences(
    @Param('storeId') storeId: string,
    @Param('userId') userId: string,
  ) {
    return this.preferencesService.getOrCreate(storeId, userId);
  }

  @Patch('preferences/user/:userId')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Update specific user preferences (admin)' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User preferences updated' })
  async updateUserPreferences(
    @Param('storeId') storeId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    await this.preferencesService.getOrCreate(storeId, userId);
    return this.preferencesService.update(storeId, userId, dto);
  }

  // ==================== Notification Logs ====================

  @Get('logs')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Get notification logs' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  async getLogs(
    @Param('storeId') storeId: string,
    @Query('type') type?: NotificationType,
    @Query('status') status?: NotificationStatus,
    @Query('userId') userId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.notificationsService.getLogs(storeId, {
      type,
      status,
      userId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('logs/my')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Get current user notification logs' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User logs retrieved' })
  async getMyLogs(
    @Param('storeId') storeId: string,
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getLogs(storeId, {
      userId: user.id,
      limit: limit ? Number(limit) : 20,
    });
  }

  // ==================== Test Notifications ====================

  @Post('test')
  @Permissions('notification.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test notification to current user' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Test notification sent' })
  async sendTestNotification(
    @Param('storeId') storeId: string,
    @CurrentUser() user: any,
    @Body() dto: SendTestNotificationDto,
  ) {
    const preference = await this.preferencesService.getOrCreate(
      storeId,
      user.id,
    );
    const recipient = preference.email || user.email;

    if (!recipient) {
      return { success: false, error: 'No email address configured' };
    }

    return this.notificationsService.send({
      storeId,
      userId: user.id,
      type: dto.type,
      channel: 'EMAIL' as any,
      recipient,
      subject: dto.subject || `Test: ${dto.type}`,
      content: `<h1>Test Notification</h1><p>${dto.message}</p>`,
    });
  }

  // ==================== Schedules ====================

  @Get('schedules')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Get notification schedules for store' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved' })
  async getSchedules(@Param('storeId') storeId: string) {
    return this.schedulerService.getStoreSchedules(storeId);
  }

  @Get('schedules/:type')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Get specific notification schedule' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({
    name: 'type',
    description: 'Notification type',
    enum: NotificationType,
  })
  @ApiResponse({ status: 200, description: 'Schedule retrieved' })
  async getSchedule(
    @Param('storeId') storeId: string,
    @Param('type') type: NotificationType,
  ) {
    return this.schedulerService.getSchedule(storeId, type);
  }

  @Patch('schedules/:type')
  @Permissions('notification.manage')
  @ApiOperation({ summary: 'Update notification schedule' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({
    name: 'type',
    description: 'Notification type',
    enum: NotificationType,
  })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
  async updateSchedule(
    @Param('storeId') storeId: string,
    @Param('type') type: NotificationType,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulerService.upsertSchedule(storeId, type, dto);
  }

  @Post('schedules/initialize')
  @Permissions('notification.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize default schedules for store' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Default schedules initialized' })
  async initializeSchedules(@Param('storeId') storeId: string) {
    const count =
      await this.schedulerService.initializeDefaultSchedules(storeId);
    return { message: `Initialized ${count} default schedules` };
  }

  @Post('schedules/:type/trigger')
  @Permissions('notification.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger a digest notification' })
  @ApiParam({ name: 'storeId', description: 'Store ID' })
  @ApiParam({
    name: 'type',
    description: 'Notification type',
    enum: NotificationType,
  })
  @ApiResponse({ status: 200, description: 'Digest triggered' })
  async triggerDigest(
    @Param('storeId') storeId: string,
    @Param('type') type: NotificationType,
  ) {
    return this.schedulerService.triggerDigest(storeId, type);
  }
}

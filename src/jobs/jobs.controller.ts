import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { JobsService } from './jobs.service';
import { JobType, JobStatus, JobPriority } from './jobs.constants';

// DTOs for request validation
class CreateJobBodyDto {
  storeId?: string;
  type: JobType;
  name: string;
  payload?: any;
  priority?: JobPriority;
  scheduledFor?: string;
  maxAttempts?: number;
}

class CreateScheduleBodyDto {
  storeId?: string;
  type: JobType;
  name: string;
  cronExpr: string;
  timezone?: string;
  payload?: any;
  isActive?: boolean;
}

class UpdateScheduleBodyDto {
  cronExpr?: string;
  timezone?: string;
  payload?: any;
  isActive?: boolean;
}

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('api/v1/jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ==================== Job Endpoints ====================

  @Get()
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get all jobs with filters' })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: JobType })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async getJobs(
    @Query('storeId') storeId?: string,
    @Query('type') type?: JobType,
    @Query('status') status?: JobStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.jobsService.getJobs({
      storeId,
      type,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('stats')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get job queue statistics' })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  async getStats(@Query('storeId') storeId?: string) {
    return this.jobsService.getStats(storeId);
  }

  @Get('health')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get job queue health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async getHealth() {
    return this.jobsService.getHealth();
  }

  @Get(':jobId')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get a specific job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.jobsService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found', statusCode: 404 };
    }
    return job;
  }

  @Post()
  @Permissions('store.create')
  @ApiOperation({ summary: 'Create a new job' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  async createJob(@Body() dto: CreateJobBodyDto, @CurrentUser() user: any) {
    return this.jobsService.createJob({
      storeId: dto.storeId,
      type: dto.type,
      name: dto.name,
      payload: dto.payload,
      priority: dto.priority,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
      maxAttempts: dto.maxAttempts,
      createdBy: user.id,
    });
  }

  @Post(':jobId/cancel')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending/queued job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel job' })
  async cancelJob(@Param('jobId') jobId: string) {
    return this.jobsService.cancelJob(jobId);
  }

  @Post(':jobId/retry')
  @Permissions('store.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job queued for retry' })
  @ApiResponse({ status: 400, description: 'Can only retry failed jobs' })
  async retryJob(@Param('jobId') jobId: string) {
    return this.jobsService.retryJob(jobId);
  }

  // ==================== Schedule Endpoints ====================

  @Get('schedules/all')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get all job schedules' })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: JobType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  async getSchedules(
    @Query('storeId') storeId?: string,
    @Query('type') type?: JobType,
    @Query('isActive') isActive?: string,
  ) {
    return this.jobsService.getSchedules({
      storeId,
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('schedules/:scheduleId')
  @Permissions('store.read')
  @ApiOperation({ summary: 'Get a specific schedule' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async getSchedule(@Param('scheduleId') scheduleId: string) {
    const schedule = await this.jobsService.getSchedule(scheduleId);
    if (!schedule) {
      return { error: 'Schedule not found', statusCode: 404 };
    }
    return schedule;
  }

  @Post('schedules')
  @Permissions('store.create')
  @ApiOperation({ summary: 'Create a new job schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  async createSchedule(
    @Body() dto: CreateScheduleBodyDto,
    @CurrentUser() user: any,
  ) {
    return this.jobsService.createSchedule({
      storeId: dto.storeId,
      type: dto.type,
      name: dto.name,
      cronExpr: dto.cronExpr,
      timezone: dto.timezone,
      payload: dto.payload,
      isActive: dto.isActive,
      createdBy: user.id,
    });
  }

  @Patch('schedules/:scheduleId')
  @Permissions('store.update')
  @ApiOperation({ summary: 'Update a job schedule' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleBodyDto,
  ) {
    return this.jobsService.updateSchedule(scheduleId, dto);
  }

  @Delete('schedules/:scheduleId')
  @Permissions('store.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job schedule' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  @ApiResponse({ status: 204, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async deleteSchedule(@Param('scheduleId') scheduleId: string) {
    await this.jobsService.deleteSchedule(scheduleId);
  }
}

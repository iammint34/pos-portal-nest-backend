import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  JobType,
  JobStatus,
  DEFAULT_JOB_CONFIG,
  JOB_PROCESSING_INTERVAL_MS,
} from './jobs.constants';
import type {
  BackgroundJob,
  JobSchedule,
  CreateJobDto,
  UpdateJobDto,
  CreateScheduleDto,
  UpdateScheduleDto,
  JobProcessorContext,
  JobQueueStats,
  JobHealthStatus,
} from './jobs.types';
import { IJobProcessor, JOB_PROCESSORS } from './job-processor.interface';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private lastProcessedAt: Date | null = null;
  private processors: Map<JobType, IJobProcessor> = new Map();

  constructor(
    private prisma: PrismaService,
    @Optional()
    @Inject(JOB_PROCESSORS)
    private jobProcessors: IJobProcessor[] = [],
  ) {
    // Register processors
    for (const processor of this.jobProcessors) {
      this.registerProcessor(processor);
    }
  }

  private isTableAvailable = false;

  async onModuleInit() {
    // Check if the background_jobs table exists
    await this.checkTableAvailability();
    if (this.isTableAvailable) {
      this.startProcessing();
    }
    this.logger.log('Job queue service initialized');
  }

  onModuleDestroy() {
    this.stopProcessing();
    this.logger.log('Job queue service stopped');
  }

  /**
   * Check if the background_jobs table exists in the database
   */
  private async checkTableAvailability(): Promise<void> {
    try {
      // Try to access the model - if it fails, table doesn't exist
      if ((this.prisma as any).backgroundJob) {
        await (this.prisma as any).backgroundJob.count({ take: 1 });
        this.isTableAvailable = true;
        this.logger.log('Background jobs table is available');
      } else {
        this.isTableAvailable = false;
        this.logger.warn(
          'Background jobs table not found. Run migrations to enable job processing.',
        );
      }
    } catch {
      this.isTableAvailable = false;
      this.logger.warn(
        'Background jobs table not available. Run migrations to enable job processing.',
      );
    }
  }

  /**
   * Register a job processor
   */
  registerProcessor(processor: IJobProcessor) {
    this.processors.set(processor.jobType, processor);
    this.logger.log(`Registered processor for job type: ${processor.jobType}`);
  }

  /**
   * Start the job processing loop
   */
  private startProcessing() {
    if (this.processingInterval) return;
    if (!this.isTableAvailable) {
      this.logger.warn('Cannot start job processing - table not available');
      return;
    }

    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextJob();
      }
    }, JOB_PROCESSING_INTERVAL_MS);

    this.logger.log('Job processing started');
  }

  /**
   * Stop the job processing loop
   */
  private stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.logger.log('Job processing stopped');
  }

  /**
   * Ensure the job table is available before operations
   */
  private ensureTableAvailable(): void {
    if (!this.isTableAvailable) {
      throw new Error(
        'Job queue not available. Please run database migrations first.',
      );
    }
  }

  // ==================== Job Management ====================

  /**
   * Create a new job
   */
  async createJob(dto: CreateJobDto): Promise<BackgroundJob> {
    this.ensureTableAvailable();
    const job = await (this.prisma as any).backgroundJob.create({
      data: {
        storeId: dto.storeId || null,
        type: dto.type,
        name: dto.name,
        payload: dto.payload || null,
        priority: dto.priority || DEFAULT_JOB_CONFIG.defaultPriority,
        maxAttempts: dto.maxAttempts || DEFAULT_JOB_CONFIG.maxAttempts,
        scheduledFor: dto.scheduledFor || null,
        createdBy: dto.createdBy || null,
        status: dto.scheduledFor ? JobStatus.PENDING : JobStatus.QUEUED,
      },
    });

    this.logger.log(`Created job: ${job.id} (${dto.type}: ${dto.name})`);
    return job;
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<BackgroundJob | null> {
    return (this.prisma as any).backgroundJob.findUnique({
      where: { id: jobId },
    });
  }

  /**
   * Get jobs with filters
   */
  async getJobs(filters: {
    storeId?: string;
    type?: JobType;
    status?: JobStatus;
    limit?: number;
    offset?: number;
  }): Promise<BackgroundJob[]> {
    const where: any = {};

    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    return (this.prisma as any).backgroundJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });
  }

  /**
   * Update a job
   */
  async updateJob(jobId: string, dto: UpdateJobDto): Promise<BackgroundJob> {
    const data: any = { ...dto };

    if (dto.status === JobStatus.PROCESSING) {
      data.startedAt = new Date();
    } else if (
      dto.status === JobStatus.COMPLETED ||
      dto.status === JobStatus.FAILED
    ) {
      data.completedAt = new Date();
    }

    return (this.prisma as any).backgroundJob.update({
      where: { id: jobId },
      data,
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<BackgroundJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    if (job.status === JobStatus.PROCESSING) {
      throw new Error('Cannot cancel a job that is currently processing');
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      throw new Error('Cannot cancel a job that has already finished');
    }

    return this.updateJob(jobId, { status: JobStatus.CANCELLED });
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<BackgroundJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    if (job.status !== JobStatus.FAILED) {
      throw new Error('Can only retry failed jobs');
    }

    return (this.prisma as any).backgroundJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.QUEUED,
        attempts: 0,
        errorMessage: null,
        errorStack: null,
        startedAt: null,
        completedAt: null,
      },
    });
  }

  // ==================== Job Processing ====================

  /**
   * Process the next available job from the queue
   */
  private async processNextJob(): Promise<void> {
    if (!this.isTableAvailable) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get the next job to process (highest priority, oldest first)
      const job = await this.getNextQueuedJob();

      if (!job) {
        return;
      }

      // Check if we have a processor for this job type
      const processor = this.processors.get(job.type as JobType);
      if (!processor) {
        this.logger.warn(`No processor registered for job type: ${job.type}`);
        await this.updateJob(job.id, {
          status: JobStatus.FAILED,
          errorMessage: `No processor registered for job type: ${job.type}`,
        });
        return;
      }

      await this.executeJob(job, processor);
    } catch (error) {
      this.logger.error('Error in job processing loop', error);
    } finally {
      this.isProcessing = false;
      this.lastProcessedAt = new Date();
    }
  }

  /**
   * Get the next job to process from the queue
   */
  private async getNextQueuedJob(): Promise<BackgroundJob | null> {
    const now = new Date();

    // First, check for scheduled jobs that are ready
    await (this.prisma as any).backgroundJob.updateMany({
      where: {
        status: JobStatus.PENDING,
        scheduledFor: { lte: now },
      },
      data: { status: JobStatus.QUEUED },
    });

    // Get the next queued job, ordered by priority and creation time
    return (this.prisma as any).backgroundJob.findFirst({
      where: { status: JobStatus.QUEUED },
      orderBy: [
        { priority: 'desc' }, // CRITICAL > HIGH > NORMAL > LOW
        { createdAt: 'asc' }, // Oldest first
      ],
    });
  }

  /**
   * Execute a job with the given processor
   */
  private async executeJob(
    job: BackgroundJob,
    processor: IJobProcessor,
  ): Promise<void> {
    this.logger.log(`Processing job: ${job.id} (${job.type}: ${job.name})`);

    // Update job status to processing
    const updatedJob = await (this.prisma as any).backgroundJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PROCESSING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Create context for the processor
    const context: JobProcessorContext = {
      job: updatedJob,
      updateProgress: async (progress: number) => {
        await this.updateJob(job.id, {
          progress: Math.min(100, Math.max(0, progress)),
        });
      },
      log: (message: string) => {
        this.logger.log(`[Job ${job.id}] ${message}`);
      },
    };

    try {
      // Before process hook
      if (processor.beforeProcess) {
        await processor.beforeProcess(context);
      }

      // Process the job
      const result = await processor.process(context);

      // After process hook
      if (processor.afterProcess) {
        await processor.afterProcess(context, result);
      }

      if (result.success) {
        await this.updateJob(job.id, {
          status: JobStatus.COMPLETED,
          progress: 100,
          result: result.result,
        });
        this.logger.log(`Job completed: ${job.id}`);
      } else {
        throw new Error(result.error || 'Job processing failed');
      }
    } catch (error: any) {
      await this.handleJobError(updatedJob, processor, context, error);
    }
  }

  /**
   * Handle job execution error
   */
  private async handleJobError(
    job: BackgroundJob,
    processor: IJobProcessor,
    context: JobProcessorContext,
    error: Error,
  ): Promise<void> {
    this.logger.error(`Job failed: ${job.id}`, error.message);

    const shouldRetry = job.attempts < job.maxAttempts;

    if (shouldRetry) {
      // Schedule retry
      if (processor.onRetry) {
        await processor.onRetry(context, job.attempts);
      }

      const retryDelay = DEFAULT_JOB_CONFIG.retryDelayMs * job.attempts;
      const scheduledFor = new Date(Date.now() + retryDelay);

      await (this.prisma as any).backgroundJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.RETRYING,
          scheduledFor,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });

      // Move back to pending after a delay
      setTimeout(async () => {
        await (this.prisma as any).backgroundJob.update({
          where: { id: job.id },
          data: { status: JobStatus.QUEUED, scheduledFor: null },
        });
      }, retryDelay);

      this.logger.log(
        `Job ${job.id} will retry in ${retryDelay / 1000}s (attempt ${job.attempts}/${job.maxAttempts})`,
      );
    } else {
      // Max attempts reached, mark as failed
      if (processor.onFailure) {
        await processor.onFailure(context, error);
      }

      await this.updateJob(job.id, {
        status: JobStatus.FAILED,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      this.logger.error(`Job permanently failed: ${job.id}`);
    }
  }

  // ==================== Job Schedules ====================

  /**
   * Create a job schedule
   */
  async createSchedule(dto: CreateScheduleDto): Promise<JobSchedule> {
    const nextRunAt = this.calculateNextRun(dto.cronExpr, dto.timezone);

    const schedule = await (this.prisma as any).jobSchedule.create({
      data: {
        storeId: dto.storeId || null,
        type: dto.type,
        name: dto.name,
        cronExpr: dto.cronExpr,
        timezone: dto.timezone || 'Asia/Manila',
        payload: dto.payload || null,
        isActive: dto.isActive ?? true,
        nextRunAt,
        createdBy: dto.createdBy || null,
      },
    });

    this.logger.log(
      `Created schedule: ${schedule.id} (${dto.type}: ${dto.name})`,
    );
    return schedule;
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(scheduleId: string): Promise<JobSchedule | null> {
    return (this.prisma as any).jobSchedule.findUnique({
      where: { id: scheduleId },
    });
  }

  /**
   * Get schedules with filters
   */
  async getSchedules(filters: {
    storeId?: string;
    type?: JobType;
    isActive?: boolean;
    limit?: number;
  }): Promise<JobSchedule[]> {
    const where: any = {};

    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.type) where.type = filters.type;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return (this.prisma as any).jobSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    });
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<JobSchedule> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) throw new Error(`Schedule not found: ${scheduleId}`);

    const data: any = { ...dto };

    // Recalculate next run if cron expression changed
    if (dto.cronExpr || dto.timezone) {
      data.nextRunAt = this.calculateNextRun(
        dto.cronExpr || schedule.cronExpr,
        dto.timezone || schedule.timezone,
      );
    }

    return (this.prisma as any).jobSchedule.update({
      where: { id: scheduleId },
      data,
    });
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await (this.prisma as any).jobSchedule.delete({
      where: { id: scheduleId },
    });
    this.logger.log(`Deleted schedule: ${scheduleId}`);
  }

  /**
   * Check and create jobs for due schedules
   * Runs every minute via cron
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledJobs(): Promise<void> {
    if (!this.isTableAvailable) {
      return;
    }

    const now = new Date();

    // Get all active schedules that are due
    const dueSchedules = await (this.prisma as any).jobSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
    });

    for (const schedule of dueSchedules) {
      try {
        // Create a job from the schedule
        await this.createJob({
          storeId: schedule.storeId,
          type: schedule.type as JobType,
          name: `${schedule.name} (scheduled)`,
          payload: schedule.payload,
          createdBy: schedule.createdBy,
        });

        // Update schedule with next run time
        const nextRunAt = this.calculateNextRun(
          schedule.cronExpr,
          schedule.timezone,
        );

        await (this.prisma as any).jobSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });

        this.logger.log(`Scheduled job created from: ${schedule.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to create job from schedule ${schedule.id}`,
          error,
        );
      }
    }
  }

  /**
   * Calculate the next run time based on cron expression
   * TODO: Implement proper cron parsing with a library like cron-parser
   */
  private calculateNextRun(cronExpr: string, timezone: string): Date {
    // Simple placeholder - for production, use a library like cron-parser
    // This returns next minute as a basic approximation
    // Log parameters for debugging (will be replaced with proper implementation)
    this.logger.debug(
      `Calculating next run for cron: ${cronExpr} in ${timezone}`,
    );
    const now = new Date();
    return new Date(now.getTime() + 60000);
  }

  // ==================== Stats & Health ====================

  /**
   * Get job queue statistics
   */
  async getStats(storeId?: string): Promise<JobQueueStats> {
    const where = storeId ? { storeId } : {};

    const [pending, queued, processing, completed, failed, cancelled, total] =
      await Promise.all([
        (this.prisma as any).backgroundJob.count({
          where: { ...where, status: JobStatus.PENDING },
        }),
        (this.prisma as any).backgroundJob.count({
          where: { ...where, status: JobStatus.QUEUED },
        }),
        (this.prisma as any).backgroundJob.count({
          where: { ...where, status: JobStatus.PROCESSING },
        }),
        (this.prisma as any).backgroundJob.count({
          where: { ...where, status: JobStatus.COMPLETED },
        }),
        (this.prisma as any).backgroundJob.count({
          where: { ...where, status: JobStatus.FAILED },
        }),
        (this.prisma as any).backgroundJob.count({
          where: { ...where, status: JobStatus.CANCELLED },
        }),
        (this.prisma as any).backgroundJob.count({ where }),
      ]);

    // Get counts by type
    const byTypeRaw = await (this.prisma as any).backgroundJob.groupBy({
      by: ['type'],
      where,
      _count: true,
    });

    const byType: Record<string, number> = {};
    for (const item of byTypeRaw) {
      byType[item.type] = item._count;
    }

    // Get counts by priority
    const byPriorityRaw = await (this.prisma as any).backgroundJob.groupBy({
      by: ['priority'],
      where,
      _count: true,
    });

    const byPriority: Record<string, number> = {};
    for (const item of byPriorityRaw) {
      byPriority[item.priority] = item._count;
    }

    return {
      pending,
      queued,
      processing,
      completed,
      failed,
      cancelled,
      total,
      byType,
      byPriority,
    };
  }

  /**
   * Get health status of the job queue
   */
  async getHealth(): Promise<JobHealthStatus> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [queueSize, processingCount, failedCount24h] = await Promise.all([
      (this.prisma as any).backgroundJob.count({
        where: {
          status: { in: [JobStatus.PENDING, JobStatus.QUEUED] },
        },
      }),
      (this.prisma as any).backgroundJob.count({
        where: { status: JobStatus.PROCESSING },
      }),
      (this.prisma as any).backgroundJob.count({
        where: {
          status: JobStatus.FAILED,
          completedAt: { gte: last24h },
        },
      }),
    ]);

    // Consider unhealthy if:
    // - Processing is stuck (jobs processing for too long)
    // - Too many failures in last 24h
    const isHealthy = processingCount < 10 && failedCount24h < 50;

    return {
      isHealthy,
      isProcessing: this.isProcessing,
      lastProcessedAt: this.lastProcessedAt,
      queueSize,
      processingCount,
      failedCount24h,
    };
  }

  /**
   * Clean up old completed/failed jobs
   * Runs daily at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanupOldJobs(): Promise<void> {
    if (!this.isTableAvailable) {
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await (this.prisma as any).backgroundJob.deleteMany({
      where: {
        status: {
          in: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED],
        },
        completedAt: { lt: thirtyDaysAgo },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old jobs`);
  }
}

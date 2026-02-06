// Job Queue Types

import { JobType, JobStatus, JobPriority } from './jobs.constants';

export interface BackgroundJob {
  id: string;
  storeId: string | null;
  type: string;
  name: string;
  payload: any;
  result: any;
  status: string;
  priority: string;
  progress: number;
  errorMessage: string | null;
  errorStack: string | null;
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobSchedule {
  id: string;
  storeId: string | null;
  type: string;
  name: string;
  cronExpr: string;
  timezone: string;
  payload: any;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobDto {
  storeId?: string;
  type: JobType;
  name: string;
  payload?: any;
  priority?: JobPriority;
  scheduledFor?: Date;
  maxAttempts?: number;
  createdBy?: string;
}

export interface UpdateJobDto {
  status?: JobStatus;
  progress?: number;
  result?: any;
  errorMessage?: string;
  errorStack?: string;
}

export interface CreateScheduleDto {
  storeId?: string;
  type: JobType;
  name: string;
  cronExpr: string;
  timezone?: string;
  payload?: any;
  isActive?: boolean;
  createdBy?: string;
}

export interface UpdateScheduleDto {
  cronExpr?: string;
  timezone?: string;
  payload?: any;
  isActive?: boolean;
}

export interface JobProcessorContext {
  job: BackgroundJob;
  updateProgress: (progress: number) => Promise<void>;
  log: (message: string) => void;
}

export interface JobProcessorResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface JobQueueStats {
  pending: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface JobHealthStatus {
  isHealthy: boolean;
  isProcessing: boolean;
  lastProcessedAt: Date | null;
  queueSize: number;
  processingCount: number;
  failedCount24h: number;
}

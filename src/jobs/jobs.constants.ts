// Job Queue Constants

export enum JobType {
  DAILY_DIGEST = 'DAILY_DIGEST',
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  ALERT_NOTIFICATION = 'ALERT_NOTIFICATION',
  CLONE_STORE = 'CLONE_STORE',
  CLONE_BRANCH = 'CLONE_BRANCH',
  REPORT_GENERATION = 'REPORT_GENERATION',
  DATA_EXPORT = 'DATA_EXPORT',
  SYNC_CLEANUP = 'SYNC_CLEANUP',
  CUSTOM = 'CUSTOM',
}

export enum JobStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
}

export enum JobPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Priority weights for queue ordering
export const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  [JobPriority.CRITICAL]: 4,
  [JobPriority.HIGH]: 3,
  [JobPriority.NORMAL]: 2,
  [JobPriority.LOW]: 1,
};

// Default job configuration
export const DEFAULT_JOB_CONFIG = {
  maxAttempts: 3,
  retryDelayMs: 60000, // 1 minute
  timeoutMs: 300000, // 5 minutes
  defaultPriority: JobPriority.NORMAL,
};

// Job processing intervals
export const JOB_PROCESSING_INTERVAL_MS = 5000; // Check for new jobs every 5 seconds
export const SCHEDULED_JOB_CHECK_INTERVAL_MS = 60000; // Check scheduled jobs every minute

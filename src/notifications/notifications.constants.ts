// Notification Constants

export enum NotificationType {
  DAILY_DIGEST = 'DAILY_DIGEST',
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  LOSS_PREVENTION_ALERT = 'LOSS_PREVENTION_ALERT',
  DEVICE_OFFLINE = 'DEVICE_OFFLINE',
  SYNC_FAILURE = 'SYNC_FAILURE',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
}

// Default notification settings
export const DEFAULT_NOTIFICATION_CONFIG = {
  retryAttempts: 3,
  retryDelayMs: 60000, // 1 minute
  batchSize: 50, // Max notifications per batch
  dailyDigestHour: 20, // 8 PM
  weeklyDigestDay: 1, // Monday
  defaultTimezone: 'Asia/Manila',
};

// Email templates
export const EMAIL_TEMPLATES = {
  DAILY_DIGEST: 'daily-digest',
  WEEKLY_SUMMARY: 'weekly-summary',
  LOSS_PREVENTION_ALERT: 'loss-prevention-alert',
  DEVICE_OFFLINE: 'device-offline',
  SYNC_FAILURE: 'sync-failure',
  SYSTEM_ALERT: 'system-alert',
};

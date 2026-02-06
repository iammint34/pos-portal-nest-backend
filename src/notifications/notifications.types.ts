// Notification Types

import {
  NotificationType,
  NotificationChannel,
} from './notifications.constants';

export interface NotificationPreference {
  id: string;
  storeId: string;
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  dailyDigest: boolean;
  weeklySummary: boolean;
  alertsEnabled: boolean;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLog {
  id: string;
  storeId: string;
  userId: string | null;
  type: string;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface NotificationSchedule {
  id: string;
  storeId: string;
  type: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendNotificationDto {
  storeId: string;
  userId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
  data?: Record<string, any>;
}

export interface SendEmailDto {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendSmsDto {
  to: string;
  message: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface CreatePreferenceDto {
  storeId: string;
  userId: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  dailyDigest?: boolean;
  weeklySummary?: boolean;
  alertsEnabled?: boolean;
  email?: string;
  phone?: string;
}

export interface UpdatePreferenceDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  dailyDigest?: boolean;
  weeklySummary?: boolean;
  alertsEnabled?: boolean;
  email?: string;
  phone?: string;
}

export interface DigestData {
  storeId: string;
  storeName: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSales: number;
    orderCount: number;
    averageOrderValue: number;
    topSellingItems: Array<{
      name: string;
      quantity: number;
      revenue: number;
    }>;
  };
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    createdAt: Date;
  }>;
  deviceStatus: {
    online: number;
    offline: number;
    total: number;
  };
}

export interface AlertNotificationData {
  storeId: string;
  storeName: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

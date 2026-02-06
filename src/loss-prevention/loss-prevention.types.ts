// Loss Prevention Types

import {
  LossPreventionMetricType,
  LossPreventionTimeWindow,
  LossPreventionScope,
  IncidentStatus,
  AlertSeverity,
} from './loss-prevention.constants';

export interface LossPreventionThreshold {
  id: string;
  storeId: string;
  metricType: string;
  threshold: number;
  timeWindow: string;
  scope: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LossPreventionIncident {
  id: string;
  storeId: string;
  branchId: string;
  staffId: string | null;
  posDeviceId: string | null;
  metricType: string;
  actualValue: number;
  thresholdValue: number;
  timeWindow: string;
  transactions: string[];
  status: string;
  severity: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateThresholdDto {
  storeId: string;
  metricType: LossPreventionMetricType;
  threshold: number;
  timeWindow: LossPreventionTimeWindow;
  scope: LossPreventionScope;
  enabled?: boolean;
}

export interface UpdateThresholdDto {
  threshold?: number;
  timeWindow?: LossPreventionTimeWindow;
  enabled?: boolean;
}

export interface CreateIncidentDto {
  storeId: string;
  branchId: string;
  staffId?: string;
  posDeviceId?: string;
  metricType: LossPreventionMetricType;
  actualValue: number;
  thresholdValue: number;
  timeWindow: LossPreventionTimeWindow;
  transactions: string[];
  severity?: AlertSeverity;
}

export interface ResolveIncidentDto {
  resolution: string;
}

export interface IncidentFilters {
  storeId: string;
  branchId?: string;
  staffId?: string;
  status?: IncidentStatus;
  metricType?: LossPreventionMetricType;
  severity?: AlertSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IncidentStats {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  escalated: number;
  byMetricType: Record<string, number>;
  bySeverity: Record<string, number>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    count: number;
  }>;
  topOffenders: Array<{
    staffId: string;
    staffName: string;
    incidentCount: number;
  }>;
}

export interface MetricData {
  metricType: LossPreventionMetricType;
  value: number;
  threshold: number;
  isExceeded: boolean;
  percentageOver: number;
  transactions: string[];
}

export interface EvaluationResult {
  storeId: string;
  branchId: string;
  staffId?: string;
  posDeviceId?: string;
  timeWindow: LossPreventionTimeWindow;
  metrics: MetricData[];
  incidents: LossPreventionIncident[];
}

export interface ThresholdWithStats extends LossPreventionThreshold {
  incidentCount: number;
  lastIncidentAt: Date | null;
}

export interface DashboardSummary {
  openIncidents: number;
  criticalIncidents: number;
  recentIncidents: LossPreventionIncident[];
  topMetrics: Array<{
    metricType: string;
    incidentCount: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  riskScore: number; // 0-100
}

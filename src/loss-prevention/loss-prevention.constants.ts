// Loss Prevention Constants

export enum LossPreventionMetricType {
  VOID_COUNT = 'VOID_COUNT',
  VOID_AMOUNT = 'VOID_AMOUNT',
  REFUND_COUNT = 'REFUND_COUNT',
  REFUND_AMOUNT = 'REFUND_AMOUNT',
  DISCOUNT_PERCENTAGE = 'DISCOUNT_PERCENTAGE',
  CONSECUTIVE_VOIDS = 'CONSECUTIVE_VOIDS',
}

export enum LossPreventionTimeWindow {
  SHIFT = 'SHIFT',
  DAY = 'DAY',
  WEEK = 'WEEK',
}

export enum LossPreventionScope {
  STAFF = 'STAFF',
  BRANCH = 'BRANCH',
  DEVICE = 'DEVICE',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

// Default thresholds for new stores
export const DEFAULT_THRESHOLDS: Array<{
  metricType: LossPreventionMetricType;
  threshold: number;
  timeWindow: LossPreventionTimeWindow;
  scope: LossPreventionScope;
}> = [
  // Void thresholds
  {
    metricType: LossPreventionMetricType.VOID_COUNT,
    threshold: 5,
    timeWindow: LossPreventionTimeWindow.SHIFT,
    scope: LossPreventionScope.STAFF,
  },
  {
    metricType: LossPreventionMetricType.VOID_COUNT,
    threshold: 10,
    timeWindow: LossPreventionTimeWindow.DAY,
    scope: LossPreventionScope.BRANCH,
  },
  {
    metricType: LossPreventionMetricType.VOID_AMOUNT,
    threshold: 5000,
    timeWindow: LossPreventionTimeWindow.DAY,
    scope: LossPreventionScope.BRANCH,
  },
  // Refund thresholds
  {
    metricType: LossPreventionMetricType.REFUND_COUNT,
    threshold: 3,
    timeWindow: LossPreventionTimeWindow.SHIFT,
    scope: LossPreventionScope.STAFF,
  },
  {
    metricType: LossPreventionMetricType.REFUND_AMOUNT,
    threshold: 10000,
    timeWindow: LossPreventionTimeWindow.DAY,
    scope: LossPreventionScope.BRANCH,
  },
  // Discount thresholds
  {
    metricType: LossPreventionMetricType.DISCOUNT_PERCENTAGE,
    threshold: 20,
    timeWindow: LossPreventionTimeWindow.DAY,
    scope: LossPreventionScope.BRANCH,
  },
  // Consecutive voids (suspicious pattern)
  {
    metricType: LossPreventionMetricType.CONSECUTIVE_VOIDS,
    threshold: 3,
    timeWindow: LossPreventionTimeWindow.SHIFT,
    scope: LossPreventionScope.STAFF,
  },
];

// Severity thresholds (percentage over base threshold)
export const SEVERITY_MULTIPLIERS = {
  [AlertSeverity.INFO]: 1.0, // At threshold
  [AlertSeverity.WARNING]: 1.5, // 50% over threshold
  [AlertSeverity.CRITICAL]: 2.0, // 100% over threshold
};

// Metric descriptions for UI
export const METRIC_DESCRIPTIONS: Record<LossPreventionMetricType, string> = {
  [LossPreventionMetricType.VOID_COUNT]: 'Number of voided transactions',
  [LossPreventionMetricType.VOID_AMOUNT]: 'Total value of voided transactions',
  [LossPreventionMetricType.REFUND_COUNT]: 'Number of refunds processed',
  [LossPreventionMetricType.REFUND_AMOUNT]: 'Total value of refunds',
  [LossPreventionMetricType.DISCOUNT_PERCENTAGE]:
    'Average discount percentage applied',
  [LossPreventionMetricType.CONSECUTIVE_VOIDS]:
    'Consecutive void transactions by same staff',
};

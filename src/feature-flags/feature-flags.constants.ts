// Feature flag constants
// These map to the FeatureKey enum in Prisma schema

export enum FeatureKey {
  LOSS_PREVENTION = 'LOSS_PREVENTION',
  NOTIFICATIONS = 'NOTIFICATIONS',
  DAILY_DIGEST = 'DAILY_DIGEST',
  STORE_CLONING = 'STORE_CLONING',
  MENU_ANALYTICS = 'MENU_ANALYTICS',
  INCIDENT_TIMELINE = 'INCIDENT_TIMELINE',
  FRANCHISE_CONTROL = 'FRANCHISE_CONTROL',
  POS_RECOVERY = 'POS_RECOVERY',
  SYNC_ASSURANCE = 'SYNC_ASSURANCE',
}

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  [FeatureKey.LOSS_PREVENTION]:
    'Detect abnormal void, refund, and discount patterns',
  [FeatureKey.NOTIFICATIONS]: 'Email and SMS notifications',
  [FeatureKey.DAILY_DIGEST]: 'Daily sales summary email',
  [FeatureKey.STORE_CLONING]: 'One-click store and branch cloning',
  [FeatureKey.MENU_ANALYTICS]: 'Menu engineering and item performance analysis',
  [FeatureKey.INCIDENT_TIMELINE]:
    'Chronological timeline for audits and investigations',
  [FeatureKey.FRANCHISE_CONTROL]:
    'Centralized pricing and configuration enforcement',
  [FeatureKey.POS_RECOVERY]: 'Remote POS device recovery and reassignment',
  [FeatureKey.SYNC_ASSURANCE]: 'Sync reliability monitoring and guarantees',
};

// Features available in each phase
export const PHASE_1_FEATURES = [
  FeatureKey.LOSS_PREVENTION,
  FeatureKey.NOTIFICATIONS,
  FeatureKey.DAILY_DIGEST,
  FeatureKey.STORE_CLONING,
];

export const PHASE_2_FEATURES = [
  FeatureKey.MENU_ANALYTICS,
  FeatureKey.INCIDENT_TIMELINE,
];

export const PHASE_3_FEATURES = [
  FeatureKey.FRANCHISE_CONTROL,
  FeatureKey.POS_RECOVERY,
  FeatureKey.SYNC_ASSURANCE,
];

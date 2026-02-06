// Clone module constants

export enum CloneType {
  STORE = 'STORE',
  BRANCH = 'BRANCH',
}

export enum CloneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

// Elements that can be cloned
export enum CloneableElement {
  ITEMS = 'items',
  CATEGORIES = 'categories',
  ROLES = 'roles',
  ITEM_BRANCHES = 'itemBranches',
  LOSS_PREVENTION_THRESHOLDS = 'lossPreventionThresholds',
  STORE_FEATURES = 'storeFeatures',
}

// Default clone configuration
export const DEFAULT_BRANCH_CLONE_CONFIG = {
  items: true,
  categories: true,
  itemBranches: true,
};

export const DEFAULT_STORE_CLONE_CONFIG = {
  items: true,
  categories: true,
  roles: true,
  lossPreventionThresholds: true,
  storeFeatures: false, // Features should be explicitly enabled
};

// Elements included in each clone type
export const BRANCH_CLONEABLE_ELEMENTS = [CloneableElement.ITEM_BRANCHES];

export const STORE_CLONEABLE_ELEMENTS = [
  CloneableElement.ITEMS,
  CloneableElement.CATEGORIES,
  CloneableElement.ROLES,
  CloneableElement.LOSS_PREVENTION_THRESHOLDS,
  CloneableElement.STORE_FEATURES,
];

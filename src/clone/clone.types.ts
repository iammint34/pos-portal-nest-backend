// Type definitions for Clone module
// These types mirror the Prisma models until the client is regenerated

export interface CloneJob {
  id: string;
  storeId: string;
  type: string;
  sourceId: string;
  targetId: string | null;
  targetName: string;
  config: any;
  status: string;
  errorMessage: string | null;
  createdBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneBranchResult {
  job: CloneJob;
  branch: {
    id: string;
    name: string;
    storeId: string;
    address: string | null;
    phone: string | null;
    status: string;
  };
}

export interface CloneStoreResult {
  job: CloneJob;
  store: {
    id: string;
    name: string;
    type: string;
    status: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
}

export interface RollbackResult {
  message: string;
}

export interface Job {
  id: string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  settings: JobSettings;
  payoutMapping: ColumnMapping;
  ledgerMapping: ColumnMapping;
  payoutFile?: string;
  ledgerFile?: string;
  stats?: {
    totalPayouts: number;
    totalLedger: number;
    matchedCount: number;
    unmatchedCount: number;
    matchRate: number;
    totalUnmatchedAmount: number;
  };
}

export interface TransactionRecord {
  id: string;
  txId?: string; // Add this for transaction ID
  amountCents: number; // Change from 'amount' to 'amountCents' to match your usage
  currency: string;
  timestamp: string;
  fee?: number;
  merchantId?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  // Original data from CSV
  raw: Record<string, unknown>;
}

export interface MatchRecord {
  id: string;
  payoutId: string;
  ledgerId: string;
  score: number;
  breakdown: ScoreBreakdown;
  status: 'matched' | 'review' | 'rejected';
  matchType?: string; // Add this property
  confidenceLevel?: string; // Add this property
  accepted?: number; // Add this property (1 = accepted, -1 = rejected, 0/undefined = pending)
  notes?: string;
  matchedAt: string;
}

export interface Cluster {
  id: string;
  pivotId: string;
  pivotType: 'payout' | 'ledger';
  records: TransactionRecord[];
  amount: number;
  status: 'unmatched' | 'partial' | 'resolved';
  notes?: string;
}


export interface JobSettings {
  amountToleranceCents: number;
  timeWindowHours: number;
  fuzzyThreshold: number;
  tokenBudget: number;
  maxRows: number;
}

export interface ColumnMapping {
  txId?: string;
  amount: string;
  currency?: string;
  timestamp?: string;
  fee?: string;
  merchantId?: string;
  reference?: string;
}

export interface ScoreBreakdown {
  exactMatch: number;
  amountScore: number;
  timeScore: number;
  fuzzyScore: number;
  weights: {
    exact: number;
    amount: number;
    time: number;
    fuzzy: number;
  };
}

// Default settings
export const defaultSettings: JobSettings = {
  amountToleranceCents: 100,
  timeWindowHours: 48,
  fuzzyThreshold: 85,
  tokenBudget: 2000,
  maxRows: 10000,
};

// API response types
export interface JobResultsResponse {
  job: Job;
  stats: {
    totalPayouts: number;
    totalLedger: number;
    matchedCount: number;
    unmatchedCount: number;
    matchRate: number;
    totalUnmatchedAmount: number;
  };
  matches: (MatchRecord & {
    payout: TransactionRecord;
    ledger: TransactionRecord;
  })[];
  unmatchedPayouts: TransactionRecord[];
  unmatchedLedger: TransactionRecord[];
  clusters: Cluster[];
}

export interface UploadResponse {
  jobId: string;
  status: string;
  payoutColumns?: string[];
  ledgerColumns?: string[];
  payoutPreview?: Record<string, unknown>[];
  ledgerPreview?: Record<string, unknown>[];
}

export interface StartJobRequest {
  jobId: string;
  payoutMapping: ColumnMapping;
  ledgerMapping: ColumnMapping;
  settings?: Partial<JobSettings>;
}

export interface JobStatusResponse {
  status: string;
  progress: number;
  matchRate?: number;
  errorMessage?: string;
}
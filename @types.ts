// ============ CORE TYPES ============

export interface Job {
  currency: string;
  id: string;
  name: string; // Changed from optional to required
  status: "pending" | "processing" | "completed" | "failed" | "uploaded";
  created_at: string;
  updated_at: string;
  settings: JobSettings;
  payout_mapping: ColumnMapping;
  ledger_mapping: ColumnMapping;
  payout_filename?: string;
  ledger_filename?: string;
  payout_row_count?: number;
  ledger_row_count?: number;
  progress?: number;
  match_rate?: number;
  total_unmatched_amount_cents?: number;
  error_message?: string;
  matched_count?: number;
  unmatched_count?: number;
  completed_at?: string;
  // Optional computed stats (not in database)
  stats?: {
    total_payouts: number;
    total_ledger: number;
    matched_count: number;
    unmatched_count: number;
    match_rate: number;
    total_unmatched_amount: number;
  };
}

export interface TransactionRecord {
  id: string;
  job_id: string;
  source: "payout" | "ledger";
  source_filename: string;
  row_index: number;
  tx_id?: string;
  amount_cents: number;
  currency: string;
  timestamp: string;
  fee_cents?: number;
  merchant_id?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  normalized_fields?: Record<string, unknown>;
  raw: {
    status?: string 
    type?: string
  }
  created_at?: string;

}

export interface MatchRecord {
  id: string;
  job_id: string;
  payout_id: string;
  ledger_id: string;
  score: number;
  breakdown: ScoreBreakdown;
  status: "matched" | "review" | "rejected";
  match_type?: string;
  confidence_level?: string;
  accepted?: number;
  notes?: string;
  matched_at: string;
  updated_at?: string;
  created_at?: string; // Added for compatibility
}

export interface Cluster {

  id: string;
  job_id: string;
  pivot_id: string;
  pivot_type: "payout" | "ledger";
  records: TransactionRecord[];
  evidence_ids?: string[];
  amount: number;
  status: "unmatched" | "partial" | "resolved" | "fee" | "failed" | "reversed";
  notes?: string;
  merchant_name?: string;
  amount_bucket?: string;
  date_bucket?: string;
  total_amount_cents?: number;
  size?: number;
  llm_summary?: string;
  suggested_action?: string;
  confidence_level?: string;
  token_usage?: number;
  llm_confidence?: string;
  created_at?: string;
}

// ============ PAGINATION TYPES ============

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TransactionsPaginationInfo {
  page: number;
  limit: number;
  total_payouts: number;
  total_ledger: number;
  pages_payouts: number;
  pages_ledger: number;
}

// ============ SETTINGS & MAPPING TYPES ============

export interface JobSettings {
  amount_tolerance_cents: number;
  time_window_hours: number;
  fuzzy_threshold: number;
  token_budget: number;
  max_rows: number;
}

export interface ColumnMapping {
  tx_id?: string;
  amount: string;
  currency?: string;
  timestamp?: string;
  fee?: string;
  merchant_id?: string;
  reference?: string;
}

export interface ScoreBreakdown {
  exact_match: number;
  amount_score: number;
  time_score: number;
  fuzzy_score: number;
  weights: {
    exact: number;
    amount: number;
    time: number;
    fuzzy: number;
  };
}

// ============ DEFAULT SETTINGS ============

export const defaultSettings: JobSettings = {
  amount_tolerance_cents: 100,
  time_window_hours: 48,
  fuzzy_threshold: 85,
  token_budget: 2000,
  max_rows: 10000,
};

// ============ API RESPONSE TYPES ============

export interface JobResultsResponse {
  job: Job;
  stats: {
    currency: string;
    total_payouts: number;
    total_ledger: number;
    matched_count: number;
    unmatched_count: number;
    match_rate: number;
    total_unmatched_amount: number;
  };
  matches: (MatchRecord & {
    payout: TransactionRecord;
    ledger: TransactionRecord;
  })[];
  unmatched_payouts: TransactionRecord[];
  unmatched_ledger: TransactionRecord[];
  clusters: Cluster[];
  pagination: {
    matches: PaginationInfo;
    transactions: TransactionsPaginationInfo;
    clusters: PaginationInfo;
  };
}

export interface UploadResponse {
  job_id: string;
  status: string;
  payout_columns?: string[];
  ledger_columns?: string[];
  payout_preview?: Record<string, unknown>[];
  ledger_preview?: Record<string, unknown>[];
  currency? : string
}

export interface StartJobRequest {
  job_id: string;
  payout_mapping: ColumnMapping;
  ledger_mapping: ColumnMapping;
  settings?: Partial<JobSettings>;
}

export interface JobStatusResponse {
  job_id: string;
  status: string;
  progress: number;
  match_rate?: number;
  error_message?: string;
  matched_count?: number;
  unmatched_count?: number;
  updated_at: string;
  completed_at?: string;
}

// ============ DATABASE TYPES ============

export type InsertJob = Omit<Job, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type InsertTransactionRecord = Omit<TransactionRecord, "id"> & {
  id?: string;
};

export type InsertMatchRecord = Omit<MatchRecord, "id" | "matched_at"> & {
  id?: string;
  matched_at?: string;
};

export type InsertCluster = Omit<Cluster, "id"> & {
  id?: string;
};

export interface AuditLog {
  id: string;
  job_id: string;
  action: string;
  details?: Record<string, unknown>;
  target_id?: string;
  target_type?: string;
  timestamp: string;
}

export type InsertAuditLog = Omit<AuditLog, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

// ============ STORAGE INTERFACE ============

export interface IStorage {
  // Jobs
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;

  // Transaction Records
  createTransactionRecord(
    record: InsertTransactionRecord
  ): Promise<TransactionRecord>;
  createTransactionRecords(
    records: InsertTransactionRecord[]
  ): Promise<TransactionRecord[]>;
  getTransactionsByJob(job_id: string): Promise<TransactionRecord[]>;
  getTransactionsByJobAndSource(
    job_id: string,
    source: "payout" | "ledger"
  ): Promise<TransactionRecord[]>;
  
  // Paginated transaction methods
  getUnmatchedTransactions(
    job_id: string,
    source: "payout" | "ledger",
    matched_ids: string[]
  ): Promise<TransactionRecord[]>;
  
  getUnmatchedTransactionsPaginated(
    job_id: string,
    source: "payout" | "ledger",
    matched_ids: string[],
    limit?: number,
    offset?: number,
    searchQuery?: string
  ): Promise<TransactionRecord[]>;
  
  getUnmatchedTransactionsCount(
    job_id: string,
    source: "payout" | "ledger",
    matched_ids: string[],
    searchQuery?: string
  ): Promise<number>;
  
  getTransactionById(id: string): Promise<TransactionRecord | undefined>;

  // Match Records
  createMatchRecord(record: InsertMatchRecord): Promise<MatchRecord>;
  createMatchRecords(records: InsertMatchRecord[]): Promise<MatchRecord[]>;
  getMatchesByJob(job_id: string): Promise<MatchRecord[]>;
  
  // Paginated match methods
  getMatchesByJobPaginated(
    job_id: string,
    limit?: number,
    offset?: number,
    searchQuery?: string
  ): Promise<MatchRecord[]>;
  
  getMatchesCount(
    job_id: string,
    searchQuery?: string
  ): Promise<number>;
  
  getMatchById(id: string): Promise<MatchRecord | undefined>;
  updateMatch(
    id: string,
    updates: Partial<MatchRecord>
  ): Promise<MatchRecord | undefined>;
  getMatchWithTransactions(
    id: string
  ): Promise<
    | (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })
    | undefined
  >;
  getMatchesWithTransactions(
    job_id: string
  ): Promise<
    (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })[]
  >;
  
  getMatchesWithTransactionsPaginated(
    job_id: string,
    limit?: number,
    offset?: number,
    searchQuery?: string
  ): Promise<
    (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })[]
  >;

  // Clusters
  createCluster(cluster: InsertCluster): Promise<Cluster>;
  createClusters(clusterData: InsertCluster[]): Promise<Cluster[]>;
  getClustersByJob(job_id: string): Promise<Cluster[]>;
  
  // Paginated cluster methods
  getClustersByJobPaginated(
    job_id: string,
    limit?: number,
    offset?: number
  ): Promise<Cluster[]>;
  
  getClustersCount(job_id: string): Promise<number>;
  
  getClusterById(id: string): Promise<Cluster | undefined>;
  updateCluster(
    id: string,
    updates: Partial<Cluster>
  ): Promise<Cluster | undefined>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByJob(job_id: string): Promise<AuditLog[]>;
}

// ============ CLUSTER DATA TYPES (for processing) ============

export interface ClusterData {
  pivot_id: string;
  pivot_type: "payout" | "ledger";
  records: TransactionRecord[];
  amount: number;
  status: "unmatched" | "partial" | "resolved";
  notes?: string;
  merchant_name : string
}

// ============ API RESPONSE TYPES ============

export interface JobSummaryResponse {
  job: {
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'uploaded';
    created_at: string;
    updated_at: string;
    currency: string;
  };
  stats: {
    total_payouts: number;
    total_ledger: number;
    matched_count: number;
    unmatched_count: number;
    match_rate: number;
    total_unmatched_amount: number;
    currency: string;
  };
}

export interface PaginatedMatchesResponse {
  matches: (MatchRecord & {
    payout: TransactionRecord;
    ledger: TransactionRecord;
  })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============ MATCH RESULT TYPES (for matching engine) ============

export interface MatchResult {
  payout_id: string;
  ledger_id: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  match_type: string;
  confidence_level: string;
}

// ============ COMPATIBILITY TYPES ============

// These types are for compatibility with existing code that might expect them
export interface Transaction {
  id: string;
  transaction_id: string;
  amount_cents: number;
  description: string;
  date: string;
  // Add other transaction properties
}

// Legacy Match type for compatibility
export interface Match {
  id: string;
  job_id: string;
  payout_id: string;
  ledger_id: string;
  match_score: number;
  score?: number;
  created_at: string;
  matched_at?: string;
  payout?: TransactionRecord;
  ledger?: TransactionRecord;
}

// In your @/@types file (probably types/index.ts or similar)

// Just update the PaginatedClustersResponse to use Cluster instead of ClusterRecord
export interface PaginatedClustersResponse {
  clusters: Cluster[];  // Use Cluster type (which already exists)
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
// Also make sure you have the ClusterRecord type defined:
export interface ClusterRecord {
  id: string;
  job_id: string;
  pivot_id: string;
  pivot_type: 'payout' | 'ledger';
  records: any[];  // Or a more specific TransactionRecord[] type
  amount: number;  // Might be amount_cents
  status: 'pending' | 'reviewed' | 'resolved' | 'ignored';
  notes?: string;
  created_at: string;
  updated_at?: string;
  pattern_type?: string;
  llm_summary?: string;
  suggested_action?: string;
  llm_confidence?: number;
  token_usage?: number;
  evidence_ids?: string[];  // If you're storing evidence transaction IDs
}

// If you need to extend or create a separate InsertClusterRecord type:
export interface InsertClusterRecord {
  job_id: string;
  pivot_id: string;
  pivot_type: 'payout' | 'ledger';
  records: any[];
  amount: number;
  status: string;
  notes?: string;
  created_at?: string;
  pattern_type?: string;
  evidence_ids?: string[];
}
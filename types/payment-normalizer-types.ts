// @/@types/payment-normalizer.ts
// Add these types to your existing @/@types/index.ts file

export interface PaymentBatch {
  id: string;
  job_id?: string;
  name: string;
  mode: 'PROOFS_ONLY' | 'PAYMENTS_CSV' | 'HYBRID';
  client_id?: string;
  uploaded_by?: string;
  status: 'processing' | 'ready' | 'reviewing' | 'committed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface BatchFile {
  id: string;
  batch_id: string;
  filename: string;
  file_type: 'bank_csv' | 'vendor_csv' | 'pdf_proof' | 'image_proof';
  storage_path: string;
  uploaded_by?: string;
  created_at: string;
}

export interface ProofRecord {
  id: string;
  batch_id: string;
  batch_file_id?: string;
  extracted_payer?: string;
  extracted_account?: string;
  extracted_amount?: number;
  extracted_currency?: string;
  extracted_date?: string;
  narration?: string;
  ocr_confidence?: number;
  file_hash?: string;
  created_at: string;
}

export interface AllocationCandidate {
  target_invoice_id: string;
  allocated_amount: number;
  confidence: number;
  reason: string;
}

export interface PaymentEvent {
  id: string;
  batch_id: string;
  source_proof_ids: string[];
  csv_row_id?: string;
  payer_account?: string;
  payer_name?: string;
  received_amount?: number;
  received_currency?: string;
  received_date?: string;
  gross_amount?: number;
  net_amount?: number;
    discrepancy_explanation?: Record<string, any>; // or use a more specific type
  has_anomalies?: boolean;
  status: 'pending' | 'suggested' | 'normalized' | 'committed';
  suggested_allocations: AllocationCandidate[];
  created_at: string;
  updated_at: string;
}

export interface Allocation {
  id: string;
  payment_event_id: string;
  target_invoice_id?: string;
  allocated_amount: number;
  allocation_reason?: string;
  template_id?: string;
  created_by?: string;
  created_at: string;
}

export interface Deduction {
  id: string;
  payment_event_id: string;
  type: 'withholding' | 'bank_fee' | 'tax' | 'penalty' | 'other';
  amount: number;
  tax_code?: string;
  proof_id?: string;
  created_at: string;
}

export interface PNTemplate {
  id: string;
  client_id?: string;
  name: string;
  rules: Record<string, any>;
  last_used_at?: string;
  created_at?: string;
}

export interface PNAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  action: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  timestamp: string;
}

// Insert types
export type InsertPaymentBatch = Omit<PaymentBatch, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type InsertBatchFile = Omit<BatchFile, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InsertProofRecord = Omit<ProofRecord, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InsertPaymentEvent = Omit<PaymentEvent, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type InsertAllocation = Omit<Allocation, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InsertDeduction = Omit<Deduction, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InsertPNTemplate = Omit<PNTemplate, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type InsertPNAuditLog = Omit<PNAuditLog, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

// API Response Types
// export interface BatchStatusResponse {
//   batch: PaymentBatch;
//   stats: {
//     total_invoices: number;
//     paid_invoices: number;
//     partially_paid_invoices: number;
//     unpaid_invoices: number;
//     total_files: number;
//     total_proofs: number;
//     total_events: number;
//     pending_events: number;
//     normalized_events: number;
//     committed_events: number;
//   };
// }

export interface PaymentEventDetailResponse {
  event: PaymentEvent;
  proofs: ProofRecord[];
  allocations: Allocation[];
  deductions: Deduction[];
  audit_logs: PNAuditLog[];
}

export interface BatchListResponse {
  batches: PaymentBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaymentEventsListResponse {
  events: PaymentEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Add these types to your @/@types/payment-normalizer.ts or index.ts

export interface InvoiceRecord {
  id: string;
  batch_id: string;
  invoice_id: string; // The actual invoice number
  invoice_date?: string;
  due_date?: string;
  customer_name?: string;
  customer_id?: string;
  amount_due: number;
  currency: string;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overpaid' | 'disputed';
  amount_paid: number;
  amount_remaining?: number;
  payment_terms?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface InvoicePaymentLink {
  id: string;
  invoice_id: string;
  payment_event_id: string;
  allocation_id: string;
  amount_applied: number;
  applied_at: string;
}

export type InsertInvoiceRecord = Omit<InvoiceRecord, 'id' | 'created_at' | 'updated_at' | 'amount_paid' | 'amount_remaining'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  amount_paid?: number;
  amount_remaining?: number;
};

export type InsertInvoicePaymentLink = Omit<InvoicePaymentLink, 'id' | 'applied_at'> & {
  id?: string;
  applied_at?: string;
};

// Update AllocationCandidate to include more matching details
export interface AllocationCandidate {
  target_invoice_id: string;
  invoice_record_id?: string; // Link to invoice_records table
  allocated_amount: number;
  confidence: number;
  reason: string;
  match_type?: 'exact_invoice_id' | 'amount_match' | 'customer_match' | 'partial_match' | 'manual';
  invoice_amount_due?: number;
  customer_name?: string;
}

// Update PaymentEvent to include match status
export interface PaymentEvent {
  id: string;
  batch_id: string;
  source_proof_ids: string[];
  csv_row_id?: string;
  payer_account?: string;
  payer_name?: string;
  received_amount?: number;
  received_currency?: string;
  received_date?: string;
  gross_amount?: number;
  net_amount?: number;
  status: 'pending' | 'suggested' | 'normalized' | 'committed';
  match_status?: 'unmatched' | 'partial_match' | 'full_match' | 'overpayment';
  matched_invoice_ids?: string[];
  discrepancy_amount?: number;
  suggested_allocations: AllocationCandidate[];
  created_at: string;
  updated_at: string;
}

// Invoice upload response
export interface InvoiceUploadResponse {
  batch_id: string;
  invoices_imported: number;
  invoices: InvoiceRecord[];
}

// Enhanced batch status to include invoice stats
export interface BatchStatusResponse {
  batch: PaymentBatch;
  stats: {
    total_files: number;
    total_proofs: number;
    total_events: number;
    pending_events: number;
    normalized_events: number;
    committed_events: number;
    // Invoice stats
    total_invoices: number;
    paid_invoices: number;
    partially_paid_invoices: number;
    unpaid_invoices: number;
    total_invoice_amount: number;
    total_paid_amount: number;
    total_outstanding_amount: number;
  };
}
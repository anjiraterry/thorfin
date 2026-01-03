


import { InsertPaymentBatch, PaymentBatch, InsertBatchFile, BatchFile, InsertProofRecord, ProofRecord, InsertPaymentEvent, PaymentEvent, InsertAllocation, Allocation, InsertDeduction, Deduction, InsertPNTemplate, PNTemplate, InsertPNAuditLog, PNAuditLog } from '@/types/payment-normalizer-types';
import { createClient } from '../supabase/server';
import type {
  InvoiceRecord,
  InsertInvoiceRecord,
  InvoicePaymentLink,
  InsertInvoicePaymentLink,
} from '@/types/payment-normalizer-types';



export class PaymentNormalizerStorage {
  // ============ BATCHES ============
  async createBatch(batch: InsertPaymentBatch): Promise<PaymentBatch> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_batches')
      .insert(batch)
      .select()
      .single();
    
    if (error) throw error;
    return data as PaymentBatch;
  }

  async getBatch(id: string): Promise<PaymentBatch | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_batches')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data as PaymentBatch;
  }

  async updateBatch(id: string, updates: Partial<PaymentBatch>): Promise<PaymentBatch | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_batches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) return undefined;
    return data as PaymentBatch;
  }

  async listBatches(limit = 20, offset = 0): Promise<PaymentBatch[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) return [];
    return data as PaymentBatch[];
  }

  async getBatchesCount(): Promise<number> {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('payment_batches')
      .select('id', { count: 'exact', head: true });
    
    if (error) return 0;
    return count || 0;
  }

  // ============ BATCH FILES ============
  async createBatchFile(file: InsertBatchFile): Promise<BatchFile> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('batch_files')
      .insert(file)
      .select()
      .single();
    
    if (error) throw error;
    return data as BatchFile;
  }

  async getBatchFiles(batchId: string): Promise<BatchFile[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('batch_files')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    
    if (error) return [];
    return data as BatchFile[];
  }

  async getBatchFile(id: string): Promise<BatchFile | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('batch_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data as BatchFile;
  }

  // ============ PROOF RECORDS ============
  async createProofRecord(proof: InsertProofRecord): Promise<ProofRecord> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('proof_records')
      .insert(proof)
      .select()
      .single();
    
    if (error) throw error;
    return data as ProofRecord;
  }

  async createProofRecords(proofs: InsertProofRecord[]): Promise<ProofRecord[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('proof_records')
      .insert(proofs)
      .select();
    
    if (error) throw error;
    return data as ProofRecord[];
  }

  async getProofsByBatch(batchId: string): Promise<ProofRecord[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('proof_records')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data as ProofRecord[];
  }

  async getProofsByIds(ids: string[]): Promise<ProofRecord[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('proof_records')
      .select('*')
      .in('id', ids);
    
    if (error) return [];
    return data as ProofRecord[];
  }

  // ============ PAYMENT EVENTS ============
  async createPaymentEvent(event: InsertPaymentEvent): Promise<PaymentEvent> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_events')
      .insert(event)
      .select()
      .single();
    
    if (error) throw error;
    return data as PaymentEvent;
  }

  async createPaymentEvents(events: InsertPaymentEvent[]): Promise<PaymentEvent[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_events')
      .insert(events)
      .select();
    
    if (error) throw error;
    return data as PaymentEvent[];
  }

  async getPaymentEvent(id: string): Promise<PaymentEvent | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_events')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data as PaymentEvent;
  }

  async updatePaymentEvent(id: string, updates: Partial<PaymentEvent>): Promise<PaymentEvent | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) return undefined;
    return data as PaymentEvent;
  }

  async getPaymentEventsByBatch(
    batchId: string,
    status?: string,
    limit = 20,
    offset = 0
  ): Promise<PaymentEvent[]> {
    const supabase = await createClient();
    let query = supabase
      .from('payment_events')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    query = query.range(offset, offset + limit - 1);
    
    const { data, error } = await query;
    
    if (error) return [];
    return data as PaymentEvent[];
  }

  async getPaymentEventsCount(batchId: string, status?: string): Promise<number> {
    const supabase = await createClient();
    let query = supabase
      .from('payment_events')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { count, error } = await query;
    
    if (error) return 0;
    return count || 0;
  }

  // ============ ALLOCATIONS ============
  async createAllocation(allocation: InsertAllocation): Promise<Allocation> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('allocations')
      .insert(allocation)
      .select()
      .single();
    
    if (error) throw error;
    return data as Allocation;
  }

  async createAllocations(allocations: InsertAllocation[]): Promise<Allocation[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('allocations')
      .insert(allocations)
      .select();
    
    if (error) throw error;
    return data as Allocation[];
  }

  async getAllocationsByPaymentEvent(paymentEventId: string): Promise<Allocation[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('allocations')
      .select('*')
      .eq('payment_event_id', paymentEventId)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data as Allocation[];
  }

  // ============ DEDUCTIONS ============
  async createDeduction(deduction: InsertDeduction): Promise<Deduction> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('deductions')
      .insert(deduction)
      .select()
      .single();
    
    if (error) throw error;
    return data as Deduction;
  }

  async createDeductions(deductions: InsertDeduction[]): Promise<Deduction[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('deductions')
      .insert(deductions)
      .select();
    
    if (error) throw error;
    return data as Deduction[];
  }

  async getDeductionsByPaymentEvent(paymentEventId: string): Promise<Deduction[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('deductions')
      .select('*')
      .eq('payment_event_id', paymentEventId)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data as Deduction[];
  }

  // ============ TEMPLATES ============
  async createTemplate(template: InsertPNTemplate): Promise<PNTemplate> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('pn_templates')
      .insert(template)
      .select()
      .single();
    
    if (error) throw error;
    return data as PNTemplate;
  }

  async getTemplates(clientId?: string): Promise<PNTemplate[]> {
    const supabase = await createClient();
    let query = supabase
      .from('pn_templates')
      .select('*')
      .order('last_used_at', { ascending: false, nullsFirst: false });
    
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    
    const { data, error } = await query;
    
    if (error) return [];
    return data as PNTemplate[];
  }

  async updateTemplate(id: string, updates: Partial<PNTemplate>): Promise<PNTemplate | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('pn_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) return undefined;
    return data as PNTemplate;
  }

  // ============ AUDIT LOGS ============
  async createAuditLog(log: InsertPNAuditLog): Promise<PNAuditLog> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_normalizer_audit')
      .insert(log)
      .select()
      .single();
    
    if (error) throw error;
    return data as PNAuditLog;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<PNAuditLog[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_normalizer_audit')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('timestamp', { ascending: false });
    
    if (error) return [];
    return data as PNAuditLog[];
  }

  // ============ INVOICE RECORDS ============
  async createInvoiceRecord(invoice: InsertInvoiceRecord): Promise<InvoiceRecord> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_records')
      .insert(invoice)
      .select()
      .single();
    
    if (error) throw error;
    return data as InvoiceRecord;
  }

  async createInvoiceRecords(invoices: InsertInvoiceRecord[]): Promise<InvoiceRecord[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_records')
      .insert(invoices)
      .select();
    
    if (error) throw error;
    return data as InvoiceRecord[];
  }

  async getInvoicesByBatch(batchId: string, limit = 100, offset = 0): Promise<InvoiceRecord[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_records')
      .select('*')
      .eq('batch_id', batchId)
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) return [];
    return data as InvoiceRecord[];
  }

  async getInvoiceByInvoiceId(batchId: string, invoiceId: string): Promise<InvoiceRecord | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_records')
      .select('*')
      .eq('batch_id', batchId)
      .eq('invoice_id', invoiceId)
      .single();
    
    if (error) return undefined;
    return data as InvoiceRecord;
  }

  async searchInvoices(
    batchId: string,
    query: {
      invoice_id?: string;
      customer_name?: string;
      amount?: number;
      status?: string;
    }
  ): Promise<InvoiceRecord[]> {
    const supabase = await createClient();
    let dbQuery = supabase
      .from('invoice_records')
      .select('*')
      .eq('batch_id', batchId);

    if (query.invoice_id) {
      dbQuery = dbQuery.ilike('invoice_id', `%${query.invoice_id}%`);
    }
    if (query.customer_name) {
      dbQuery = dbQuery.ilike('customer_name', `%${query.customer_name}%`);
    }
    if (query.amount) {
      // Match within 1% tolerance
      const tolerance = query.amount * 0.01;
      dbQuery = dbQuery
        .gte('amount_due', query.amount - tolerance)
        .lte('amount_due', query.amount + tolerance);
    }
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, error } = await dbQuery.limit(20);
    
    if (error) return [];
    return data as InvoiceRecord[];
  }

  async getInvoiceStats(batchId: string): Promise<{
    total_invoices: number;
    paid_invoices: number;
    partially_paid_invoices: number;
    unpaid_invoices: number;
    total_invoice_amount: number;
    total_paid_amount: number;
    total_outstanding_amount: number;
  }> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('invoice_records')
      .select('status, amount_due, amount_paid')
      .eq('batch_id', batchId);

    if (error || !data) {
      return {
        total_invoices: 0,
        paid_invoices: 0,
        partially_paid_invoices: 0,
        unpaid_invoices: 0,
        total_invoice_amount: 0,
        total_paid_amount: 0,
        total_outstanding_amount: 0,
      };
    }

    const stats = data.reduce(
      (acc, inv) => {
        acc.total_invoices++;
        acc.total_invoice_amount += inv.amount_due || 0;
        acc.total_paid_amount += inv.amount_paid || 0;
        
        if (inv.status === 'paid') acc.paid_invoices++;
        else if (inv.status === 'partially_paid') acc.partially_paid_invoices++;
        else if (inv.status === 'unpaid') acc.unpaid_invoices++;
        
        return acc;
      },
      {
        total_invoices: 0,
        paid_invoices: 0,
        partially_paid_invoices: 0,
        unpaid_invoices: 0,
        total_invoice_amount: 0,
        total_paid_amount: 0,
        total_outstanding_amount: 0,
      }
    );

    stats.total_outstanding_amount = stats.total_invoice_amount - stats.total_paid_amount;

    return stats;
  }

  async updateInvoiceRecord(id: string, updates: Partial<InvoiceRecord>): Promise<InvoiceRecord | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) return undefined;
    return data as InvoiceRecord;
  }

  // ============ INVOICE-PAYMENT LINKS ============
  async createInvoicePaymentLink(link: InsertInvoicePaymentLink): Promise<InvoicePaymentLink> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_payment_links')
      .insert(link)
      .select()
      .single();
    
    if (error) throw error;
    return data as InvoicePaymentLink;
  }

  async createInvoicePaymentLinks(links: InsertInvoicePaymentLink[]): Promise<InvoicePaymentLink[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_payment_links')
      .insert(links)
      .select();
    
    if (error) throw error;
    return data as InvoicePaymentLink[];
  }

  async getInvoicePaymentLinks(paymentEventId: string): Promise<(InvoicePaymentLink & { invoice: InvoiceRecord })[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_payment_links')
      .select(`
        *,
        invoice:invoice_records(*)
      `)
      .eq('payment_event_id', paymentEventId);
    
    if (error) return [];
    return data as any[];
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<(InvoicePaymentLink & { payment: PaymentEvent })[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('invoice_payment_links')
      .select(`
        *,
        payment:payment_events(*)
      `)
      .eq('invoice_id', invoiceId);
    
    if (error) return [];
    return data as any[];
  }
}

export const pnStorage = new PaymentNormalizerStorage();
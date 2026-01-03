// lib/anomaly-detection.ts
// Detects payment anomalies (duplicates, one-to-many, many-to-one)

import type { PaymentEvent, ProofRecord, InvoiceRecord, Allocation } from '@/types/payment-normalizer-types';

export interface Anomaly {
  type: 'duplicate_payment' | 'duplicate_proof' | 'one_payment_many_invoices' | 'many_payments_one_invoice' | 'timing_anomaly';
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  description: string;
  affected_entities: {
    payment_event_ids?: string[];
    invoice_ids?: string[];
    proof_ids?: string[];
  };
  suggested_action: string;
}

/**
 * Detects duplicate payments based on multiple criteria
 */
export function detectDuplicatePayments(
  payments: PaymentEvent[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const seen = new Map<string, PaymentEvent>();

  for (const payment of payments) {
    // Create fingerprint: payer + amount + date (ignoring time)
    const dateStr = payment.received_date?.split('T')[0] || '';
    const fingerprint = `${payment.payer_name?.toLowerCase()}_${payment.received_amount}_${dateStr}`;

    if (seen.has(fingerprint)) {
      const duplicate = seen.get(fingerprint)!;
      anomalies.push({
        type: 'duplicate_payment',
        severity: 'critical',
        confidence: 90,
        description: `Potential duplicate payment detected: ${payment.payer_name} paid ${payment.received_amount} on ${dateStr}. This appears twice in the batch.`,
        affected_entities: {
          payment_event_ids: [duplicate.id, payment.id],
        },
        suggested_action: 'Review both payments. If duplicate, mark one as invalid and do not allocate.',
      });
    } else {
      seen.set(fingerprint, payment);
    }
  }

  return anomalies;
}

/**
 * Detects duplicate proof uploads via file hash
 */
export function detectDuplicateProofs(
  proofs: ProofRecord[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const hashMap = new Map<string, ProofRecord[]>();

  for (const proof of proofs) {
    if (!proof.file_hash) continue;

    if (!hashMap.has(proof.file_hash)) {
      hashMap.set(proof.file_hash, []);
    }
    hashMap.get(proof.file_hash)!.push(proof);
  }

  for (const [hash, duplicates] of hashMap) {
    if (duplicates.length > 1) {
      anomalies.push({
        type: 'duplicate_proof',
        severity: 'warning',
        confidence: 100,
        description: `Same proof file uploaded ${duplicates.length} times. Files: ${duplicates.map(p => p.id).join(', ')}`,
        affected_entities: {
          proof_ids: duplicates.map(p => p.id),
        },
        suggested_action: 'Keep only one copy of the proof. Others can be deleted.',
      });
    }
  }

  return anomalies;
}

/**
 * Detects one payment split across multiple invoices
 */
export function detectOnePaymentManyInvoices(
  payment: PaymentEvent,
  allocations: Allocation[]
): Anomaly | null {
  if (allocations.length <= 1) return null;

  const invoiceCount = new Set(allocations.map(a => a.target_invoice_id)).size;
  
  if (invoiceCount > 1) {
    return {
      type: 'one_payment_many_invoices',
      severity: 'info',
      confidence: 100,
      description: `Payment of ${payment.received_amount} from ${payment.payer_name} is split across ${invoiceCount} invoices.`,
      affected_entities: {
        payment_event_ids: [payment.id],
        invoice_ids: allocations.map(a => a.target_invoice_id).filter(Boolean) as string[],
      },
      suggested_action: 'Verify this is intentional. Ensure total allocations equal payment amount.',
    };
  }

  return null;
}

/**
 * Detects one invoice paid by multiple fragmented payments
 */
export function detectManyPaymentsOneInvoice(
  invoice: InvoiceRecord,
  payments: Array<{ payment_event_id: string; amount: number }>
): Anomaly | null {
  if (payments.length <= 1) return null;

  return {
    type: 'many_payments_one_invoice',
    severity: 'warning',
    confidence: 85,
    description: `Invoice ${invoice.invoice_id} (${invoice.amount_due}) is being paid by ${payments.length} separate payments totaling ${payments.reduce((s, p) => s + p.amount, 0)}. This may indicate partial payments or fragmented settlement.`,
    affected_entities: {
      invoice_ids: [invoice.invoice_id],
      payment_event_ids: payments.map(p => p.payment_event_id),
    },
    suggested_action: 'Verify all payments are legitimate. Check for potential duplicates or errors.',
  };
}

/**
 * Detects timing anomalies (payment before invoice date, very late payment)
 */
export function detectTimingAnomalies(
  payment: PaymentEvent,
  invoice: InvoiceRecord
): Anomaly | null {
  if (!payment.received_date || !invoice.invoice_date) return null;

  const paymentDate = new Date(payment.received_date);
  const invoiceDate = new Date(invoice.invoice_date);
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;

  const daysDiff = Math.floor((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

  // Payment before invoice date
  if (daysDiff < 0) {
    return {
      type: 'timing_anomaly',
      severity: 'warning',
      confidence: 90,
      description: `Payment received ${Math.abs(daysDiff)} days BEFORE invoice date. Payment: ${payment.received_date}, Invoice: ${invoice.invoice_date}`,
      affected_entities: {
        payment_event_ids: [payment.id],
        invoice_ids: [invoice.invoice_id],
      },
      suggested_action: 'Verify dates are correct. This may indicate data entry error or advance payment.',
    };
  }

  // Payment significantly overdue
  if (dueDate) {
    const daysOverdue = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue > 90) {
      return {
        type: 'timing_anomaly',
        severity: 'info',
        confidence: 75,
        description: `Payment received ${daysOverdue} days after due date. This is significantly overdue.`,
        affected_entities: {
          payment_event_ids: [payment.id],
          invoice_ids: [invoice.invoice_id],
        },
        suggested_action: 'Consider applying late payment penalties if per contract.',
      };
    }
  }

  return null;
}

/**
 * Runs all anomaly detection checks
 */
export function detectAllAnomalies(
  payments: PaymentEvent[],
  proofs: ProofRecord[],
  invoices: InvoiceRecord[],
  allocations: Allocation[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Duplicate payments
  anomalies.push(...detectDuplicatePayments(payments));

  // Duplicate proofs
  anomalies.push(...detectDuplicateProofs(proofs));

  // One-to-many and many-to-one
  for (const payment of payments) {
    const paymentAllocations = allocations.filter(a => a.payment_event_id === payment.id);
    const oneToMany = detectOnePaymentManyInvoices(payment, paymentAllocations);
    if (oneToMany) anomalies.push(oneToMany);
  }

  // Group allocations by invoice
  const invoicePayments = new Map<string, Array<{ payment_event_id: string; amount: number }>>();
  
  for (const alloc of allocations) {
    if (!alloc.target_invoice_id) continue;
    
    if (!invoicePayments.has(alloc.target_invoice_id)) {
      invoicePayments.set(alloc.target_invoice_id, []);
    }
    
    invoicePayments.get(alloc.target_invoice_id)!.push({
      payment_event_id: alloc.payment_event_id,
      amount: alloc.allocated_amount,
    });
  }

  for (const [invoiceId, payments] of invoicePayments) {
    const invoice = invoices.find(inv => inv.invoice_id === invoiceId);
    if (!invoice) continue;

    const manyToOne = detectManyPaymentsOneInvoice(invoice, payments);
    if (manyToOne) anomalies.push(manyToOne);
  }

  return anomalies;
}
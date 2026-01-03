

import { AllocationCandidate, InvoiceRecord, PaymentEvent } from "@/types/payment-normalizer-types";



interface MatchingConfig {
  amountTolerancePercent: number; // e.g., 1 for 1% tolerance
  fuzzyNameThreshold: number; // 0-100, higher = stricter
}

const DEFAULT_CONFIG: MatchingConfig = {
  amountTolerancePercent: 1,
  fuzzyNameThreshold: 80,
};

// Simple string similarity (Levenshtein distance)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 100;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Check if amounts match within tolerance
function amountsMatch(
  amount1: number,
  amount2: number,
  tolerancePercent: number
): boolean {
  const tolerance = amount1 * (tolerancePercent / 100);
  return Math.abs(amount1 - amount2) <= tolerance;
}

// Extract invoice ID patterns from text
function extractInvoiceIds(text: string): string[] {
  if (!text) return [];
  
  const patterns = [
    /INV[-_]?\d+/gi,
    /INVOICE[-_]?\d+/gi,
    /\b\d{6,10}\b/g, // 6-10 digit numbers (common invoice format)
  ];
  
  const found = new Set<string>();
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => found.add(m.toUpperCase()));
    }
  }
  
  return Array.from(found);
}

/**
 * Suggests invoice allocations for a payment event
 */
export function suggestInvoiceAllocations(
  payment: PaymentEvent,
  invoices: InvoiceRecord[],
  config: Partial<MatchingConfig> = {}
): AllocationCandidate[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const suggestions: AllocationCandidate[] = [];
  
  // Build search text from payment
  const searchText = [
    payment.payer_name,
    payment.payer_account,
    payment.csv_row_id,
  ]
    .filter(Boolean)
    .join(' ');

  // Priority 1: Exact invoice ID match in payment metadata
  const extractedIds = extractInvoiceIds(searchText);
  
  for (const extractedId of extractedIds) {
    const invoice = invoices.find(
      inv => inv.invoice_id.toUpperCase() === extractedId
    );
    
    if (invoice && invoice.status !== 'paid') {
      const amountToAllocate = Math.min(
        invoice.amount_remaining || invoice.amount_due,
        payment.received_amount || 0
      );
      
      suggestions.push({
        target_invoice_id: invoice.invoice_id,
        invoice_record_id: invoice.id,
        allocated_amount: amountToAllocate,
        confidence: 95,
        reason: 'Exact invoice ID match',
        match_type: 'exact_invoice_id',
        invoice_amount_due: invoice.amount_due,
        customer_name: invoice.customer_name,
      });
    }
  }

  // Priority 2: Exact amount match + customer name similarity
  if (suggestions.length === 0 && payment.received_amount) {
    const amountMatches = invoices.filter(
      inv =>
        inv.status !== 'paid' &&
        amountsMatch(
          payment.received_amount!,
          inv.amount_remaining || inv.amount_due,
          cfg.amountTolerancePercent
        )
    );

    for (const invoice of amountMatches) {
      let confidence = 75;
      let reason = 'Amount match';
      
      // Boost confidence if customer names match
      if (payment.payer_name && invoice.customer_name) {
        const nameSimilarity = stringSimilarity(
          payment.payer_name,
          invoice.customer_name
        );
        
        if (nameSimilarity >= cfg.fuzzyNameThreshold) {
          confidence = 85;
          reason = 'Amount + customer name match';
        }
      }

      suggestions.push({
        target_invoice_id: invoice.invoice_id,
        invoice_record_id: invoice.id,
        allocated_amount: payment.received_amount!,
        confidence,
        reason,
        match_type: 'amount_match',
        invoice_amount_due: invoice.amount_due,
        customer_name: invoice.customer_name,
      });
    }
  }

  // Priority 3: Customer name match (for partial payments)
  if (suggestions.length === 0 && payment.payer_name) {
    const nameMatches = invoices
      .filter(inv => inv.status !== 'paid' && inv.customer_name)
      .map(inv => ({
        invoice: inv,
        similarity: stringSimilarity(payment.payer_name!, inv.customer_name!),
      }))
      .filter(m => m.similarity >= cfg.fuzzyNameThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Top 3 matches

    for (const match of nameMatches) {
      const invoice = match.invoice;
      const amountToAllocate = Math.min(
        invoice.amount_remaining || invoice.amount_due,
        payment.received_amount || 0
      );

      suggestions.push({
        target_invoice_id: invoice.invoice_id,
        invoice_record_id: invoice.id,
        allocated_amount: amountToAllocate,
        confidence: Math.round(match.similarity * 0.6), // Scale down confidence
        reason: `Customer name match (${match.similarity.toFixed(0)}%)`,
        match_type: 'customer_match',
        invoice_amount_due: invoice.amount_due,
        customer_name: invoice.customer_name,
      });
    }
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

/**
 * Validates if allocations are correct (amount reconciliation)
 */
export function validateAllocations(
  payment: PaymentEvent,
  allocations: Array<{ target_invoice_id: string; allocated_amount: number }>,
  invoices: InvoiceRecord[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const totalAllocated = allocations.reduce(
    (sum, alloc) => sum + alloc.allocated_amount,
    0
  );

  // Check total allocated vs received amount
  if (totalAllocated > (payment.received_amount || 0)) {
    errors.push(
      `Total allocated (${totalAllocated}) exceeds received amount (${payment.received_amount})`
    );
  }

  if (totalAllocated < (payment.received_amount || 0)) {
    warnings.push(
      `Payment not fully allocated: ${totalAllocated} / ${payment.received_amount}`
    );
  }

  // Check each allocation against invoice
  for (const alloc of allocations) {
    const invoice = invoices.find(inv => inv.invoice_id === alloc.target_invoice_id);
    
    if (!invoice) {
      errors.push(`Invoice ${alloc.target_invoice_id} not found`);
      continue;
    }

    const remaining = invoice.amount_remaining || invoice.amount_due - invoice.amount_paid;
    
    if (alloc.allocated_amount > remaining) {
      errors.push(
        `Allocation to ${alloc.target_invoice_id} (${alloc.allocated_amount}) exceeds remaining amount (${remaining})`
      );
    }

    if (invoice.status === 'paid') {
      warnings.push(`Invoice ${alloc.target_invoice_id} is already marked as paid`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculates payment match status
 */
export function calculateMatchStatus(
  payment: PaymentEvent,
  allocations: Array<{ allocated_amount: number }>
): 'unmatched' | 'partial_match' | 'full_match' | 'overpayment' {
  const totalAllocated = allocations.reduce(
    (sum, alloc) => sum + alloc.allocated_amount,
    0
  );
  const received = payment.received_amount || 0;

  if (totalAllocated === 0) return 'unmatched';
  if (totalAllocated > received) return 'overpayment';
  if (totalAllocated === received) return 'full_match';
  return 'partial_match';
}
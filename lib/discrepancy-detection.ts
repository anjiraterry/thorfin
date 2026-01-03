// lib/discrepancy-detection.ts
// Detects and explains payment discrepancies (fees, withholding, etc.)

import type { PaymentEvent, InvoiceRecord, Deduction } from '@/types/payment-normalizer-types';

export interface DiscrepancyExplanation {
  type: 'fee' | 'withholding' | 'partial' | 'overpayment' | 'split' | 'rounding' | 'unknown';
  amount: number;
  confidence: number;
  explanation: string;
  suggested_deductions?: Array<{
    type: 'withholding' | 'bank_fee' | 'tax' | 'penalty' | 'other';
    amount: number;
    tax_code?: string;
    reason: string;
  }>;
}

// Common fee patterns
const FEE_PATTERNS = {
  withholding: {
    keywords: ['wht', 'withhold', 'tax', 'vat', 'withheld'],
    typical_rates: [0.05, 0.10, 0.075], // 5%, 10%, 7.5%
  },
  bank_fee: {
    keywords: ['fee', 'charge', 'bank charge', 'transfer fee'],
    typical_amounts: [50, 100, 150, 200, 250, 500], // Fixed amounts
  },
  vat: {
    keywords: ['vat', 'value added tax'],
    typical_rates: [0.075, 0.05], // 7.5%, 5%
  },
};

/**
 * Analyzes discrepancy between invoice amount and payment received
 */
export function explainDiscrepancy(
  payment: PaymentEvent,
  invoice: InvoiceRecord,
  existingDeductions: Deduction[] = []
): DiscrepancyExplanation | null {
  const invoiceAmount = invoice.amount_due;
  const receivedAmount = payment.received_amount || 0;
  const discrepancy = invoiceAmount - receivedAmount;

  // No discrepancy
  if (Math.abs(discrepancy) < 0.01) {
    return null;
  }

  // Overpayment
  if (discrepancy < 0) {
    return {
      type: 'overpayment',
      amount: Math.abs(discrepancy),
      confidence: 95,
      explanation: `Payment received (${receivedAmount}) exceeds invoice amount (${invoiceAmount}) by ${Math.abs(discrepancy).toFixed(2)}. This may indicate an error or advance payment.`,
    };
  }

  // Check for known deductions first
  if (existingDeductions.length > 0) {
    const totalDeductions = existingDeductions.reduce((sum, d) => sum + d.amount, 0);
    const expectedNet = invoiceAmount - totalDeductions;
    
    if (Math.abs(expectedNet - receivedAmount) < 0.01) {
      return {
        type: 'fee',
        amount: totalDeductions,
        confidence: 100,
        explanation: `Payment matches invoice after deducting known fees/taxes totaling ${totalDeductions.toFixed(2)}.`,
      };
    }
  }

  // Search for fee patterns in payment metadata
  const searchText = [
    payment.payer_name,
    payment.csv_row_id,
    JSON.stringify(payment),
  ].join(' ').toLowerCase();

  // Check for withholding tax (WHT)
  if (FEE_PATTERNS.withholding.keywords.some(kw => searchText.includes(kw))) {
    for (const rate of FEE_PATTERNS.withholding.typical_rates) {
      const expectedWHT = invoiceAmount * rate;
      const expectedNet = invoiceAmount - expectedWHT;
      
      if (Math.abs(expectedNet - receivedAmount) < invoiceAmount * 0.01) {
        return {
          type: 'withholding',
          amount: expectedWHT,
          confidence: 85,
          explanation: `Payment appears to be net of ${(rate * 100).toFixed(1)}% withholding tax (WHT). Invoice: ${invoiceAmount}, WHT: ${expectedWHT.toFixed(2)}, Net received: ${receivedAmount}.`,
          suggested_deductions: [{
            type: 'withholding',
            amount: expectedWHT,
            tax_code: 'WHT',
            reason: `${(rate * 100).toFixed(1)}% withholding tax`,
          }],
        };
      }
    }
  }

  // Check for bank fees
  if (FEE_PATTERNS.bank_fee.keywords.some(kw => searchText.includes(kw))) {
    for (const feeAmount of FEE_PATTERNS.bank_fee.typical_amounts) {
      const expectedNet = invoiceAmount - feeAmount;
      
      if (Math.abs(expectedNet - receivedAmount) < 1) {
        return {
          type: 'fee',
          amount: feeAmount,
          confidence: 80,
          explanation: `Payment appears to be net of bank transfer fee (${feeAmount}). Invoice: ${invoiceAmount}, Fee: ${feeAmount}, Net received: ${receivedAmount}.`,
          suggested_deductions: [{
            type: 'bank_fee',
            amount: feeAmount,
            reason: 'Bank transfer fee',
          }],
        };
      }
    }
  }

  // Check for VAT scenarios
  if (FEE_PATTERNS.vat.keywords.some(kw => searchText.includes(kw))) {
    for (const rate of FEE_PATTERNS.vat.typical_rates) {
      const expectedVAT = invoiceAmount * rate;
      const expectedNet = invoiceAmount - expectedVAT;
      
      if (Math.abs(expectedNet - receivedAmount) < invoiceAmount * 0.01) {
        return {
          type: 'withholding',
          amount: expectedVAT,
          confidence: 75,
          explanation: `Payment may be net of ${(rate * 100).toFixed(1)}% VAT. Invoice: ${invoiceAmount}, VAT: ${expectedVAT.toFixed(2)}, Net received: ${receivedAmount}.`,
          suggested_deductions: [{
            type: 'tax',
            amount: expectedVAT,
            tax_code: 'VAT',
            reason: `${(rate * 100).toFixed(1)}% VAT`,
          }],
        };
      }
    }
  }

  // Partial payment (simple underpayment with no clear pattern)
  const percentPaid = (receivedAmount / invoiceAmount) * 100;
  
  if (percentPaid >= 10 && percentPaid < 95) {
    return {
      type: 'partial',
      amount: discrepancy,
      confidence: 70,
      explanation: `Partial payment received: ${receivedAmount} of ${invoiceAmount} (${percentPaid.toFixed(1)}%). Outstanding: ${discrepancy.toFixed(2)}.`,
    };
  }

  // Rounding difference
  if (Math.abs(discrepancy) <= 5) {
    return {
      type: 'rounding',
      amount: discrepancy,
      confidence: 60,
      explanation: `Small difference of ${discrepancy.toFixed(2)} may be due to rounding or minor adjustment.`,
    };
  }

  // Unknown discrepancy
  return {
    type: 'unknown',
    amount: discrepancy,
    confidence: 50,
    explanation: `Payment received (${receivedAmount}) is ${discrepancy.toFixed(2)} less than invoice amount (${invoiceAmount}). Reason unclear - may require manual review.`,
  };
}

/**
 * Checks if gross amount can explain the discrepancy
 */
export function validateGrossToNet(
  grossAmount: number,
  netAmount: number,
  deductions: Deduction[]
): {
  valid: boolean;
  calculatedNet: number;
  difference: number;
  explanation: string;
} {
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const calculatedNet = grossAmount - totalDeductions;
  const difference = Math.abs(calculatedNet - netAmount);

  return {
    valid: difference < 0.01,
    calculatedNet,
    difference,
    explanation: difference < 0.01
      ? `Gross-to-net calculation is correct: ${grossAmount} - ${totalDeductions} = ${calculatedNet}`
      : `Mismatch: ${grossAmount} - ${totalDeductions} = ${calculatedNet}, but net amount is ${netAmount} (difference: ${difference.toFixed(2)})`,
  };
}
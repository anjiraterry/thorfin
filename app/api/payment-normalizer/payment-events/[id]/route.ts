// app/api/payment-normalizer/payment-events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';

// GET /api/payment-normalizer/payment-events/[id] - Get event detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string } > }
) {
  try {
    const { id } = await params;
    
    const event = await pnStorage.getPaymentEvent(id);
    if (!event) {
      return NextResponse.json(
        { error: 'Payment event not found' },
        { status: 404 }
      );
    }

    const [proofs, allocations, deductions, auditLogs] = await Promise.all([
      pnStorage.getProofsByIds(event.source_proof_ids),
      pnStorage.getAllocationsByPaymentEvent(id),
      pnStorage.getDeductionsByPaymentEvent(id),
      pnStorage.getAuditLogsByEntity('payment_event', id),
    ]);

    return NextResponse.json({
      event,
      proofs,
      allocations,
      deductions,
      audit_logs: auditLogs,
    });
  } catch (error) {
    console.error('Get payment event error:', error);
    return NextResponse.json(
      { error: 'Failed to get payment event' },
      { status: 500 }
    );
  }
}
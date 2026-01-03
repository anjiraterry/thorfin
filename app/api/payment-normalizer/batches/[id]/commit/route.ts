// app/api/payment-normalizer/batches/[id]/commit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import { storage } from '@/lib/storage/supabase-storage';
import { InsertTransactionRecord } from '@/types/@types';


// POST /api/payment-normalizer/batches/[id]/commit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string } > }
) {
  try {
    const { id: batchId } = await params;
    const body = await request.json();
    const { user_id, reconciliation_job_id } = body;

    const batch = await pnStorage.getBatch(batchId);
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    if (batch.status === 'committed') {
      return NextResponse.json(
        { error: 'Batch already committed' },
        { status: 400 }
      );
    }

    // Get all normalized payment events
    const normalizedEvents = await pnStorage.getPaymentEventsByBatch(batchId, 'normalized', 1000, 0);

    if (normalizedEvents.length === 0) {
      return NextResponse.json(
        { error: 'No normalized events to commit' },
        { status: 400 }
      );
    }

    // Create transaction_records for reconciliation
    const transactionRecords: InsertTransactionRecord[] = [];

    for (const event of normalizedEvents) {
      const allocations = await pnStorage.getAllocationsByPaymentEvent(event.id);

      for (const allocation of allocations) {
        transactionRecords.push({
            job_id: reconciliation_job_id || batch.job_id || batchId,
            source: 'payout', // from payment_normalizer
            source_filename: `PN_${batch.name}`,
            row_index: 0,
            tx_id: event.id,
            amount_cents: Math.round((allocation.allocated_amount || 0) * 100),
            currency: event.received_currency || 'NGN',
            timestamp: event.received_date || new Date().toISOString(),
            reference: allocation.target_invoice_id,
            metadata: {
                payment_event_id: event.id,
                allocation_id: allocation.id,
                payer_name: event.payer_name,
                payer_account: event.payer_account,
                source: 'payment_normalizer',
            },
            raw: {
                status: undefined,
                type: undefined
            }
        });
      }
    }

    // Insert transaction records
    if (transactionRecords.length > 0) {
      await storage.createTransactionRecords(transactionRecords);
    }

    // Update all normalized events to committed
    for (const event of normalizedEvents) {
      await pnStorage.updatePaymentEvent(event.id, { status: 'committed' });
    }

    // Update batch status
    await pnStorage.updateBatch(batchId, { status: 'committed' });

    // Create audit log
    await pnStorage.createAuditLog({
      entity_type: 'batch',
      entity_id: batchId,
      user_id,
      action: 'commit',
      after: {
        events_committed: normalizedEvents.length,
        transactions_created: transactionRecords.length,
      },
    });

    return NextResponse.json({
      success: true,
      events_committed: normalizedEvents.length,
      transactions_created: transactionRecords.length,
    });
  } catch (error) {
    console.error('Commit batch error:', error);
    return NextResponse.json(
      { error: 'Failed to commit batch' },
      { status: 500 }
    );
  }
}
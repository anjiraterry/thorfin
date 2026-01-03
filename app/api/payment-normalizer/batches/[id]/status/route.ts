import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const batch = await pnStorage.getBatch(id);
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    const [
      files, 
      proofs, 
      totalEvents, 
      pendingCount, 
      normalizedCount, 
      committedCount,
      invoiceStats
    ] = await Promise.all([
      pnStorage.getBatchFiles(id),
      pnStorage.getProofsByBatch(id),
      pnStorage.getPaymentEventsCount(id),
      pnStorage.getPaymentEventsCount(id, 'pending'),
      pnStorage.getPaymentEventsCount(id, 'normalized'),
      pnStorage.getPaymentEventsCount(id, 'committed'),
      pnStorage.getInvoiceStats(id),
    ]);

    return NextResponse.json({
      batch,
      stats: {
        total_files: files.length,
        total_proofs: proofs.length,
        total_events: totalEvents,
        pending_events: pendingCount,
        normalized_events: normalizedCount,
        committed_events: committedCount,
        total_invoices: invoiceStats.total_invoices,
        paid_invoices: invoiceStats.paid_invoices,
        partially_paid_invoices: invoiceStats.partially_paid_invoices,
        unpaid_invoices: invoiceStats.unpaid_invoices,
        total_invoice_amount: invoiceStats.total_invoice_amount,
        total_paid_amount: invoiceStats.total_paid_amount,
        total_outstanding_amount: invoiceStats.total_outstanding_amount,
      },
    });
  } catch (error) {
    console.error('Get batch status error:', error);
    return NextResponse.json(
      { error: 'Failed to get batch status' },
      { status: 500 }
    );
  }
}
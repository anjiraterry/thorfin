// app/api/payment-normalizer/payment-events/[id]/allocate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import { validateAllocations, calculateMatchStatus } from '@/lib/payment-normalizer-matching';
import type { InsertAllocation, InsertInvoicePaymentLink } from '@/types/payment-normalizer-types';

// POST /api/payment-normalizer/payment-events/[id]/allocate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string } >}
) {
  try {
    const { id: paymentEventId } = await params;
    const body = await request.json();
    const { allocations: allocationData, user_id } = body;

    if (!allocationData || !Array.isArray(allocationData)) {
      return NextResponse.json(
        { error: 'Invalid allocations data' },
        { status: 400 }
      );
    }

    const event = await pnStorage.getPaymentEvent(paymentEventId);
    if (!event) {
      return NextResponse.json(
        { error: 'Payment event not found' },
        { status: 404 }
      );
    }

    // Get invoices for validation
    const invoices = await pnStorage.getInvoicesByBatch(event.batch_id, 1000, 0);

    // Validate allocations
    const validation = validateAllocations(event, allocationData, invoices);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid allocations',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // Create allocations
    const allocationsToCreate: InsertAllocation[] = allocationData.map((alloc: any) => ({
      payment_event_id: paymentEventId,
      target_invoice_id: alloc.target_invoice_id,
      allocated_amount: alloc.allocated_amount,
      allocation_reason: alloc.allocation_reason,
      template_id: alloc.template_id,
      created_by: user_id,
    }));

    const allocations = await pnStorage.createAllocations(allocationsToCreate);

    // Create invoice-payment links
    const invoiceLinks: InsertInvoicePaymentLink[] = [];
    
    for (const allocation of allocations) {
      const invoice = invoices.find(inv => inv.invoice_id === allocation.target_invoice_id);
      
      if (invoice) {
        invoiceLinks.push({
          invoice_id: invoice.id,
          payment_event_id: paymentEventId,
          allocation_id: allocation.id,
          amount_applied: allocation.allocated_amount,
        });
      }
    }

    if (invoiceLinks.length > 0) {
      await pnStorage.createInvoicePaymentLinks(invoiceLinks);
    }

    // Calculate match status
    const matchStatus = calculateMatchStatus(event, allocations);
    const matchedInvoiceIds = allocations
      .map(a => a.target_invoice_id)
      .filter(Boolean) as string[];

    // Calculate discrepancy
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
    const discrepancy = (event.received_amount || 0) - totalAllocated;

    // Update payment event status
    await pnStorage.updatePaymentEvent(paymentEventId, {
      status: 'normalized',
      match_status: matchStatus,
      matched_invoice_ids: matchedInvoiceIds,
      discrepancy_amount: discrepancy,
    });

    // Create audit log
    await pnStorage.createAuditLog({
      entity_type: 'payment_event',
      entity_id: paymentEventId,
      user_id,
      action: 'allocate',
      after: { 
        allocations: allocationsToCreate,
        match_status: matchStatus,
        discrepancy 
      },
    });

    return NextResponse.json({ 
      allocations,
      match_status: matchStatus,
      validation_warnings: validation.warnings 
    }, { status: 201 });
  } catch (error) {
    console.error('Allocate error:', error);
    return NextResponse.json(
      { error: 'Failed to create allocations' },
      { status: 500 }
    );
  }
}
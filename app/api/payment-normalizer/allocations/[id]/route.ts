// app/api/payment-normalizer/allocations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/payment-normalizer/allocations/[id] - Edit allocation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string } >}
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { target_invoice_id, allocated_amount, allocation_reason, user_id } = body;

    const supabase = await createClient();
    
    // Get current allocation
    const { data: current, error: fetchError } = await supabase
      .from('allocations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    // Update allocation (trigger will create history)
    const { data: updated, error: updateError } = await supabase
      .from('allocations')
      .update({
        target_invoice_id: target_invoice_id ?? current.target_invoice_id,
        allocated_amount: allocated_amount ?? current.allocated_amount,
        allocation_reason: allocation_reason ?? current.allocation_reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update invoice-payment links
    const { data: links } = await supabase
      .from('invoice_payment_links')
      .select('*')
      .eq('allocation_id', id);

    if (links && links.length > 0) {
      // Find new invoice if invoice ID changed
      if (target_invoice_id && target_invoice_id !== current.target_invoice_id) {
        const { data: newInvoice } = await supabase
          .from('invoice_records')
          .select('id')
          .eq('invoice_id', target_invoice_id)
          .single();

        if (newInvoice) {
          await supabase
            .from('invoice_payment_links')
            .update({
              invoice_id: newInvoice.id,
              amount_applied: allocated_amount ?? current.allocated_amount,
            })
            .eq('allocation_id', id);
        }
      } else if (allocated_amount) {
        // Just update amount
        await supabase
          .from('invoice_payment_links')
          .update({ amount_applied: allocated_amount })
          .eq('allocation_id', id);
      }
    }

    // Create audit log
    await pnStorage.createAuditLog({
      entity_type: 'allocation',
      entity_id: id,
      user_id,
      action: 'edit',
      before: current,
      after: updated,
    });

    return NextResponse.json({ allocation: updated });
  } catch (error) {
    console.error('Edit allocation error:', error);
    return NextResponse.json(
      { error: 'Failed to edit allocation' },
      { status: 500 }
    );
  }
}

// DELETE /api/payment-normalizer/allocations/[id] - Undo/Delete allocation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    const supabase = await createClient();

    // Get allocation before deleting
    const { data: allocation, error: fetchError } = await supabase
      .from('allocations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !allocation) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    // Soft delete - mark as inactive
    const { error: updateError } = await supabase
      .from('allocations')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) throw updateError;

    // Delete invoice-payment links
    await supabase
      .from('invoice_payment_links')
      .delete()
      .eq('allocation_id', id);

    // Update payment event status back to suggested/pending
    const { data: remainingAllocations } = await supabase
      .from('allocations')
      .select('id')
      .eq('payment_event_id', allocation.payment_event_id)
      .eq('is_active', true);

    if (!remainingAllocations || remainingAllocations.length === 0) {
      await supabase
        .from('payment_events')
        .update({ status: 'pending' })
        .eq('id', allocation.payment_event_id);
    }

    // Create audit log
    await pnStorage.createAuditLog({
      entity_type: 'allocation',
      entity_id: id,
      user_id: userId || undefined,
      action: 'undo',
      before: allocation,
      after: undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete allocation error:', error);
    return NextResponse.json(
      { error: 'Failed to delete allocation' },
      { status: 500 }
    );
  }
}
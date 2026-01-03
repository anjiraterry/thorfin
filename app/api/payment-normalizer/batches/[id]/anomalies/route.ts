import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import { createClient } from '@/lib/supabase/server';
import { detectAllAnomalies } from '@/lib/anomaly-detection';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;

    const batch = await pnStorage.getBatch(batchId);
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    
    const [paymentsRes, proofsRes, invoicesRes, allocationsRes] = await Promise.all([
      supabase.from('payment_events').select('*').eq('batch_id', batchId),
      supabase.from('proof_records').select('*').eq('batch_id', batchId),
      supabase.from('invoice_records').select('*').eq('batch_id', batchId),
      supabase
        .from('allocations')
        .select('*')
        .eq('is_active', true)
        .in('payment_event_id', 
          (await supabase.from('payment_events').select('id').eq('batch_id', batchId)).data?.map(p => p.id) || []
        ),
    ]);

    const payments = paymentsRes.data || [];
    const proofs = proofsRes.data || [];
    const invoices = invoicesRes.data || [];
    const allocations = allocationsRes.data || [];

    const anomalies = detectAllAnomalies(payments, proofs, invoices, allocations);

    if (anomalies.length > 0) {
      const anomalyRecords = anomalies.map(anomaly => ({
        batch_id: batchId,
        anomaly_type: anomaly.type,
        severity: anomaly.severity,
        confidence: anomaly.confidence,
        description: anomaly.description,
        affected_payment_event_ids: anomaly.affected_entities.payment_event_ids || [],
        affected_invoice_ids: anomaly.affected_entities.invoice_ids || [],
        affected_proof_ids: anomaly.affected_entities.proof_ids || [],
        suggested_action: anomaly.suggested_action,
        status: 'unresolved',
      }));

      await supabase.from('payment_anomalies').insert(anomalyRecords);

      const affectedPaymentIds = new Set<string>();
      anomalies.forEach(a => {
        a.affected_entities.payment_event_ids?.forEach(id => affectedPaymentIds.add(id));
      });

      if (affectedPaymentIds.size > 0) {
        await supabase
          .from('payment_events')
          .update({ has_anomalies: true })
          .in('id', Array.from(affectedPaymentIds));
      }
    }

    return NextResponse.json({
      anomalies_detected: anomalies.length,
      anomalies,
    });
  } catch (error) {
    console.error('Detect anomalies error:', error);
    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;

    const supabase = await createClient();
    
    let query = supabase
      .from('payment_anomalies')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ anomalies: data || [] });
  } catch (error) {
    console.error('Get anomalies error:', error);
    return NextResponse.json(
      { error: 'Failed to get anomalies' },
      { status: 500 }
    );
  }
}
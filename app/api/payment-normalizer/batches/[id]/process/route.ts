// app/api/payment-normalizer/batches/[id]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import { suggestInvoiceAllocations } from '@/lib/payment-normalizer-matching';
import { explainDiscrepancy } from '@/lib/discrepancy-detection';
import { detectAllAnomalies } from '@/lib/anomaly-detection';
import Papa from 'papaparse';
import type { InsertProofRecord, InsertPaymentEvent } from '@/types/payment-normalizer-types';

// POST /api/payment-normalizer/batches/[id]/process
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string } > }
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

    // Update batch status to processing
    await pnStorage.updateBatch(batchId, { status: 'processing' });

    // Get all files for this batch
    const files = await pnStorage.getBatchFiles(batchId);
    
    // Get invoices for matching
    const invoices = await pnStorage.getInvoicesByBatch(batchId, 1000, 0);
    
    // Process each file
    const supabase = await createClient();
    const allPayments: any[] = [];
    const allProofs: any[] = [];
    
    for (const file of files) {
      try {
        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('pn-files')
          .download(file.storage_path);

        if (downloadError) {
          console.error(`Failed to download ${file.filename}:`, downloadError);
          continue;
        }

        if (file.file_type === 'bank_csv' || file.file_type === 'vendor_csv') {
          // Skip if this is an invoice file (we already imported it)
          if (file.filename.toLowerCase().includes('invoice')) {
            continue;
          }

          // Parse CSV
          const text = await fileData.text();
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          
          if (parsed.errors.length > 0) {
            console.error(`CSV parse errors in ${file.filename}:`, parsed.errors);
          }

          // Create payment events from CSV rows
          const events: InsertPaymentEvent[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i] as any;
            
            // Extract payment data
            const amount = parseFloat(row.amount || row.Amount || row.AMOUNT || '0');
            const payer = row.payer || row.Payer || row.merchant || row.Merchant || '';
            const account = row.account || row.Account || row.account_number || '';
            const date = row.date || row.Date || row.payment_date || new Date().toISOString();
            const currency = row.currency || row.Currency || 'NGN';
            const reference = row.reference || row.Reference || row.narration || '';
            
            if (amount > 0) {
              events.push({
                batch_id: batchId,
                source_proof_ids: [],
                csv_row_id: `${file.id}_row_${i}`,
                payer_name: payer,
                payer_account: account,
                received_amount: amount,
                received_currency: currency,
                received_date: date,
                status: 'pending',
                suggested_allocations: [],
              });
            }
          }

          if (events.length > 0) {
            const createdEvents = await pnStorage.createPaymentEvents(events);
            allPayments.push(...createdEvents);
            
            // For each created event, suggest invoice allocations and detect discrepancies
            for (const event of createdEvents) {
              if (invoices.length > 0) {
                const suggestions = suggestInvoiceAllocations(event, invoices);
                
                // Detect discrepancies for top suggestion
                let discrepancyExplanation = null;
                if (suggestions.length > 0 && suggestions[0].invoice_record_id) {
                  const topInvoice = invoices.find(inv => inv.id === suggestions[0].invoice_record_id);
                  if (topInvoice) {
                    discrepancyExplanation = explainDiscrepancy(event, topInvoice);
                  }
                }
                
                await pnStorage.updatePaymentEvent(event.id, {
                  suggested_allocations: suggestions,
                  status: suggestions.length > 0 ? 'suggested' : 'pending',
                  discrepancy_explanation: discrepancyExplanation || undefined,
                });
              }
            }
          }
          
        } else if (file.file_type === 'pdf_proof' || file.file_type === 'image_proof') {
          // For MVP, create a simple proof record without OCR
          const proof: InsertProofRecord = {
            batch_id: batchId,
            batch_file_id: file.id,
            extracted_payer: 'OCR not implemented',
            extracted_amount: 0,
            extracted_currency: 'NGN',
            narration: `Proof from ${file.filename}`,
            ocr_confidence: 0,
            file_hash: `hash_${file.id}`,
          };

          const created = await pnStorage.createProofRecord(proof);
          allProofs.push(created);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.filename}:`, fileError);
      }
    }

    // Run anomaly detection
    const anomalies = detectAllAnomalies(allPayments, allProofs, invoices, []);
    
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
    }

    // Update batch status to ready
    await pnStorage.updateBatch(batchId, { status: 'ready' });

    // Create audit log
    await pnStorage.createAuditLog({
      entity_type: 'batch',
      entity_id: batchId,
      action: 'process',
      after: { 
        files_processed: files.length,
        invoices_available: invoices.length,
        payments_created: allPayments.length,
        anomalies_detected: anomalies.length,
      },
    });

    return NextResponse.json({ 
      success: true, 
      files_processed: files.length,
      invoices_available: invoices.length,
      payments_created: allPayments.length,
      anomalies_detected: anomalies.length,
    });
  } catch (error) {
    console.error('Process batch error:', error);
    
    // Update batch to failed status
    try {
      await pnStorage.updateBatch((await params).id, { status: 'failed' });
    } catch (e) {
      console.error('Failed to update batch status:', e);
    }

    return NextResponse.json(
      { error: 'Failed to process batch' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { InsertInvoiceRecord, InvoiceUploadResponse } from '@/types/payment-normalizer-types';
import { createClient } from '@/lib/supabase/server';

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();
    let invoiceData: any[] = [];

    if (filename.endsWith('.csv')) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      
      if (parsed.errors.length > 0) {
        console.error('CSV parse errors:', parsed.errors);
      }
      
      invoiceData = parsed.data;
    }
    else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      invoiceData = XLSX.utils.sheet_to_json(worksheet);
    }
    else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload CSV or Excel file.' },
        { status: 400 }
      );
    }

    const invoices: InsertInvoiceRecord[] = [];
    
    for (const row of invoiceData) {
      const invoiceId = 
        row.invoice_id || 
        row['Invoice ID'] || 
        row.invoice_number || 
        row['Invoice Number'] ||
        row.invoice ||
        row.Invoice;

      const amountDue = parseFloat(
        row.amount_due || 
        row['Amount Due'] || 
        row.amount || 
        row.Amount ||
        row.total ||
        row.Total ||
        '0'
      );

      const customerName = 
        row.customer_name || 
        row['Customer Name'] || 
        row.customer || 
        row.Customer ||
        row.payer ||
        row.Payer;

      if (!invoiceId || !amountDue || amountDue <= 0) {
        console.warn('Skipping invalid invoice row:', row);
        continue;
      }

      invoices.push({
        batch_id: batchId,
        invoice_id: String(invoiceId).trim(),
        invoice_date: row.invoice_date || row['Invoice Date'] || row.date,
        due_date: row.due_date || row['Due Date'],
        customer_name: customerName || 'Unknown',
        customer_id: row.customer_id || row['Customer ID'] || row.customer_code,
        amount_due: amountDue,
        currency: row.currency || row.Currency || 'NGN',
        status: 'unpaid',
        payment_terms: row.payment_terms || row['Payment Terms'],
        description: row.description || row.Description || row.notes,
        metadata: {
          original_row: row,
        },
      });
    }

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: 'No valid invoices found in file. Please check the format.' },
        { status: 400 }
      );
    }

    const createdInvoices = await pnStorage.createInvoiceRecords(invoices);

    const supabase = await createClient();
    const storagePath = `pn-files/${batchId}/invoices_${Date.now()}_${file.name}`;
    
    const fileBuffer = await file.arrayBuffer();
    await supabase.storage
      .from('pn-files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    await pnStorage.createBatchFile({
      batch_id: batchId,
      filename: file.name,
      file_type: 'vendor_csv',
      storage_path: storagePath,
    });

    await pnStorage.createAuditLog({
      entity_type: 'batch',
      entity_id: batchId,
      action: 'upload_invoices',
      after: {
        invoices_imported: createdInvoices.length,
        filename: file.name,
      },
    });

    const response: InvoiceUploadResponse = {
      batch_id: batchId,
      invoices_imported: createdInvoices.length,
      invoices: createdInvoices,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Upload invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to upload invoices' },
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
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;
    const status = searchParams.get('status') || undefined;

    let invoices = await pnStorage.getInvoicesByBatch(batchId, limit, offset);

    if (status) {
      invoices = invoices.filter(inv => inv.status === status);
    }

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total: invoices.length,
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to get invoices' },
      { status: 500 }
    );
  }
}
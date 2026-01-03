import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
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
    let fileType: 'bank_csv' | 'vendor_csv' | 'pdf_proof' | 'image_proof';
    
    if (filename.endsWith('.csv')) {
      fileType = 'bank_csv';
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      fileType = 'vendor_csv';
    } else if (filename.endsWith('.pdf')) {
      fileType = 'pdf_proof';
    } else if (filename.match(/\.(jpg|jpeg|png)$/)) {
      fileType = 'image_proof';
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const storagePath = `pn-files/${batchId}/${Date.now()}_${file.name}`;
    
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('pn-files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    const batchFile = await pnStorage.createBatchFile({
      batch_id: batchId,
      filename: file.name,
      file_type: fileType,
      storage_path: storagePath,
    });

    return NextResponse.json({ file: batchFile }, { status: 201 });
  } catch (error) {
    console.error('Upload file error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
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
    
    const files = await pnStorage.getBatchFiles(batchId);
    
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    return NextResponse.json(
      { error: 'Failed to get files' },
      { status: 500 }
    );
  }
}
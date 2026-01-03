// app/api/payment-normalizer/batches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';
import { InsertPaymentBatch } from '@/types/payment-normalizer-types';


// GET /api/payment-normalizer/batches - List batches
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      pnStorage.listBatches(limit, offset),
      pnStorage.getBatchesCount(),
    ]);

    return NextResponse.json({
      batches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('List batches error:', error);
    return NextResponse.json(
      { error: 'Failed to list batches' },
      { status: 500 }
    );
  }
}

// POST /api/payment-normalizer/batches - Create batch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mode, client_id, uploaded_by } = body;

    if (!name || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields: name, mode' },
        { status: 400 }
      );
    }

    const batchData: InsertPaymentBatch = {
      name,
      mode,
      client_id,
      uploaded_by,
      status: 'processing',
    };

    const batch = await pnStorage.createBatch(batchData);

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    console.error('Create batch error:', error);
    return NextResponse.json(
      { error: 'Failed to create batch' },
      { status: 500 }
    );
  }
}
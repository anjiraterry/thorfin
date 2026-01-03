// app/api/payment-normalizer/payment-events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pnStorage } from '@/lib/storage/payment-normalizer-storage';

// GET /api/payment-normalizer/payment-events
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batch_id');
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    if (!batchId) {
      return NextResponse.json(
        { error: 'Missing batch_id parameter' },
        { status: 400 }
      );
    }

    const [events, total] = await Promise.all([
      pnStorage.getPaymentEventsByBatch(batchId, status, limit, offset),
      pnStorage.getPaymentEventsCount(batchId, status),
    ]);

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Get payment events error:', error);
    return NextResponse.json(
      { error: 'Failed to get payment events' },
      { status: 500 }
    );
  }
}
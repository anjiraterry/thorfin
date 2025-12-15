import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'

const DEFAULT_LIMIT = 15
const MAX_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = await params
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'payout' | 'ledger'
    
    // Validate type
    if (!type || (type !== 'payout' && type !== 'ledger')) {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'payout' or 'ledger'" },
        { status: 400 }
      )
    }
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(
      parseInt(searchParams.get('limit') || DEFAULT_LIMIT.toString()),
      MAX_LIMIT
    )
    const offset = (page - 1) * limit
    
    // Optional search filter
    const searchQuery = searchParams.get('search') || ''

    // Verify job exists
    const job = await storage.getJob(jobId)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    // Get matched IDs for filtering unmatched transactions
    // First, get all matches for this job
    const allMatches = await storage.getMatchesByJob(jobId)
    const matchedPayoutIds = allMatches.map(m => m.payout_id).filter(Boolean)
    const matchedLedgerIds = allMatches.map(m => m.ledger_id).filter(Boolean)
    
    // Get the appropriate matched IDs based on type
    const matchedIds = type === 'payout' ? matchedPayoutIds : matchedLedgerIds
    
    // Get total count for the specific type
    const totalCount = await storage.getUnmatchedTransactionsCount(
      jobId, 
      type, 
      matchedIds, 
      searchQuery
    )
    
    // Get paginated unmatched transactions
    const transactions = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      type, 
      matchedIds, 
      limit, 
      offset,
      searchQuery
    )

    const response = {
      transactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Unmatched transactions error:", error)
    return NextResponse.json(
      { error: "Failed to get unmatched transactions" },
      { status: 500 }
    )
  }
}
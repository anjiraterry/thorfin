import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { JobResultsResponse } from '@/@types'

// Default and max limits for each type
const DEFAULT_MATCHES_LIMIT = 20
const DEFAULT_TRANSACTIONS_LIMIT = 15
const DEFAULT_CLUSTERS_LIMIT = 10
const MAX_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = await params
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    
    // Matches pagination
    const matchesPage = parseInt(searchParams.get('matchesPage') || '1')
    const matchesLimit = Math.min(
      parseInt(searchParams.get('matchesLimit') || DEFAULT_MATCHES_LIMIT.toString()),
      MAX_LIMIT
    )
    const matchesOffset = (matchesPage - 1) * matchesLimit
    
    // Transactions pagination
    const transactionsPage = parseInt(searchParams.get('transactionsPage') || '1')
    const transactionsLimit = Math.min(
      parseInt(searchParams.get('transactionsLimit') || DEFAULT_TRANSACTIONS_LIMIT.toString()),
      MAX_LIMIT
    )
    const transactionsOffset = (transactionsPage - 1) * transactionsLimit
    
    // Clusters pagination
    const clustersPage = parseInt(searchParams.get('clustersPage') || '1')
    const clustersLimit = Math.min(
      parseInt(searchParams.get('clustersLimit') || DEFAULT_CLUSTERS_LIMIT.toString()),
      MAX_LIMIT
    )
    const clustersOffset = (clustersPage - 1) * clustersLimit
    
    // Optional search filter
    const searchQuery = searchParams.get('search') || ''

    const job = await storage.getJob(jobId)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    // Get total counts first
    const totalMatches = await storage.getMatchesCount(jobId, searchQuery)
    const totalUnmatchedPayouts = await storage.getUnmatchedTransactionsCount(jobId, "payout", [], searchQuery)
    const totalUnmatchedLedger = await storage.getUnmatchedTransactionsCount(jobId, "ledger", [], searchQuery)
    const totalClusters = await storage.getClustersCount(jobId)

    // Get paginated matches - using the paginated method
    const matches = await storage.getMatchesWithTransactionsPaginated(
      jobId, 
      matchesLimit, 
      matchesOffset, 
      searchQuery
    )

    // Get paginated clusters - using the paginated method
    const clusters = await storage.getClustersByJobPaginated(
      jobId, 
      clustersLimit, 
      clustersOffset
    )

    // Get matched IDs for filtering unmatched transactions
    const matchedPayoutIds = matches.map(m => m.payout_id).filter(Boolean)
    const matchedLedgerIds = matches.map(m => m.ledger_id).filter(Boolean)
    
    // Get paginated unmatched transactions - using the paginated method
    const unmatchedPayouts = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      "payout", 
      matchedPayoutIds, 
      transactionsLimit, 
      transactionsOffset,
      searchQuery
    )
    
    const unmatchedLedger = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      "ledger", 
      matchedLedgerIds, 
      transactionsLimit, 
      transactionsOffset,
      searchQuery
    )

    const response: JobResultsResponse = {
      job,
      stats: {
        total_payouts: job.payout_row_count || 0,
        total_ledger: job.ledger_row_count || 0,
        matched_count: totalMatches,
        unmatched_count: totalUnmatchedPayouts + totalUnmatchedLedger,
        match_rate: job.match_rate || 0,
        total_unmatched_amount: job.total_unmatched_amount_cents || 0,
      },
      matches,
      unmatched_payouts: unmatchedPayouts,
      unmatched_ledger: unmatchedLedger,
      clusters,
      pagination: {
        matches: {
          page: matchesPage,
          limit: matchesLimit,
          total: totalMatches,
          pages: Math.ceil(totalMatches / matchesLimit)
        },
        transactions: {
          page: transactionsPage,
          limit: transactionsLimit,
          total_payouts: totalUnmatchedPayouts,
          total_ledger: totalUnmatchedLedger,
          pages_payouts: Math.ceil(totalUnmatchedPayouts / transactionsLimit),
          pages_ledger: Math.ceil(totalUnmatchedLedger / transactionsLimit)
        },
        clusters: {
          page: clustersPage,
          limit: clustersLimit,
          total: totalClusters,
          pages: Math.ceil(totalClusters / clustersLimit)
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Results error:", error)
    return NextResponse.json(
      { error: "Failed to get results" },
      { status: 500 }
    )
  }
}
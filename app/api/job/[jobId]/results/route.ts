import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { getCorrectedTotalUnmatchedAmount } from '@/lib/matching-engine'
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
    
    // Get total transaction counts
    const totalPayoutsCount = await storage.getTransactionCount(jobId, "payout", searchQuery)
    const totalLedgerCount = await storage.getTransactionCount(jobId, "ledger", searchQuery)
    
    // Calculate actual unmatched counts
    const unmatchedPayoutsCount = Math.max(0, totalPayoutsCount - totalMatches)
    const unmatchedLedgerCount = Math.max(0, totalLedgerCount - totalMatches)
    
    const totalClusters = await storage.getClustersCount(jobId)

    // Get paginated matches
    const matches = await storage.getMatchesWithTransactionsPaginated(
      jobId, 
      matchesLimit, 
      matchesOffset, 
      searchQuery
    )

    // Get paginated clusters
    const clusters = await storage.getClustersByJobPaginated(
      jobId, 
      clustersLimit, 
      clustersOffset
    )

    // Get matched IDs for filtering unmatched transactions
    const matchedPayoutIds = matches.map(m => m.payout_id).filter(Boolean)
    const matchedLedgerIds = matches.map(m => m.ledger_id).filter(Boolean)
    
    // Get paginated unmatched transactions
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

    // *** FIX: Get ALL unmatched transactions and clusters for correct calculation ***
    const allUnmatchedPayouts = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      "payout", 
      matchedPayoutIds, 
      10000, // Large limit to get all
      0,
      searchQuery
    )
    
    const allUnmatchedLedger = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      "ledger", 
      matchedLedgerIds, 
      10000, // Large limit to get all
      0,
      searchQuery
    )
    
    const allClusters = await storage.getClustersByJobPaginated(
      jobId,
      10000, // Large limit to get all
      0
    )
    
    // *** FIX: Use the corrected calculation ***
    const totalUnmatchedAmount = getCorrectedTotalUnmatchedAmount(
      allUnmatchedPayouts,
      allUnmatchedLedger,
      allClusters
    )

    const response: JobResultsResponse = {
      job: {
        ...job,
        currency: job.currency || "NGN",
      },
      stats: {
        total_payouts: totalPayoutsCount,
        total_ledger: totalLedgerCount,
        matched_count: totalMatches,
        unmatched_count: unmatchedPayoutsCount + unmatchedLedgerCount,
        match_rate: totalPayoutsCount > 0 ? totalMatches / totalPayoutsCount : 0,
        total_unmatched_amount: totalUnmatchedAmount, // *** CORRECTED ***
        currency: job.currency || "NGN",
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
          pages: Math.ceil(totalMatches / matchesLimit) || 1
        },
        transactions: {
          page: transactionsPage,
          limit: transactionsLimit,
          total_payouts: unmatchedPayoutsCount,
          total_ledger: unmatchedLedgerCount,
          pages_payouts: Math.ceil(unmatchedPayoutsCount / transactionsLimit) || 1,
          pages_ledger: Math.ceil(unmatchedLedgerCount / transactionsLimit) || 1
        },
        clusters: {
          page: clustersPage,
          limit: clustersLimit,
          total: totalClusters,
          pages: Math.ceil(totalClusters / clustersLimit) || 1
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


import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { getCorrectedTotalUnmatchedAmount } from '@/lib/matching-engine'
import type { JobSummaryResponse } from '@/types/@types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }>}
) {
  try {
    const { jobId } = await params
    
    const job = await storage.getJob(jobId)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    const totalMatches = await storage.getMatchesCount(jobId)
    
    // Get total transaction counts
    const totalPayoutsCount = await storage.getTransactionCount(jobId, "payout")
    const totalLedgerCount = await storage.getTransactionCount(jobId, "ledger")
    
    // Calculate actual unmatched counts
    const unmatchedPayoutsCount = Math.max(0, totalPayoutsCount - totalMatches)
    const unmatchedLedgerCount = Math.max(0, totalLedgerCount - totalMatches)
    
    // Get matched IDs
    const matchedPayoutIds = (await storage.getMatchesByJob(jobId)).map(m => m.payout_id).filter(Boolean)
    const matchedLedgerIds = (await storage.getMatchesByJob(jobId)).map(m => m.ledger_id).filter(Boolean)
    
    // Get ALL unmatched transactions (not paginated)
    const unmatchedPayouts = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      "payout", 
      matchedPayoutIds, 
      10000, // Very large limit to get all
      0
    )
    
    const unmatchedLedger = await storage.getUnmatchedTransactionsPaginated(
      jobId, 
      "ledger", 
      matchedLedgerIds, 
      10000, // Very large limit to get all
      0
    )
    
    // Get ALL clusters (not paginated)
    const clusters = await storage.getClustersByJobPaginated(
      jobId,
      10000, // Very large limit to get all
      0
    )
    
    // *** FIX: Use the corrected calculation from matching engine ***
    const totalUnmatchedAmount = getCorrectedTotalUnmatchedAmount(
      unmatchedPayouts,
      unmatchedLedger,
      clusters
    )

    const response: JobSummaryResponse = {
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
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Job summary error:", error)
    return NextResponse.json(
      { error: "Failed to get job summary" },
      { status: 500 }
    )
  }
}
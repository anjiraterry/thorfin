import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { JobResultsResponse } from '@/@types'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

    const matches = await storage.getMatchesWithTransactions(jobId)
    const clusters = await storage.getClustersByJob(jobId)

    // Get unmatched transactions
    const matchedPayoutIds = matches.map(m => m.payout_id)
    const matchedLedgerIds = matches.map(m => m.ledger_id)
    
    const unmatchedPayouts = await storage.getUnmatchedTransactions(jobId, "payout", matchedPayoutIds)
    const unmatchedLedger = await storage.getUnmatchedTransactions(jobId, "ledger", matchedLedgerIds)

    const response: JobResultsResponse = {
      job,
      stats: {
        total_payouts: job.payout_row_count || 0,
        total_ledger: job.ledger_row_count || 0,
        matched_count: matches.length,
        unmatched_count: unmatchedPayouts.length + unmatchedLedger.length,
        match_rate: job.match_rate || 0,
        total_unmatched_amount: job.total_unmatched_amount_cents || 0,
      },
      matches,
      unmatched_payouts: unmatchedPayouts,
      unmatched_ledger: unmatchedLedger,
      clusters,
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
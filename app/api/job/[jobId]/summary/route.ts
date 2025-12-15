import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { JobSummaryResponse } from '@/@types'

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

    const totalMatches = await storage.getMatchesCount(jobId)
    const totalUnmatchedPayouts = await storage.getUnmatchedTransactionsCount(jobId, "payout", [])
    const totalUnmatchedLedger = await storage.getUnmatchedTransactionsCount(jobId, "ledger", [])

    const response: JobSummaryResponse = {
      job,
      stats: {
        total_payouts: job.payout_row_count || 0,
        total_ledger: job.ledger_row_count || 0,
        matched_count: totalMatches,
        unmatched_count: totalUnmatchedPayouts + totalUnmatchedLedger,
        match_rate: job.match_rate || 0,
        total_unmatched_amount: job.total_unmatched_amount_cents || 0,
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
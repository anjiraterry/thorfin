import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
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
    
    // FIXED: Changed property names to snake_case
    const matchedPayoutIds = matches.map(m => m.payout_id)
    const matchedLedgerIds = matches.map(m => m.ledger_id)
    
    const unmatchedPayouts = await storage.getUnmatchedTransactions(jobId, "payout", matchedPayoutIds)
    const unmatchedLedger = await storage.getUnmatchedTransactions(jobId, "ledger", matchedLedgerIds)

    const data = {
      job,
      stats: {
        // FIXED: Changed property names to snake_case
        total_payouts: job.payout_row_count || 0,
        total_ledger: job.ledger_row_count || 0,
        matched_count: matches.length,
        unmatched_count: unmatchedPayouts.length + unmatchedLedger.length,
        match_rate: job.match_rate || 0,
        total_unmatched_amount: job.total_unmatched_amount_cents || 0,
      },
      matches: matches.map(m => ({
        ...m,
        payout: m.payout,
        ledger: m.ledger,
      })),
      unmatched_payouts: unmatchedPayouts, // FIXED: Changed to snake_case
      unmatched_ledger: unmatchedLedger, // FIXED: Changed to snake_case
      clusters,
      exported_at: new Date().toISOString(), // FIXED: Changed to snake_case
    }

    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="reconciliation-${jobId}.json"`,
      },
    })
  } catch (error) {
    console.error("JSON error:", error)
    return NextResponse.json(
      { error: "Failed to generate JSON" },
      { status: 500 }
    )
  }
}
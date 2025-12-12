import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { generatePDFReport } from '@/lib/pdf-generator'

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

    // FIXED: Changed property names to snake_case
    const matchedPayoutIds = matches.map(m => m.payout_id)
    const matchedLedgerIds = matches.map(m => m.ledger_id)
    
    const unmatchedPayouts = await storage.getUnmatchedTransactions(jobId, "payout", matchedPayoutIds)
    const unmatchedLedger = await storage.getUnmatchedTransactions(jobId, "ledger", matchedLedgerIds)

    // FIXED: Changed property names to snake_case
    const pdfBuffer = await generatePDFReport({
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
      clusters,
    })

    // FIXED: Convert Buffer to Uint8Array for NextResponse
    const pdfUint8Array = new Uint8Array(pdfBuffer)
    
    return new NextResponse(pdfUint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reconciliation-${jobId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("PDF error:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await the params promise
    const { jobId } = await params
    
    const job = await storage.getJob(jobId)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    const matches = await storage.getMatchesWithTransactions(jobId)

    const csvRows = [
      ["Match Type", "Payout ID", "Ledger ID", "Payout Amount", "Ledger Amount", "Score", "Confidence", "Status", "Payout Reference", "Ledger Reference"].join(","),
      ...matches.map(m => [
        m.match_type || "", // FIXED: Changed matchType to match_type
        m.payout?.tx_id || "", // FIXED: Changed txId to tx_id
        m.ledger?.tx_id || "", // FIXED: Changed txId to tx_id
        (m.payout?.amount_cents || 0) / 100, // FIXED: Changed amountCents to amount_cents
        (m.ledger?.amount_cents || 0) / 100, // FIXED: Changed amountCents to amount_cents
        (m.score * 100).toFixed(1) + "%",
        m.confidence_level || "", // FIXED: Changed confidenceLevel to confidence_level
        m.accepted === 1 ? "Accepted" : m.accepted === -1 ? "Rejected" : "Pending",
        `"${(m.payout?.reference || "").replace(/"/g, '""')}"`,
        `"${(m.ledger?.reference || "").replace(/"/g, '""')}"`,
      ].join(","))
    ]

    return new NextResponse(csvRows.join("\n"), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="reconciliation-${jobId}.csv"`,
      },
    })
  } catch (error) {
    console.error("CSV error:", error)
    return NextResponse.json(
      { error: "Failed to generate CSV" },
      { status: 500 }
    )
  }
}
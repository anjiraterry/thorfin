import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { generatePDFReport } from '@/lib/pdf-generator'
import type { MatchRecord, TransactionRecord, Job, Cluster } from '@/types/@types' // Adjust import path as needed

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    
    console.log(`[PDF] Generating PDF for job ${jobId}`)
    
    const job = await storage.getJob(jobId)
    if (!job) {
      console.error(`[PDF] Job not found: ${jobId}`)
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    console.log(`[PDF] Job found: ${job.id}, status: ${job.status}`)

    // Get all required data
    const matches = await storage.getMatchesWithTransactions(jobId)
    const clusters = await storage.getClustersByJob(jobId)
    const matchedPayoutIds = matches.map(m => m.payout_id)
    const matchedLedgerIds = matches.map(m => m.ledger_id)
    
    const unmatchedPayouts = await storage.getUnmatchedTransactions(jobId, "payout", matchedPayoutIds)
    const unmatchedLedger = await storage.getUnmatchedTransactions(jobId, "ledger", matchedLedgerIds)

    console.log(`[PDF] Data retrieved: ${matches.length} matches, ${clusters.length} clusters`)

    // Create properly typed data structure
    const pdfData = {
      job: {
        id: job.id,
        name: job.name || 'Untitled Job',
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        settings: job.settings || {},
        payout_mapping: job.payout_mapping || {},
        ledger_mapping: job.ledger_mapping || {},
        payout_filename: job.payout_filename || '',
        ledger_filename: job.ledger_filename || '',
        payout_row_count: job.payout_row_count || 0,
        ledger_row_count: job.ledger_row_count || 0,
        matched_count: job.matched_count || 0,
        unmatched_count: job.unmatched_count || 0,
        match_rate: job.match_rate || 0,
        total_unmatched_amount_cents: job.total_unmatched_amount_cents || 0,
        error_message: job.error_message || undefined,
        progress: job.progress || 0,
        completed_at: job.completed_at || undefined,
        currency: job.currency || 'NGN'
      } as Job,
      stats: {
        total_payouts: job.payout_row_count || 0,
        total_ledger: job.ledger_row_count || 0,
        matched_count: matches.length,
        unmatched_count: unmatchedPayouts.length + unmatchedLedger.length,
        match_rate: job.match_rate || 0,
        total_unmatched_amount: job.total_unmatched_amount_cents || 0,
      },
      matches: matches.map(match => ({
        id: match.id,
        job_id: match.job_id,
        payout_id: match.payout_id,
        ledger_id: match.ledger_id,
        score: match.score || 0,
        breakdown: match.breakdown || {},
        status: match.status || 'matched',
        match_type: match.match_type || 'unknown',
        confidence_level: match.confidence_level || 'medium',
        accepted: match.accepted || 0,
        notes: match.notes || undefined, // Changed from null to undefined
        matched_at: match.matched_at,
        updated_at: match.updated_at,
        payout: match.payout || null,
        ledger: match.ledger || null
      })) as (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })[],
      clusters: clusters.map(cluster => ({
        id: cluster.id,
        job_id: cluster.job_id,
        pivot_id: cluster.pivot_id,
        pivot_type: cluster.pivot_type,
        records: cluster.records || [],
        amount: cluster.amount || 0,
        status: cluster.status || 'unmatched',
        notes: cluster.notes || '',
        llm_summary: cluster.llm_summary || undefined,
        suggested_action: cluster.suggested_action || undefined,
        llm_confidence: cluster.llm_confidence || undefined,
        token_usage: cluster.token_usage || undefined,
        created_at: cluster.created_at,
        evidence_ids: cluster.evidence_ids || [],
        merchant_name: cluster.merchant_name || `Cluster ${clusters.indexOf(cluster) + 1}`,
        amount_bucket: cluster.amount_bucket || undefined,
        date_bucket: cluster.date_bucket || undefined,
        total_amount_cents: cluster.total_amount_cents || cluster.amount || 0,
        size: cluster.size || cluster.records?.length || 0,
        confidence_level: cluster.confidence_level || undefined
      })) as Cluster[]
    }

    console.log(`[PDF] Calling generatePDFReport with data structure`)

    try {
      const pdfBuffer = await generatePDFReport(pdfData)
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error('[PDF] generatePDFReport returned empty buffer')
        return NextResponse.json(
          { error: "PDF generation returned empty result" },
          { status: 500 }
        )
      }

      console.log(`[PDF] PDF generated successfully, buffer size: ${pdfBuffer.length} bytes`)

      // Convert Buffer to Uint8Array for NextResponse
      const pdfUint8Array = new Uint8Array(pdfBuffer)
      
      return new NextResponse(pdfUint8Array, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="reconciliation-${jobId}.pdf"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      })
    } catch (pdfError: any) {
      console.error('[PDF] Error in generatePDFReport:', pdfError)
      console.error('[PDF] Error stack:', pdfError.stack)
      return NextResponse.json(
        { error: `PDF generation failed: ${pdfError.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[PDF] General error:", error)
    console.error("[PDF] Error stack:", error.stack)
    return NextResponse.json(
      { error: `Failed to generate PDF: ${error.message}` },
      { status: 500 }
    )
  }
}
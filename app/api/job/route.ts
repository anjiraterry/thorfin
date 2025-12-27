import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { StartJobRequest, JobSettings, InsertMatchRecord, InsertCluster } from '@/@types'
import { normalizeTransactions } from '@/lib/file-parser'
import { performReconciliation } from '@/lib/matching-engine' // CHANGED: Import new function

const processingJobs = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const body: StartJobRequest = await request.json()
    const { job_id, payout_mapping, ledger_mapping, settings } = body

    if (!job_id || !payout_mapping || !ledger_mapping) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const job = await storage.getJob(job_id)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    const jobData = processingJobs.get(job_id)
    if (!jobData?.payout_data || !jobData?.ledger_data) {
      return NextResponse.json(
        { error: "Job data not found. Please re-upload files." },
        { status: 400 }
      )
    }

    const mergedSettings: JobSettings = {
      amount_tolerance_cents: settings?.amount_tolerance_cents ?? 100,
      time_window_hours: settings?.time_window_hours ?? 48,
      fuzzy_threshold: settings?.fuzzy_threshold ?? 85,
      token_budget: settings?.token_budget ?? 2000,
      max_rows: settings?.max_rows ?? 10000,
    }

    // Update job status
    await storage.updateJob(job_id, {
      status: "processing",
      payout_mapping,
      ledger_mapping,
      settings: mergedSettings,
    })

    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 5 })

    // Process in background (non-blocking)
    processJob(job_id, jobData.payout_data, jobData.ledger_data, payout_mapping, ledger_mapping, mergedSettings)
      .catch(console.error)

    return NextResponse.json({ job_id, status: "processing" })
  } catch (error) {
    console.error("Start error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start processing" },
      { status: 500 }
    )
  }
}

// Background processing function
async function processJob(
  job_id: string,
  payout_data: { columns: string[]; rows: Record<string, unknown>[] },
  ledger_data: { columns: string[]; rows: Record<string, unknown>[] },
  payout_mapping: any,
  ledger_mapping: any,
  settings: JobSettings
) {
  try {
    const job = await storage.getJob(job_id)
    if (!job) throw new Error("Job not found")

    const jobData = processingJobs.get(job_id) || {}
    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 10 })

    // Normalize and store transactions
    const payoutRecords = normalizeTransactions(
      payout_data.rows.slice(0, settings.max_rows),
      payout_mapping,
      "payout",
      job_id,
      job.payout_filename || "payouts.csv"
    )

    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 20 })

    const ledgerRecords = normalizeTransactions(
      ledger_data.rows.slice(0, settings.max_rows),
      ledger_mapping,
      "ledger",
      job_id,
      job.ledger_filename || "ledger.csv"
    )

    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 30 })

    // Batch insert transactions
    const storedPayouts = await storage.createTransactionRecords(payoutRecords)
    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 40 })
    
    const storedLedger = await storage.createTransactionRecords(ledgerRecords)
    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 50 })

    // CHANGED: Use performReconciliation instead of separate functions
    const reconciliationResult = performReconciliation(storedPayouts, storedLedger, settings)
    
    // Extract results from reconciliation
    const matchResults = reconciliationResult.matches
    const clusters = reconciliationResult.clusters
    const unmatchedPayouts = reconciliationResult.unmatched_payouts
    const unmatchedLedger = reconciliationResult.unmatched_ledger
    const total_unmatched_amount_cents = reconciliationResult.total_unmatched_amount_cents // CORRECT VALUE!
    const matched_count = reconciliationResult.matched_count
    const unmatched_count = reconciliationResult.unmatched_count
    const match_rate = reconciliationResult.match_rate

    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 70 })

    // Store matches - FIXED: Added missing 'status' property
    const matchRecords: InsertMatchRecord[] = matchResults.map(result => ({
      job_id,
      payout_id: result.payout_id,
      ledger_id: result.ledger_id,
      score: result.score,
      breakdown: result.score_breakdown,
      match_type: result.match_type,
      confidence_level: result.confidence_level,
      status: 'matched', // Added this required property
      accepted: 0,
      matched_at: new Date().toISOString(),
    }))

    await storage.createMatchRecords(matchRecords)
    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 80 })

    // FIXED: Transform buildClusters result to InsertCluster format
    const clusterRecords: InsertCluster[] = clusters.map((c: any) => ({
      job_id, 
      pivot_id: c.pivot_id || '',
      pivot_type: c.pivot_type || 'payout',
      records: c.records || [],
      amount: c.amount || 0,
      status: c.status || 'unmatched',
      notes: c.notes || '',
      pattern_type: c.pattern_type || 'unknown',
      evidence_ids: [],
      merchant_name: '',
      amount_bucket: '',
      date_bucket: '',
      total_amount_cents: c.amount || 0,
      size: (c.records && c.records.length) || 0,
      llm_summary: '',
      suggested_action: '',
      confidence_level: '',
      token_usage: 0,
      llm_confidence: '',
    }))

    await storage.createClusters(clusterRecords)
    processingJobs.set(job_id, { ...jobData, status: "processing", progress: 90 })

    // CHANGED: Calculate stats using reconciliation results
    const allUnmatched = [...unmatchedPayouts, ...unmatchedLedger]
    
    // DEBUG: Log the difference between old and new calculation
    const old_total_unmatched_amount = allUnmatched.reduce((sum, tx) => sum + tx.amount_cents, 0)
    console.log('=== RECONCILIATION DEBUG ===');
    console.log('Old total unmatched (incorrect):', old_total_unmatched_amount);
    console.log('New total unmatched (correct):', total_unmatched_amount_cents);
    console.log('Difference:', total_unmatched_amount_cents - old_total_unmatched_amount);
    console.log('Match rate:', match_rate);
    console.log('Matches:', matched_count);
    console.log('Unmatched:', unmatched_count);
    console.log('============================');

    // Update job as completed - USING CORRECT total_unmatched_amount_cents
    await storage.updateJob(job_id, {
      status: "completed",
      matched_count: matched_count,
      unmatched_count: unmatched_count,
      match_rate: match_rate,
      total_unmatched_amount_cents: total_unmatched_amount_cents, // This is now CORRECT!
      progress: 100,
      updated_at: new Date().toISOString(),
    })

    processingJobs.set(job_id, { 
      ...jobData, 
      status: "completed", 
      progress: 100, 
      match_rate,
      payout_data: undefined,
      ledger_data: undefined,
    })

  } catch (error) {
    console.error("Processing error:", error)
    
    await storage.updateJob(job_id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Processing failed",
      updated_at: new Date().toISOString(),
    })

    const jobData = processingJobs.get(job_id) || {}
    processingJobs.set(job_id, { 
      ...jobData, 
      status: "failed", 
      progress: 0,
      error_message: error instanceof Error ? error.message : "Processing failed",
    })
  }
}
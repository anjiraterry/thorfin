// app/api/upload/route.ts - UPDATED
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { createClient } from '@/lib/supabase/server'
import type { UploadResponse, InsertJob, ColumnMapping, JobSettings } from '@/@types'
import { handleFileUpload } from '@/lib/utils/upload'

export async function POST(request: NextRequest) {
  try {
    const { payoutFile, ledgerFile, jobName } = await handleFileUpload(request)

    const defaultColumnMapping: ColumnMapping = {
      amount: 'amount',
    };

    const defaultSettings: JobSettings = {
      amount_tolerance_cents: 100,
      time_window_hours: 48,
      fuzzy_threshold: 85,
      token_budget: 2000,
      max_rows: 10000,
    }

    const jobData: InsertJob = {
      name: jobName,
      status: 'pending',
      payout_filename: payoutFile.name,
      ledger_filename: ledgerFile.name,
      payout_row_count: payoutFile.data.rows.length,
      ledger_row_count: ledgerFile.data.rows.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      settings: defaultSettings,
      payout_mapping: defaultColumnMapping,
      ledger_mapping: defaultColumnMapping,
      progress: 0,
      match_rate: 0,
      total_unmatched_amount_cents: 0,
      matched_count: 0,
      unmatched_count: 0,
    }

    const job = await storage.createJob(jobData)

    // Store file data in Supabase temporary table
    const supabase = await createClient()
    
    // Store payout data
    await supabase.from('temp_file_data').insert({
      job_id: job.id,
      source: 'payout',
      filename: payoutFile.name,
      columns: payoutFile.data.columns,
      rows: payoutFile.data.rows,
    })

    // Store ledger data
    await supabase.from('temp_file_data').insert({
      job_id: job.id,
      source: 'ledger',
      filename: ledgerFile.name,
      columns: ledgerFile.data.columns,
      rows: ledgerFile.data.rows,
    })

    const response: UploadResponse = {
      job_id: job.id,
      status: "uploaded",
      payout_columns: payoutFile.data.columns,
      ledger_columns: ledgerFile.data.columns,
      payout_preview: payoutFile.data.rows.slice(0, 5),
      ledger_preview: ledgerFile.data.rows.slice(0, 5),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
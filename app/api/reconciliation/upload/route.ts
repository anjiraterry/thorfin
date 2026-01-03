// app/api/upload/route.ts - UPDATED with currency support
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { createClient } from '@/lib/supabase/server'
import type { UploadResponse, InsertJob, ColumnMapping, JobSettings } from '@/types/@types'
import { handleFileUpload } from '@/lib/utils/upload'

export async function POST(request: NextRequest) {
  try {
    const { payoutFile, ledgerFile, jobName } = await handleFileUpload(request)

    const defaultColumnMapping: ColumnMapping = {
      amount: 'amount',
      currency: 'currency', // Make sure currency mapping is included
      reference: 'reference',
      timestamp: 'created_at', // For payouts
    };

    const defaultSettings: JobSettings = {
      amount_tolerance_cents: 100,
      time_window_hours: 48,
      fuzzy_threshold: 85,
      token_budget: 2000,
      max_rows: 10000,
    }

    // NEW: Extract currency from the first payout row
    const detectCurrency = (rows: any[], columns: string[]): string => {
      try {
        // Find the currency column index
        const currencyColumnIndex = columns.findIndex(col => 
          col.toLowerCase().includes('currency')
        )
        
        if (currencyColumnIndex >= 0 && rows.length > 0) {
          const firstRow = rows[0]
          if (Array.isArray(firstRow)) {
            return firstRow[currencyColumnIndex] || "NGN"
          } else if (typeof firstRow === 'object') {
            // If rows are objects, find currency key
            const currencyKey = Object.keys(firstRow).find(key => 
              key.toLowerCase().includes('currency')
            )
            return currencyKey ? firstRow[currencyKey] : "NGN"
          }
        }
        
        // Check if amount column contains currency symbol
        const amountColumnIndex = columns.findIndex(col => 
          col.toLowerCase().includes('amount')
        )
        
        if (amountColumnIndex >= 0 && rows.length > 0) {
          const firstRow = rows[0]
          let amountValue: string
          
          if (Array.isArray(firstRow)) {
            amountValue = String(firstRow[amountColumnIndex])
          } else if (typeof firstRow === 'object') {
            const amountKey = Object.keys(firstRow).find(key => 
              key.toLowerCase().includes('amount')
            )
            amountValue = amountKey ? String(firstRow[amountKey]) : ""
          } else {
            amountValue = ""
          }
          
          // Check for common currency symbols
          if (amountValue.includes('₦') || amountValue.includes('NGN')) return "NGN"
          if (amountValue.includes('$') || amountValue.includes('USD')) return "USD"
          if (amountValue.includes('€') || amountValue.includes('EUR')) return "EUR"
          if (amountValue.includes('£') || amountValue.includes('GBP')) return "GBP"
        }
        
        return "NGN" // Default to NGN
      } catch (error) {
        console.warn("Could not detect currency, defaulting to NGN:", error)
        return "NGN"
      }
    }

    // Detect currency from payout file (prefer payout over ledger)
    const detectedCurrency = detectCurrency(payoutFile.data.rows, payoutFile.data.columns)
    
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
      // NEW: Add currency to job
      currency: detectedCurrency,
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
      // NEW: Store currency with file data
      metadata: { currency: detectedCurrency },
    })

    // Store ledger data
    await supabase.from('temp_file_data').insert({
      job_id: job.id,
      source: 'ledger',
      filename: ledgerFile.name,
      columns: ledgerFile.data.columns,
      rows: ledgerFile.data.rows,
      // NEW: Store currency with file data
      metadata: { currency: detectedCurrency },
    })

    const response: UploadResponse = {
      job_id: job.id,
      status: "uploaded",
      payout_columns: payoutFile.data.columns,
      ledger_columns: ledgerFile.data.columns,
      payout_preview: payoutFile.data.rows.slice(0, 5),
      ledger_preview: ledgerFile.data.rows.slice(0, 5),
      // NEW: Include currency in response
      currency: detectedCurrency,
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
// app/api/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { performReconciliation } from '@/lib/matching-engine' // Updated import
import type { StartJobRequest, InsertTransactionRecord } from '@/types/@types'
import { createClient } from '@/lib/supabase/server'

// Debug logging function
const debugLog = (stage: string, message: string, data?: any) => {
  console.log(`[DEBUG] ${stage}: ${message}`, data ? JSON.stringify(data, null, 2) : '')
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  debugLog('OPTIONS', 'CORS preflight request received')
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// Handle POST requests
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7)
  debugLog('POST-ENTRY', `Request started - ID: ${requestId}`)

  try {
    debugLog('POST-REQUEST', 'Parsing request body...')
    const body: StartJobRequest = await request.json()
    
    debugLog('POST-DATA', 'Request data received:', {
      job_id: body.job_id,
      has_payout_mapping: !!body.payout_mapping,
      has_ledger_mapping: !!body.ledger_mapping,
      settings: body.settings
    })

    const { job_id, payout_mapping, ledger_mapping, settings } = body

    // Validate required fields
    if (!job_id) {
      debugLog('POST-VALIDATION', 'Missing job_id')
      return NextResponse.json(
        { error: "Missing required field: job_id" },
        { status: 400 }
      )
    }

    if (!payout_mapping) {
      debugLog('POST-VALIDATION', 'Missing payout_mapping')
      return NextResponse.json(
        { error: "Missing required field: payout_mapping" },
        { status: 400 }
      )
    }

    if (!ledger_mapping) {
      debugLog('POST-VALIDATION', 'Missing ledger_mapping')
      return NextResponse.json(
        { error: "Missing required field: ledger_mapping" },
        { status: 400 }
      )
    }

    debugLog('POST-VALIDATION', 'All required fields present')

    // 1. Update job with mappings and settings
    debugLog('JOB-UPDATE', `Updating job ${job_id} in database...`)
    const job = await storage.updateJob(job_id, {
      payout_mapping,
      ledger_mapping,
      settings: {
        amount_tolerance_cents: settings?.amount_tolerance_cents || 100,
        time_window_hours: settings?.time_window_hours || 48,
        fuzzy_threshold: settings?.fuzzy_threshold || 85,
        token_budget: settings?.token_budget || 2000,
        max_rows: settings?.max_rows || 10000,
      },
      status: 'processing',
      progress: 5,
      updated_at: new Date().toISOString(),
    })

    if (!job) {
      debugLog('JOB-ERROR', `Job ${job_id} not found in database`)
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }
    debugLog('JOB-UPDATE', 'Job updated successfully:', job)

    // 2. Start background processing (fire and forget)
    debugLog('BACKGROUND', 'Starting background processing...')
    setTimeout(() => {
      debugLog('BACKGROUND-START', `Starting async processing for job ${job_id}`)
      processJobInBackground(job_id, payout_mapping, ledger_mapping, settings || {})
        .then(() => debugLog('BACKGROUND-END', `Processing completed for job ${job_id}`))
        .catch(error => {
          debugLog('BACKGROUND-ERROR', `Processing failed for job ${job_id}:`, error)
          console.error('Background processing failed:', error)
        })
    }, 0)

    // 3. Create audit log
    debugLog('AUDIT-LOG', 'Creating audit log...')
    await storage.createAuditLog({
      job_id,
      action: "start_processing",
      details: { 
        payout_mapping_keys: Object.keys(payout_mapping),
        ledger_mapping_keys: Object.keys(ledger_mapping),
        settings 
      },
    })
    debugLog('AUDIT-LOG', 'Audit log created')

    debugLog('POST-SUCCESS', `Job ${job_id} started successfully`)
    
    return NextResponse.json({ 
      success: true, 
      job_id,
      status: 'processing',
      message: 'Job started successfully. Processing in background.',
      request_id: requestId
    })

  } catch (error) {
    debugLog('POST-ERROR', 'Error in POST handler:', error)
    
    // More specific error handling
    if (error instanceof SyntaxError) {
      debugLog('POST-ERROR', 'Invalid JSON in request body')
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: "Failed to start processing", 
        details: error instanceof Error ? error.message : "Unknown error",
        request_id: requestId
      },
      { status: 500 }
    )
  }
}

// Handle other methods
export async function GET(request: NextRequest) {
  debugLog('GET-ERROR', 'GET method not allowed for /api/start')
  return NextResponse.json(
    { 
      error: "Method not allowed",
      message: "Use POST method to start processing",
      allowed_methods: ["POST", "OPTIONS"]
    },
    { 
      status: 405,
      headers: {
        'Allow': 'POST, OPTIONS'
      }
    }
  )
}

// Background processing function - UPDATED to use performReconciliation
async function processJobInBackground(
  jobId: string,
  payoutMapping: any,
  ledgerMapping: any,
  settings: any
) {
  const processId = Math.random().toString(36).substring(7)
  debugLog(`PROCESS-${processId}`, `Starting background processing for job ${jobId}`)
  
  try {
    // Update progress
    debugLog(`PROCESS-${processId}`, 'Updating progress to 10%')
    await storage.updateJob(jobId, { progress: 10 })

    // 1. Retrieve file data from temp storage
    debugLog(`PROCESS-${processId}`, 'Creating Supabase client...')
    const supabase = await createClient()
    
    debugLog(`PROCESS-${processId}`, 'Retrieving payout file data from temp_file_data...')
    const payoutData = await supabase
      .from('temp_file_data')
      .select('columns, rows, filename')
      .eq('job_id', jobId)
      .eq('source', 'payout')
      .single()
    
    debugLog(`PROCESS-${processId}`, 'Retrieving ledger file data from temp_file_data...')
    const ledgerData = await supabase
      .from('temp_file_data')
      .select('columns, rows, filename')
      .eq('job_id', jobId)
      .eq('source', 'ledger')
      .single()
    
    debugLog(`PROCESS-${processId}`, 'File data retrieval results:', {
      hasPayoutData: !!payoutData.data,
      hasLedgerData: !!ledgerData.data,
      payoutError: payoutData.error,
      ledgerError: ledgerData.error
    })
    
    if (!payoutData.data || !ledgerData.data) {
      throw new Error(`File data not found. Payout: ${!!payoutData.data}, Ledger: ${!!ledgerData.data}`)
    }

    debugLog(`PROCESS-${processId}`, 'File data found:', {
      payoutRows: payoutData.data.rows.length,
      payoutColumns: payoutData.data.columns.length,
      ledgerRows: ledgerData.data.rows.length,
      ledgerColumns: ledgerData.data.columns.length
    })

    await storage.updateJob(jobId, { progress: 20 })

    // 2. Parse transactions using column mappings
    debugLog(`PROCESS-${processId}`, 'Parsing payout transactions...')
    const payoutTransactions = parseRowsToTransactions(
      jobId,
      'payout',
      payoutData.data.rows,
      payoutMapping,
      payoutData.data.filename
    )
    
    debugLog(`PROCESS-${processId}`, 'Parsing ledger transactions...')
    const ledgerTransactions = parseRowsToTransactions(
      jobId,
      'ledger',
      ledgerData.data.rows,
      ledgerMapping,
      ledgerData.data.filename
    )

    debugLog(`PROCESS-${processId}`, 'Transactions parsed:', {
      payoutCount: payoutTransactions.length,
      ledgerCount: ledgerTransactions.length,
      samplePayout: payoutTransactions[0],
      sampleLedger: ledgerTransactions[0]
    })

    // 3. Store transactions in database
    debugLog(`PROCESS-${processId}`, 'Storing payout transactions in database...')
    await storage.createTransactionRecords(payoutTransactions)
    debugLog(`PROCESS-${processId}`, 'Storing ledger transactions in database...')
    await storage.createTransactionRecords(ledgerTransactions)
    
    debugLog(`PROCESS-${processId}`, 'Transactions stored successfully')
    await storage.updateJob(jobId, { progress: 30 })

    // 4. Run reconciliation using the NEW performReconciliation function
    debugLog(`PROCESS-${processId}`, 'Retrieving stored transactions...')
    const storedPayoutTxs = await storage.getTransactionsByJobAndSource(jobId, 'payout')
    const storedLedgerTxs = await storage.getTransactionsByJobAndSource(jobId, 'ledger')
    
    debugLog(`PROCESS-${processId}`, 'Stored transactions retrieved:', {
      storedPayoutCount: storedPayoutTxs.length,
      storedLedgerCount: storedLedgerTxs.length
    })
    
    debugLog(`PROCESS-${processId}`, 'Running performReconciliation with settings:', settings)
    const reconciliationResult = performReconciliation(
      storedPayoutTxs,
      storedLedgerTxs,
      {
        amount_tolerance_cents: settings.amount_tolerance_cents || 100,
        time_window_hours: settings.time_window_hours || 48,
        fuzzy_threshold: settings.fuzzy_threshold || 85,
        token_budget: settings.token_budget || 2000,
        max_rows: settings.max_rows || 10000,
      }
    )

    debugLog(`PROCESS-${processId}`, 'Reconciliation completed:', {
      matchesFound: reconciliationResult.matches.length,
      clustersCreated: reconciliationResult.clusters.length,
      correctedUnmatchedAmount: reconciliationResult.total_unmatched_amount_cents,
      matchRate: reconciliationResult.match_rate
    })

    await storage.updateJob(jobId, { progress: 50 })

    // 5. Store match results
    debugLog(`PROCESS-${processId}`, 'Storing match results in database...')
    const matchPromises = reconciliationResult.matches.map((match: any) => 
      storage.createMatchRecord({
        job_id: jobId,
        payout_id: match.payout_id,
        ledger_id: match.ledger_id,
        score: match.score,
        breakdown: match.score_breakdown,
        status: 'matched',
        match_type: match.match_type,
        confidence_level: match.confidence_level,
        accepted: 0,
        matched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    )

    await Promise.all(matchPromises)
    debugLog(`PROCESS-${processId}`, 'Match results stored')
    await storage.updateJob(jobId, { progress: 70 })

    // 6. Store clusters (they contain all unmatched transactions)
    debugLog(`PROCESS-${processId}`, 'Storing clusters in database...')
    const clusterPromises = reconciliationResult.clusters.map((cluster: any) =>
      storage.createCluster({
        job_id: jobId,
        pivot_id: cluster.pivot_id,
        pivot_type: cluster.pivot_type,
        records: cluster.records,
        amount: cluster.amount,
        status: cluster.status,
        notes: cluster.notes,
        merchant_name: cluster.merchant_name,
        size: cluster.size,
        created_at: new Date().toISOString(),

      })
    )

    await Promise.all(clusterPromises)
    debugLog(`PROCESS-${processId}`, 'Clusters stored')
    await storage.updateJob(jobId, { progress: 90 })

    // 7. Calculate the old unmatched amount (for comparison/debug)
    const allUnmatched = [...reconciliationResult.unmatched_payouts, ...reconciliationResult.unmatched_ledger]
    const oldUnmatchedAmount = allUnmatched.reduce(
      (sum: number, tx: any) => sum + tx.amount_cents, 0
    )
    
    debugLog(`PROCESS-${processId}`, 'Unmatched amount comparison:', {
      correctedAmount: reconciliationResult.total_unmatched_amount_cents,
      oldAmount: oldUnmatchedAmount,
      difference: reconciliationResult.total_unmatched_amount_cents - oldUnmatchedAmount
    })

    // 8. Clean up temp file data
    debugLog(`PROCESS-${processId}`, 'Cleaning up temporary file data...')
    const cleanupResult = await supabase
      .from('temp_file_data')
      .delete()
      .eq('job_id', jobId)

    debugLog(`PROCESS-${processId}`, 'Cleanup completed:', cleanupResult)

    // 9. Update job completion with CORRECTED unmatched amount
    debugLog(`PROCESS-${processId}`, 'Updating job completion status...')
    await storage.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      match_rate: reconciliationResult.match_rate,
      total_unmatched_amount_cents: reconciliationResult.total_unmatched_amount_cents, // CORRECTED value
      matched_count: reconciliationResult.matched_count,
      unmatched_count: reconciliationResult.unmatched_count,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    debugLog(`PROCESS-${processId}`, 'Creating completion audit log...')
    await storage.createAuditLog({
      job_id: jobId,
      action: "processing_completed",
      details: {
        matches_found: reconciliationResult.matched_count,
        unmatched_count: reconciliationResult.unmatched_count,
        match_rate: reconciliationResult.match_rate,
        clusters_created: reconciliationResult.clusters.length,
        corrected_unmatched_amount: reconciliationResult.total_unmatched_amount_cents,
        old_unmatched_amount: oldUnmatchedAmount,
        difference: reconciliationResult.total_unmatched_amount_cents - oldUnmatchedAmount
      },
    })

    debugLog(`PROCESS-${processId}`, `Job ${jobId} completed successfully!`)

  } catch (error) {
    debugLog(`PROCESS-${processId}`, `Error in background processing for job ${jobId}:`, error)
    console.error(`Background processing error for job ${jobId}:`, error)
    
    // Update job with error status
    debugLog(`PROCESS-${processId}`, 'Updating job status to failed...')
    await storage.updateJob(jobId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Processing failed',
      updated_at: new Date().toISOString(),
    })
    
    debugLog(`PROCESS-${processId}`, 'Creating failure audit log...')
    await storage.createAuditLog({
      job_id: jobId,
      action: "processing_failed",
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
    })

    throw error
  }
}

// Helper function to parse CSV rows to TransactionRecord objects
function parseRowsToTransactions(
  jobId: string,
  source: 'payout' | 'ledger',
  rows: any[],
  mapping: any,
  filename: string
): InsertTransactionRecord[] {
  debugLog('PARSER', `Parsing ${rows.length} rows for ${source}`, {
    jobId,
    filename,
    mappingKeys: Object.keys(mapping)
  })

  return rows.map((row, index) => {
    // Debug individual row parsing if needed
    if (index < 3) { // Log first 3 rows for debugging
      debugLog('PARSER-ROW', `Row ${index} data:`, row)
    }

    const getValue = (field: string) => {
      const colName = mapping[field]
      const value = colName ? row[colName] : undefined
      
      if (index < 3 && value !== undefined) {
        debugLog('PARSER-FIELD', `Field ${field} (column ${colName}):`, value)
      }
      
      return value
    }

    // Helper to parse amount safely
    const parseAmount = (value: any): number => {
      if (value === null || value === undefined) {
        debugLog('PARSER-AMOUNT', `Empty amount at row ${index}, defaulting to 0`)
        return 0
      }
      
      const num = typeof value === 'string' 
        ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
        : Number(value)
      
      const result = Math.round((isNaN(num) ? 0 : num) * 100)
      
      if (index < 3) {
        debugLog('PARSER-AMOUNT', `Parsed amount: ${value} -> ${result} cents`)
      }
      
      return result
    }

    // Helper to parse date/timestamp
    const parseTimestamp = (value: any): string => {
      if (!value) {
        debugLog('PARSER-TIMESTAMP', `Empty timestamp at row ${index}, using current time`)
        return new Date().toISOString()
      }
      
      try {
        if (typeof value === 'string') {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toISOString()
          }
          debugLog('PARSER-TIMESTAMP', `Could not parse date string: ${value}`)
        }
        debugLog('PARSER-TIMESTAMP', `Using current time for value: ${value}`)
        return new Date().toISOString()
      } catch (error) {
        debugLog('PARSER-TIMESTAMP-ERROR', `Error parsing timestamp ${value}:`, error)
        return new Date().toISOString()
      }
    }

    const tx_id = getValue('tx_id')
    const amount_cents = parseAmount(getValue('amount'))
    const currency = getValue('currency') || 'USD'
    const timestamp = parseTimestamp(getValue('timestamp'))
    const fee_cents = getValue('fee') ? parseAmount(getValue('fee')) : undefined
    const merchant_id = getValue('merchant_id')
    const reference = getValue('reference')

    const transaction = {
      job_id: jobId,
      source,
      source_filename: filename,
      row_index: index + 1,
      tx_id,
      amount_cents,
      currency,
      timestamp,
      fee_cents,
      merchant_id,
      reference,
      raw: row,
      created_at: new Date().toISOString(),
    }

    if (index < 3) {
      debugLog('PARSER-RESULT', `Parsed transaction ${index}:`, transaction)
    }

    return transaction
  })
}
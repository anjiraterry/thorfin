import { NextRequest } from 'next/server'
import { parseFile } from '@/lib/file-parser'

export async function handleFileUpload(request: NextRequest) {
  const formData = await request.formData()
  const payoutFile = formData.get('payoutFile') as File
  const ledgerFile = formData.get('ledgerFile') as File
  const jobName = formData.get('jobName') as string || `Reconciliation ${new Date().toISOString()}`
  
  if (!payoutFile || !ledgerFile) {
    throw new Error("Both payout and ledger files are required")
  }

  const payoutBuffer = Buffer.from(await payoutFile.arrayBuffer())
  const ledgerBuffer = Buffer.from(await ledgerFile.arrayBuffer())
  
  const payoutData = parseFile(payoutFile.name, payoutBuffer)
  const ledgerData = parseFile(ledgerFile.name, ledgerBuffer)

  return {
    payoutFile: { name: payoutFile.name, buffer: payoutBuffer, data: payoutData },
    ledgerFile: { name: ledgerFile.name, buffer: ledgerBuffer, data: ledgerData },
    jobName
  }
}
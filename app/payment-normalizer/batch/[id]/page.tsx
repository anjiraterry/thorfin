'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  FileCheck,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  CheckCheck,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Progress } from '@/src/components/ui/progress'
import { useToast } from '@/src/hooks/use-toast'
import { BatchStatusResponse } from '@/types/payment-normalizer-types'


export default function BatchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const batchId = params.id as string

  const [data, setData] = useState<BatchStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  useEffect(() => {
    fetchBatchStatus()
    const interval = setInterval(fetchBatchStatus, 5000)
    return () => clearInterval(interval)
  }, [batchId])

  const fetchBatchStatus = async () => {
    try {
      const response = await fetch(`/api/payment-normalizer/batches/${batchId}/status`)
      if (!response.ok) throw new Error('Failed to fetch batch status')
      const result: BatchStatusResponse = await response.json()
      setData(result)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load batch status',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcess = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/payment-normalizer/batches/${batchId}/process`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to start processing')
      
      toast({
        title: 'Processing started',
        description: 'Your batch is being processed',
      })
      
      setTimeout(fetchBatchStatus, 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start processing',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCommit = async () => {
    setIsCommitting(true)
    try {
      const response = await fetch(`/api/payment-normalizer/batches/${batchId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'current-user' }),
      })
      
      if (!response.ok) throw new Error('Failed to commit batch')
      
      const result = await response.json()
      
      toast({
        title: 'Batch committed',
        description: `${result.events_committed} events committed, ${result.transactions_created} transactions created`,
      })
      
      fetchBatchStatus()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to commit batch',
        variant: 'destructive',
      })
    } finally {
      setIsCommitting(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading batch...</p>
        </div>
      </div>
    )
  }

  const { batch, stats } = data
  const progressPercent = stats.total_events > 0 
    ? ((stats.normalized_events + stats.committed_events) / stats.total_events) * 100 
    : 0

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/payment-normalizer')}
            className="mb-4 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Batches
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-2">
                {batch.name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Created {new Date(batch.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`
                ${batch.status === 'ready' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'}
                ${batch.status === 'processing' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'}
                ${batch.status === 'committed' && 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}
                ${batch.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'}
                border-none
              `}>
                {batch.status}
              </Badge>
            </div>
          </div>
        </div>

        {progressPercent > 0 && progressPercent < 100 && (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Processing Progress
              </span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {progressPercent.toFixed(0)}%
              </span>
            </div>
            <Progress value={progressPercent} indicatorColor="blue" className="h-2" />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <FileCheck className="h-5 w-5 text-slate-400" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.total_files}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Files Uploaded</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.pending_events}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pending Review</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.normalized_events}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Normalized</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCheck className="h-5 w-5 text-slate-400" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.committed_events}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Committed</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Manage this batch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {batch.status === 'processing' && (
                <>
                  <label htmlFor="invoice-upload" className="block">
                    <input
                      id="invoice-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        const formData = new FormData()
                        formData.append('file', file)
                        
                        try {
                          const res = await fetch(`/api/payment-normalizer/batches/${batchId}/invoices`, {
                            method: 'POST',
                            body: formData,
                          })
                          if (!res.ok) throw new Error('Upload failed')
                          const data = await res.json()
                          toast({
                            title: 'Invoices uploaded',
                            description: `${data.invoices_imported} invoices imported`,
                          })
                          fetchBatchStatus()
                        } catch (err: any) {
                          toast({
                            title: 'Upload failed',
                            description: err.message,
                            variant: 'destructive',
                          })
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => document.getElementById('invoice-upload')?.click()}
                    >
                      <FileCheck className="mr-2 h-4 w-4" />
                      Upload Invoice File
                    </Button>
                  </label>
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full rounded-xl bg-blue-500 hover:bg-blue-600"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {isProcessing ? 'Processing...' : 'Start Processing'}
                  </Button>
                </>
              )}

              {batch.status === 'ready' && (
                <Button
                  onClick={() => router.push(`/payment-normalizer/batch/${batchId}/events`)}
                  className="w-full rounded-xl bg-blue-500 hover:bg-blue-600"
                >
                  Review Payment Events
                </Button>
              )}

              {(batch.status === 'ready' || batch.status === 'reviewing') && stats.normalized_events > 0 && (
                <Button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="w-full rounded-xl bg-green-500 hover:bg-green-600"
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  {isCommitting ? 'Committing...' : `Commit ${stats.normalized_events} Events`}
                </Button>
              )}

              {batch.status === 'committed' && (
                <div className="text-center py-4 text-sm text-slate-600 dark:text-slate-400">
                  This batch has been committed to reconciliation
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
            <CardHeader>
              <CardTitle>Batch Info</CardTitle>
              <CardDescription>Configuration details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Mode:</span>
                <span className="font-medium text-slate-900 dark:text-white">{batch.mode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Invoices:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {stats.total_invoices || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Proofs:</span>
                <span className="font-medium text-slate-900 dark:text-white">{stats.total_proofs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Payment Events:</span>
                <span className="font-medium text-slate-900 dark:text-white">{stats.total_events}</span>
              </div>
              {stats.total_invoices > 0 && (
                <>
                  <hr className="border-slate-200 dark:border-gray-700" />
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Paid:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {stats.paid_invoices || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Partially Paid:</span>
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">
                      {stats.partially_paid_invoices || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Unpaid:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {stats.unpaid_invoices || 0}
                    </span>
                  </div>
                </>
              )}
              <hr className="border-slate-200 dark:border-gray-700" />
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Last Updated:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {new Date(batch.updated_at).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
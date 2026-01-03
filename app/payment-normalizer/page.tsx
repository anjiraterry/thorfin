'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSpreadsheet,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/src/components/ui/card'
import { useToast } from '@/src/hooks/use-toast'
import { PaymentBatch, BatchListResponse } from '@/types/payment-normalizer-types'


function StatusBadge({ status }: { status: PaymentBatch['status'] }) {
  const variants: Record<PaymentBatch['status'], { color: string; label: string; icon: any }> = {
    processing: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200', label: 'Processing', icon: Clock },
    ready: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200', label: 'Ready', icon: CheckCircle },
    reviewing: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200', label: 'Reviewing', icon: AlertCircle },
    committed: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200', label: 'Committed', icon: CheckCircle },
    failed: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200', label: 'Failed', icon: AlertCircle },
  }

  const variant = variants[status]
  const Icon = variant.icon

  return (
    <Badge className={`${variant.color} border-none flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {variant.label}
    </Badge>
  )
}

function BatchCard({ batch }: { batch: PaymentBatch }) {
  const router = useRouter()

  return (
    <Card 
      className="border-2 border-slate-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all cursor-pointer rounded-xl"
      onClick={() => router.push(`/payment-normalizer/batch/${batch.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {batch.name}
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
              Created {new Date(batch.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <StatusBadge status={batch.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Mode: <span className="font-medium">{batch.mode}</span>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function PaymentNormalizerDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [batches, setBatches] = useState<PaymentBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchBatches()
  }, [page])

  const fetchBatches = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/payment-normalizer/batches?page=${page}&limit=12`)
      
      if (!response.ok) throw new Error('Failed to fetch batches')
      
      const data: BatchListResponse = await response.json()
      setBatches(data.batches)
      setTotalPages(data.pagination.pages)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load batches',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-7xl px-6 py-12">
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                <Sparkles className="h-4 w-4" />
                Payment Normalizer
              </div>
              <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-3">
                Payment Batches
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Normalize messy payment proofs into clean, reconcilable records
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => router.push('/payment-normalizer/create')}
              className="rounded-xl bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Batch
            </Button>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16">
            <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No batches yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Create your first payment batch to get started
            </p>
            <Button
              onClick={() => router.push('/payment-normalizer/create')}
              className="rounded-xl bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Batch
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
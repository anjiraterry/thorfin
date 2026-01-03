'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Card, CardContent } from '@/src/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useToast } from '@/src/hooks/use-toast'
import { PaymentEvent, PaymentEventsListResponse } from '@/types/payment-normalizer-types'


function StatusBadge({ status }: { status: PaymentEvent['status'] }) {
  const variants: Record<PaymentEvent['status'], { color: string; label: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200', label: 'Pending' },
    suggested: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200', label: 'Suggested' },
    normalized: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200', label: 'Normalized' },
    committed: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200', label: 'Committed' },
  }

  const variant = variants[status]

  return (
    <Badge className={`${variant.color} border-none`}>
      {variant.label}
    </Badge>
  )
}

function PaymentEventCard({ event, onClick }: { event: PaymentEvent; onClick: () => void }) {
  return (
    <Card 
      className="border-2 border-slate-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all cursor-pointer rounded-xl"
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {event.payer_name || 'Unknown Payer'}
              </h3>
              <StatusBadge status={event.status} />
            </div>
            {event.payer_account && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Account: {event.payer_account}
              </p>
            )}
            {event.received_date && (
              <p className="text-xs text-slate-500">
                {new Date(event.received_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Amount</span>
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {event.received_currency} {event.received_amount?.toLocaleString()}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Allocations</span>
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {event.suggested_allocations?.length || 0} suggested
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PaymentEventsPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const batchId = params.id as string

  const [events, setEvents] = useState<PaymentEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchEvents()
  }, [page, statusFilter])

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`
      const response = await fetch(
        `/api/payment-normalizer/payment-events?batch_id=${batchId}&page=${page}&limit=12${statusParam}`
      )
      
      if (!response.ok) throw new Error('Failed to fetch events')
      
      const data: PaymentEventsListResponse = await response.json()
      setEvents(data.events)
      setTotalPages(data.pagination.pages)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment events',
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
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push(`/payment-normalizer/batch/${batchId}`)}
            className="mb-4 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Batch
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-2">
                Payment Events
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Review and allocate payments to invoices
              </p>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suggested">Suggested</SelectItem>
                <SelectItem value="normalized">Normalized</SelectItem>
                <SelectItem value="committed">Committed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="h-16 w-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No payment events found
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {statusFilter !== 'all' 
                ? 'Try changing the status filter'
                : 'Process the batch to extract payment events'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {events.map((event) => (
                <PaymentEventCard
                  key={event.id}
                  event={event}
                  onClick={() => router.push(`/payment-normalizer/event/${event.id}`)}
                />
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
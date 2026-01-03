'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  DollarSign,
  Calendar,
  User,
  CreditCard,
  Plus,
  Save,
  CheckCircle,
  Download,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/src/components/ui/card'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Textarea } from '@/src/components/ui/textarea'
import { Badge } from '@/src/components/ui/badge'
import { useToast } from '@/src/hooks/use-toast'
import { PaymentEventDetailResponse } from '@/types/payment-normalizer-types'


export default function PaymentEventDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const eventId = params.id as string

  const [data, setData] = useState<PaymentEventDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [allocations, setAllocations] = useState<Array<{
    target_invoice_id: string
    allocated_amount: number
    allocation_reason?: string
  }>>([])

  useEffect(() => {
    fetchEventDetail()
  }, [eventId])

  const fetchEventDetail = async () => {
    try {
      const response = await fetch(`/api/payment-normalizer/payment-events/${eventId}`)
      if (!response.ok) throw new Error('Failed to fetch event detail')
      
      const result: PaymentEventDetailResponse = await response.json()
      setData(result)
      
      // Initialize allocations with existing ones or suggested ones
      if (result.allocations.length > 0) {
        setAllocations(result.allocations.map(a => ({
          target_invoice_id: a.target_invoice_id || '',
          allocated_amount: a.allocated_amount,
          allocation_reason: a.allocation_reason,
        })))
      } else if (result.event.suggested_allocations?.length > 0) {
        setAllocations(result.event.suggested_allocations.map(s => ({
          target_invoice_id: s.target_invoice_id,
          allocated_amount: s.allocated_amount,
          allocation_reason: s.reason,
        })))
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment event',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addAllocation = () => {
    setAllocations([...allocations, {
      target_invoice_id: '',
      allocated_amount: 0,
      allocation_reason: '',
    }])
  }

  const updateAllocation = (index: number, field: string, value: any) => {
    const updated = [...allocations]
    updated[index] = { ...updated[index], [field]: value }
    setAllocations(updated)
  }

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index))
  }

  const handleSaveAllocations = async () => {
    if (!data) return

    const validAllocations = allocations.filter(
      a => a.target_invoice_id && a.allocated_amount > 0
    )

    if (validAllocations.length === 0) {
      toast({
        title: 'No valid allocations',
        description: 'Please add at least one allocation with invoice ID and amount',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(
        `/api/payment-normalizer/payment-events/${eventId}/allocate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allocations: validAllocations,
            user_id: 'current-user',
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to save allocations')

      toast({
        title: 'Allocations saved',
        description: `${validAllocations.length} allocation(s) saved successfully`,
      })

      fetchEventDetail()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save allocations',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading payment event...</p>
        </div>
      </div>
    )
  }

  const { event, proofs, deductions } = data
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_amount, 0)
  const isFullyAllocated = totalAllocated === (event.received_amount || 0)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-2">
                Payment Event Detail
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Review and allocate this payment
              </p>
            </div>
            <Badge className={`
              ${event.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200'}
              ${event.status === 'normalized' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'}
              ${event.status === 'committed' && 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}
              border-none text-base px-4 py-2
            `}>
              {event.status}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Left column - Payment details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <Label className="text-sm font-medium">Payer Name</Label>
                  </div>
                  <p className="text-base text-slate-900 dark:text-white">
                    {event.payer_name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-slate-400" />
                    <Label className="text-sm font-medium">Payer Account</Label>
                  </div>
                  <p className="text-base text-slate-900 dark:text-white font-mono">
                    {event.payer_account || 'N/A'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    <Label className="text-sm font-medium">Received Amount</Label>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {event.received_currency} {event.received_amount?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <Label className="text-sm font-medium">Payment Date</Label>
                  </div>
                  <p className="text-base text-slate-900 dark:text-white">
                    {event.received_date 
                      ? new Date(event.received_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Gross/Net breakdown */}
            {(event.gross_amount || event.net_amount || deductions.length > 0) && (
              <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
                <CardHeader>
                  <CardTitle>Gross to Net Breakdown</CardTitle>
                  <CardDescription>Fees and deductions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {event.gross_amount && (
                    <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-gray-700">
                      <span className="text-slate-600 dark:text-slate-400">Gross Amount</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {event.received_currency} {event.gross_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {deductions.map((deduction) => (
                    <div key={deduction.id} className="flex justify-between text-sm">
                      <span className="text-red-600 dark:text-red-400">
                        {deduction.type} {deduction.tax_code && `(${deduction.tax_code})`}
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        - {event.received_currency} {deduction.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {event.net_amount && (
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-gray-700">
                      <span className="font-medium text-slate-900 dark:text-white">Net Amount</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {event.received_currency} {event.net_amount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Allocations */}
            <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Allocations</CardTitle>
                    <CardDescription>
                      Allocate to invoice(s) • Total: {event.received_currency} {totalAllocated.toLocaleString()} / {event.received_amount?.toLocaleString()}
                    </CardDescription>
                  </div>
                  {isFullyAllocated && (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {allocations.map((allocation, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="grid gap-4 sm:grid-cols-2 mb-3">
                      <div>
                        <Label className="text-xs mb-1">Invoice ID</Label>
                        <Input
                          placeholder="INV-12345"
                          value={allocation.target_invoice_id}
                          onChange={(e) => updateAllocation(idx, 'target_invoice_id', e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1">Amount</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={allocation.allocated_amount || ''}
                          onChange={(e) => updateAllocation(idx, 'allocated_amount', parseFloat(e.target.value) || 0)}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label className="text-xs mb-1">Reason (optional)</Label>
                      <Textarea
                        placeholder="Allocation notes..."
                        value={allocation.allocation_reason || ''}
                        onChange={(e) => updateAllocation(idx, 'allocation_reason', e.target.value)}
                        className="rounded-xl"
                        rows={2}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAllocation(idx)}
                      className="text-red-600 hover:text-red-700 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                
                <Button
                  variant="outline"
                  onClick={addAllocation}
                  className="w-full rounded-xl border-dashed"
                  disabled={event.status === 'committed'}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Allocation
                </Button>

                {event.status !== 'committed' && (
                  <Button
                    onClick={handleSaveAllocations}
                    disabled={isSaving || allocations.length === 0}
                    className="w-full rounded-xl bg-blue-500 hover:bg-blue-600"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Allocations'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Proofs */}
          <div className="space-y-6">
            <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Proof Documents ({proofs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {proofs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No proof documents attached
                  </p>
                ) : (
                  proofs.map((proof) => (
                    <div
                      key={proof.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                            {proof.extracted_payer || 'Proof Document'}
                          </p>
                          {proof.extracted_amount && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Amount: {proof.extracted_currency} {proof.extracted_amount.toLocaleString()}
                            </p>
                          )}
                          {proof.ocr_confidence && (
                            <p className="text-xs text-slate-500">
                              Confidence: {(proof.ocr_confidence * 100).toFixed(0)}%
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                      {proof.narration && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 p-2 rounded">
                          {proof.narration}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
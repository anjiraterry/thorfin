'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSpreadsheet,
  Upload,
  Check,
  ArrowLeft,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/src/components/ui/card'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useToast } from '@/src/hooks/use-toast'

interface FileDropZoneProps {
  label: string
  description: string
  file: File | null
  onFileDrop: (file: File) => void
  accept: string
}

function FileDropZone({ label, description, file, onFileDrop, accept }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) onFileDrop(droppedFile)
    },
    [onFileDrop]
  )

  return (
    <div
      className={`relative min-h-[200px] cursor-pointer rounded-2xl border-2 p-6 text-center transition-all flex flex-col items-center justify-center ${
        isDragging
          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
          : file
          ? 'border-blue-400 bg-blue-50/30 dark:bg-blue-900/10'
          : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg dark:border-gray-800 dark:bg-slate-800/60'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={(e) => e.target.files && onFileDrop(e.target.files[0])}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />

      {file ? (
        <>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Check className="h-6 w-6 text-blue-600 dark:text-blue-300" />
          </div>
          <p className="text-base font-medium text-slate-900 dark:text-white">
            {file.name}
          </p>
          <p className="text-sm text-slate-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </>
      ) : (
        <>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700">
            <Upload className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
            {label}
          </h3>
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
          <div className="text-xs text-slate-500">
            Drag & drop or click to browse
          </div>
        </>
      )}
    </div>
  )
}

export default function CreateBatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [batchName, setBatchName] = useState('')
  const [mode, setMode] = useState<'PROOFS_ONLY' | 'PAYMENTS_CSV' | 'HYBRID'>('HYBRID')
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const addFile = (file: File) => {
    setFiles((prev) => [...prev, file])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    if (!batchName.trim()) {
      toast({
        title: 'Missing batch name',
        description: 'Please provide a name for this batch',
        variant: 'destructive',
      })
      return
    }

    if (files.length === 0) {
      toast({
        title: 'No files uploaded',
        description: 'Please upload at least one file',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    try {
      // Create batch
      const batchResponse = await fetch('/api/payment-normalizer/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName,
          mode,
        }),
      })

      if (!batchResponse.ok) throw new Error('Failed to create batch')

      const { batch } = await batchResponse.json()

      // Upload files
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const uploadResponse = await fetch(
          `/api/payment-normalizer/batches/${batch.id}/files`,
          {
            method: 'POST',
            body: formData,
          }
        )

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      toast({
        title: 'Batch created successfully',
        description: `${files.length} file(s) uploaded`,
      })

      router.push(`/payment-normalizer/batch/${batch.id}`)
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-4xl px-6 py-12">
        <section className="mb-12">
          <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-3">
            Create Payment Batch
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Upload payment proofs and CSV files to begin normalization
          </p>
        </section>

        <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-2xl mb-8">
          <CardHeader>
            <CardTitle>Batch Configuration</CardTitle>
            <CardDescription>Set up your batch details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="batch-name">Batch Name</Label>
              <Input
                id="batch-name"
                placeholder="e.g., Nov 2025 Hospital Payments"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode">Processing Mode</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger id="mode" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="PROOFS_ONLY">Proofs Only (PDFs/Images)</SelectItem>
                  <SelectItem value="PAYMENTS_CSV">Payments CSV Only</SelectItem>
                  <SelectItem value="HYBRID">Hybrid (CSV + Proofs)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'PROOFS_ONLY' && 'Upload payment proof images/PDFs for OCR extraction'}
                {mode === 'PAYMENTS_CSV' && 'Upload structured payment CSV files'}
                {mode === 'HYBRID' && 'Combine CSV payments with supporting proof documents'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 dark:border-gray-800 rounded-2xl mb-8">
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>Add CSV files, PDFs, or images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropZone
              label="Drop files here"
              description="CSV, PDF, JPG, PNG supported"
              file={null}
              onFileDrop={addFile}
              accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
            />

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files ({files.length})</Label>
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(idx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-gray-800 dark:bg-slate-800/60">
          <div className="flex gap-3">
            <Info className="mt-1 h-5 w-5 text-blue-500" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-900 dark:text-white mb-1">
                What happens next
              </p>
              <p>
                Files will be processed to extract payment data. You'll review and allocate
                payments to invoices before committing to reconciliation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="rounded-xl border-slate-300 dark:border-gray-700"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isUploading || !batchName || files.length === 0}
            className="rounded-xl bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600"
          >
            {isUploading ? 'Creating...' : 'Create Batch'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  )
}
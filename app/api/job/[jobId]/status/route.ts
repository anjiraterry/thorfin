// app/api/job/[jobId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { JobStatusResponse } from '@/@types'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = await params
    
    const job = await storage.getJob(jobId)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    const response: JobStatusResponse = {
      job_id: job.id,
      status: job.status,
      progress: job.progress ?? 0,
      match_rate: job.match_rate ?? undefined,
      matched_count: job.matched_count ?? undefined,
      unmatched_count: job.unmatched_count ?? undefined,
      error_message: job.error_message ?? undefined,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Status error:", error)
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    )
  }
}
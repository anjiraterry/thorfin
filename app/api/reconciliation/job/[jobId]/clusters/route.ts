import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { PaginatedClustersResponse } from '@/types/@types'

const DEFAULT_CLUSTERS_LIMIT = 10
const MAX_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string } >}
) {
  try {
    const { jobId } = await params
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(
      parseInt(searchParams.get('limit') || DEFAULT_CLUSTERS_LIMIT.toString()),
      MAX_LIMIT
    )
    const offset = (page - 1) * limit

    const totalClusters = await storage.getClustersCount(jobId)
    const clusters = await storage.getClustersByJobPaginated(
      jobId, 
      limit, 
      offset
    )

    const response: PaginatedClustersResponse = {
      clusters,
      pagination: {
        page,
        limit,
        total: totalClusters,
        pages: Math.ceil(totalClusters / limit)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Clusters error:", error)
    return NextResponse.json(
      { error: "Failed to get clusters" },
      { status: 500 }
    )
  }
}
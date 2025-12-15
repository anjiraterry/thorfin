import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import type { PaginatedMatchesResponse } from '@/@types'

const DEFAULT_MATCHES_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = await params
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(
      parseInt(searchParams.get('limit') || DEFAULT_MATCHES_LIMIT.toString()),
      MAX_LIMIT
    )
    const offset = (page - 1) * limit
    const searchQuery = searchParams.get('search') || ''

    const totalMatches = await storage.getMatchesCount(jobId, searchQuery)
    const matches = await storage.getMatchesWithTransactionsPaginated(
      jobId, 
      limit, 
      offset, 
      searchQuery
    )

    const response: PaginatedMatchesResponse = {
      matches,
      pagination: {
        page,
        limit,
        total: totalMatches,
        pages: Math.ceil(totalMatches / limit)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Matches error:", error)
    return NextResponse.json(
      { error: "Failed to get matches" },
      { status: 500 }
    )
  }
}
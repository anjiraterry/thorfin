import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    
    const match = await storage.getMatchById(matchId)
    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      )
    }

    await storage.updateMatch(matchId, { accepted: 1 })
    await storage.createAuditLog({
      job_id: match.job_id,
      action: "accept",
      details: { score: match.score, match_type: match.match_type },
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Accept error:", error)
    return NextResponse.json(
      { error: "Failed to accept match" },
      { status: 500 }
    )
  }
}
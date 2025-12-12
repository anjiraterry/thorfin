import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/supabase-storage'
import { generateClusterSummary } from '@/lib/openai-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { clusterId: string } }
) {
  try {
    const { clusterId } = await params
    
    const cluster = await storage.getClusterById(clusterId)
    if (!cluster) {
      return NextResponse.json(
        { error: "Cluster not found" },
        { status: 404 }
      )
    }

    const job = await storage.getJob(cluster.job_id)
    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    const evidenceTransactions: any[] = []
    for (const txId of (cluster.evidence_ids || []).slice(0, 10)) {
      const tx = await storage.getTransactionById(txId)
      if (tx) evidenceTransactions.push(tx)
    }

    const result = await generateClusterSummary(
      cluster,
      evidenceTransactions,
      job.match_rate || 0,
      job.total_unmatched_amount_cents || 0
    )

    await storage.updateCluster(clusterId, {
      llm_summary: result.summary,
      suggested_action: result.suggested_action,
      llm_confidence: result.confidence_level,
      token_usage: result.token_usage,
    })

    await storage.createAuditLog({
      job_id: cluster.job_id,
      action: "generate_summary",
      target_id: clusterId,
      target_type: "cluster",
      details: { token_usage: result.token_usage },
    })

    return NextResponse.json({ 
      llm_summary: result.summary, 
      suggested_action: result.suggested_action,
      llm_confidence: result.confidence_level,
      token_usage: result.token_usage,
    })
  } catch (error) {
    console.error("Generate summary error:", error)
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    )
  }
}
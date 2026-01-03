import OpenAI from "openai";
import type { TransactionRecord, Cluster } from "@/types/@types";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// Lazy initialization to avoid startup errors when API key is not set
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface ClusterSummaryResult {
  summary: string;
  suggested_action: string;
  confidence_level: string;
  token_usage: number;
}

export async function generateClusterSummary(
  cluster: Cluster,
  evidenceTransactions: TransactionRecord[],
  match_rate: number,
  total_unmatched_amount_cents: number
): Promise<ClusterSummaryResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      summary: "AI summary unavailable - OpenAI API key not configured.",
      suggested_action: "Please configure the OpenAI API key to enable AI summaries.",
      confidence_level: "low",
      token_usage: 0,
    };
  }

  const evidenceSnippets = evidenceTransactions.slice(0, 10).map((tx) => ({
    tx_id: tx.tx_id,
    source: tx.source,
    amount_cents: tx.amount_cents,
    merchant: tx.merchant_id,
    reference: tx.reference,
    timestamp: tx.timestamp,
  }));

  const systemPrompt = `You are a factual summarizer for financial reconciliation. Do not invent facts. Always include the exact transaction IDs and details from the evidence. If something is ambiguous, mark as uncertain. Output JSON with keys: summary, suggested_action, confidence_level (high/medium/low).`;

  const userPrompt = JSON.stringify({
    cluster_id: cluster.id,
    merchant_name: cluster.merchant_name,
    amount_bucket: cluster.amount_bucket,
    date_bucket: cluster.date_bucket,
    total_unmatched_cents: cluster.total_amount_cents,
    transaction_count: cluster.size,
    evidence: evidenceSnippets,
    context: {
      overall_match_rate: match_rate,
      total_unmatched_amount_cents: total_unmatched_amount_cents,
    },
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Changed from "gpt-5" (doesn't exist yet)
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content);
    const token_usage = response.usage?.total_tokens || 0;

    return {
      summary: result.summary || "Unable to generate summary.",
      suggested_action: result.suggested_action || "Review transactions manually.",
      confidence_level: result.confidence_level || "low",
      token_usage,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      summary: `Error generating AI summary: ${error instanceof Error ? error.message : "Unknown error"}`,
      suggested_action: "Please try again or review transactions manually.",
      confidence_level: "low",
      token_usage: 0,
    };
  }
}
import type { TransactionRecord, ScoreBreakdown, InsertMatchRecord, JobSettings } from "@/@types";

const WEIGHTS = {
  exact: 40,
  amount: 25,
  time: 20,
  fuzzy: 15,
};

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

function tokenSortRatio(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const normalize = (s: string) => 
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);
  
  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;
  
  const distance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  
  return Math.round((1 - distance / maxLen) * 100);
}

function normalizeTimestamp(timestamp: string | null | undefined): Date | null {
  if (!timestamp) return null;
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    const parts = timestamp.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (parts) {
      return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
    }
    return null;
  }
  return date;
}

function calculateTimeDifferenceHours(ts1: string | null | undefined, ts2: string | null | undefined): number | null {
  const date1 = normalizeTimestamp(ts1);
  const date2 = normalizeTimestamp(ts2);
  
  if (!date1 || !date2) return null;
  
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return diffMs / (1000 * 60 * 60);
}

function normalizeMerchant(merchant: string | null | undefined): string {
  if (!merchant) return "";
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export interface MatchResult {
  payout_id: string;
  ledger_id: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  match_type: "exact" | "deterministic" | "fuzzy";
  confidence_level: "high" | "medium" | "low";
}

export function runMatchingEngine(
  payouts: TransactionRecord[],
  ledger_entries: TransactionRecord[],
  settings: JobSettings
): MatchResult[] {
  const matches: MatchResult[] = [];
  const matched_payout_ids = new Set<string>();
  const matched_ledger_ids = new Set<string>();

  // Pass 1: Exact matching by tx_id
  for (const payout of payouts) {
    if (!payout.tx_id || matched_payout_ids.has(payout.id)) continue;
    
    for (const ledger of ledger_entries) {
      if (!ledger.tx_id || matched_ledger_ids.has(ledger.id)) continue;
      
      if (payout.tx_id === ledger.tx_id) {
        const score_breakdown: ScoreBreakdown = {
          exact_match: 1,
          amount_score: payout.amount_cents === ledger.amount_cents ? 1 : 0.5,
          time_score: 1,
          fuzzy_score: 1,
          weights: WEIGHTS,
        };
        
        const score = calculateWeightedScore(score_breakdown);
        
        matches.push({
          payout_id: payout.id,
          ledger_id: ledger.id,
          score,
          score_breakdown: score_breakdown,
          match_type: "exact",
          confidence_level: score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low",
        });
        
        matched_payout_ids.add(payout.id);
        matched_ledger_ids.add(ledger.id);
        break;
      }
    }
  }

  // Pass 2: Deterministic matching (amount + time window)
  for (const payout of payouts) {
    if (matched_payout_ids.has(payout.id)) continue;
    
    let bestMatch: { ledger: TransactionRecord; score: number; breakdown: ScoreBreakdown } | null = null;
    
    for (const ledger of ledger_entries) {
      if (matched_ledger_ids.has(ledger.id)) continue;
      
      const amount_diff = Math.abs(payout.amount_cents - ledger.amount_cents);
      if (amount_diff > settings.amount_tolerance_cents) continue;
      
      const hours_diff = calculateTimeDifferenceHours(payout.timestamp, ledger.timestamp);
      if (hours_diff !== null && hours_diff > settings.time_window_hours) continue;
      
      const amount_score = Math.max(0, 1 - amount_diff / settings.amount_tolerance_cents);
      const time_score = hours_diff !== null 
        ? Math.max(0, 1 - hours_diff / settings.time_window_hours)
        : 0.5;
      
      const merchant_match = normalizeMerchant(payout.merchant_id) === normalizeMerchant(ledger.merchant_id);
      const fuzzy_score = tokenSortRatio(payout.reference || "", ledger.reference || "") / 100;
      
      const score_breakdown: ScoreBreakdown = {
        exact_match: 0,
        amount_score,
        time_score,
        fuzzy_score: merchant_match ? Math.max(fuzzy_score, 0.7) : fuzzy_score,
        weights: WEIGHTS,
      };
      
      const score = calculateWeightedScore(score_breakdown);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { ledger, score, breakdown: score_breakdown };
      }
    }
    
    if (bestMatch && bestMatch.score >= 0.5) {
      matches.push({
        payout_id: payout.id,
        ledger_id: bestMatch.ledger.id,
        score: bestMatch.score,
        score_breakdown: bestMatch.breakdown,
        match_type: "deterministic",
        confidence_level: bestMatch.score >= 0.85 ? "high" : bestMatch.score >= 0.6 ? "medium" : "low",
      });
      
      matched_payout_ids.add(payout.id);
      matched_ledger_ids.add(bestMatch.ledger.id);
    }
  }

  // Pass 3: Fuzzy matching on reference/merchant
  for (const payout of payouts) {
    if (matched_payout_ids.has(payout.id)) continue;
    
    let bestMatch: { ledger: TransactionRecord; score: number; breakdown: ScoreBreakdown } | null = null;
    
    for (const ledger of ledger_entries) {
      if (matched_ledger_ids.has(ledger.id)) continue;
      
      const amount_diff = Math.abs(payout.amount_cents - ledger.amount_cents);
      if (amount_diff > settings.amount_tolerance_cents) continue;
      
      const fuzzy_score_ref = tokenSortRatio(payout.reference || "", ledger.reference || "");
      const fuzzy_score_merchant = tokenSortRatio(payout.merchant_id || "", ledger.merchant_id || "");
      const fuzzy_score_max = Math.max(fuzzy_score_ref, fuzzy_score_merchant);
      
      if (fuzzy_score_max < settings.fuzzy_threshold) continue;
      
      const amount_score = Math.max(0, 1 - amount_diff / settings.amount_tolerance_cents);
      const hours_diff = calculateTimeDifferenceHours(payout.timestamp, ledger.timestamp);
      const time_score = hours_diff !== null 
        ? Math.max(0, 1 - hours_diff / settings.time_window_hours)
        : 0.5;
      
      const score_breakdown: ScoreBreakdown = {
        exact_match: 0,
        amount_score,
        time_score,
        fuzzy_score: fuzzy_score_max / 100,
        weights: WEIGHTS,
      };
      
      const score = calculateWeightedScore(score_breakdown);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { ledger, score, breakdown: score_breakdown };
      }
    }
    
    if (bestMatch && bestMatch.score >= 0.4) {
      matches.push({
        payout_id: payout.id,
        ledger_id: bestMatch.ledger.id,
        score: bestMatch.score,
        score_breakdown: bestMatch.breakdown,
        match_type: "fuzzy",
        confidence_level: bestMatch.score >= 0.85 ? "high" : bestMatch.score >= 0.6 ? "medium" : "low",
      });
      
      matched_payout_ids.add(payout.id);
      matched_ledger_ids.add(bestMatch.ledger.id);
    }
  }

  return matches;
}

function calculateWeightedScore(breakdown: ScoreBreakdown): number {
  const total = 
    breakdown.exact_match * WEIGHTS.exact +
    breakdown.amount_score * WEIGHTS.amount +
    breakdown.time_score * WEIGHTS.time +
    breakdown.fuzzy_score * WEIGHTS.fuzzy;
  
  return total / (WEIGHTS.exact + WEIGHTS.amount + WEIGHTS.time + WEIGHTS.fuzzy);
}

export interface ClusterData {
  pivot_id: string;
  pivot_type: "payout" | "ledger";
  records: TransactionRecord[];
  amount: number;
  status: "unmatched" | "partial" | "resolved";
  notes?: string;
}

// This function is for grouping transactions into clusters
export function buildClusters(unmatched_transactions: TransactionRecord[]): ClusterData[] {
  const cluster_data: ClusterData[] = [];
  const merchant_map = new Map<string, ClusterData>();
  
  for (const tx of unmatched_transactions) {
    const merchant_normalized = normalizeMerchant(tx.merchant_id) || "unknown";
    
    if (merchant_map.has(merchant_normalized)) {
      const cluster = merchant_map.get(merchant_normalized)!;
      cluster.records.push(tx);
      cluster.amount += tx.amount_cents;
    } else {
      const new_cluster: ClusterData = {
        pivot_id: tx.id,
        pivot_type: tx.source,
        records: [tx],
        amount: tx.amount_cents,
        status: "unmatched",
      };
      merchant_map.set(merchant_normalized, new_cluster);
    }
  }
  
  // Convert map to array
  for (const cluster of merchant_map.values()) {
    cluster_data.push(cluster);
  }
  
  return cluster_data;
}
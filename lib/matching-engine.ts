import type { TransactionRecord, ScoreBreakdown, InsertMatchRecord, JobSettings, Cluster } from "@/types/@types";

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
      return new Date(Date.UTC(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3])));
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

function amountsMatchConsideringSignAndStatus(
  payout: TransactionRecord, 
  ledger: TransactionRecord, 
  tolerance_cents: number
): boolean {
  const payoutAmount = payout.amount_cents;
  const ledgerAmount = ledger.amount_cents;

  const payoutStatus = payout.raw?.status;
  const ledgerType = ledger.raw?.type;
 
  if (payoutStatus === 'FAILED') {
    return false;
  }
  
  if (payoutStatus === 'SUCCESS') {
    const amountMatch = Math.abs(payoutAmount + ledgerAmount) <= tolerance_cents;
    return amountMatch && ledgerType === 'DEBIT' && ledgerAmount < 0;
  }
  
  if (payoutStatus === 'REVERSED') {
    const amountMatch = Math.abs(payoutAmount - ledgerAmount) <= tolerance_cents;
    return amountMatch && ledgerType === 'CREDIT' && ledgerAmount > 0;
  }
  
  return Math.abs(payoutAmount - ledgerAmount) <= tolerance_cents;
}

function calculateAmountScoreConsideringSignAndStatus(
  payout: TransactionRecord, 
  ledger: TransactionRecord, 
  tolerance_cents: number
): number {
  const payoutAmount = payout.amount_cents;
  const ledgerAmount = ledger.amount_cents;
  
  const payoutStatus = payout.raw?.status;
  const ledgerType = ledger.raw?.type;
  
  if (payoutStatus === 'FAILED') {
    return 0;
  }
  
  if (payoutStatus === 'SUCCESS') {
    if (ledgerType !== 'DEBIT' || ledgerAmount >= 0) {
      return 0;
    }
    const diff = Math.abs(payoutAmount + ledgerAmount);
    return Math.max(0, 1 - diff / tolerance_cents);
  }
  
  if (payoutStatus === 'REVERSED') {
    if (ledgerType !== 'CREDIT' || ledgerAmount <= 0) {
      return 0;
    }
    const diff = Math.abs(payoutAmount - ledgerAmount);
    return Math.max(0, 1 - diff / tolerance_cents);
  }
  
  const diff = Math.abs(payoutAmount - ledgerAmount);
  return Math.max(0, 1 - diff / tolerance_cents);
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
          amount_score: amountsMatchConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents) ? 1 : 0,
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

  // Pass 2: Exact reference matching
  for (const payout of payouts) {
    if (matched_payout_ids.has(payout.id)) continue;
    
    if (payout.raw?.status === 'FAILED') continue;
    
    for (const ledger of ledger_entries) {
      if (matched_ledger_ids.has(ledger.id)) continue;
      
      if (payout.reference && ledger.reference && payout.reference === ledger.reference) {
        if (!amountsMatchConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents)) {
          continue;
        }
        
        const hours_diff = calculateTimeDifferenceHours(payout.timestamp, ledger.timestamp);
        const time_score = hours_diff !== null && hours_diff <= settings.time_window_hours ? 1 : 0;
        
        const score_breakdown: ScoreBreakdown = {
          exact_match: 1,
          amount_score: calculateAmountScoreConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents),
          time_score,
          fuzzy_score: 1,
          weights: WEIGHTS,
        };
        
        const score = calculateWeightedScore(score_breakdown);
        
        if (score >= 0.5) {
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
  }

  // Pass 3: Deterministic matching
  for (const payout of payouts) {
    if (matched_payout_ids.has(payout.id)) continue;
    if (payout.raw?.status === 'FAILED') continue;
    
    let bestMatch: { ledger: TransactionRecord; score: number; breakdown: ScoreBreakdown } | null = null;
    
    for (const ledger of ledger_entries) {
      if (matched_ledger_ids.has(ledger.id)) continue;
      
      if (!amountsMatchConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents)) {
        continue;
      }
      
      const hours_diff = calculateTimeDifferenceHours(payout.timestamp, ledger.timestamp);
      if (hours_diff !== null && hours_diff > settings.time_window_hours) continue;
      
      const amount_score = calculateAmountScoreConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents);
      const time_score = hours_diff !== null 
        ? Math.max(0, 1 - hours_diff / settings.time_window_hours)
        : 0.5;
      
      const fuzzy_score = tokenSortRatio(payout.reference || "", ledger.reference || "") / 100;
      
      const score_breakdown: ScoreBreakdown = {
        exact_match: 0,
        amount_score,
        time_score,
        fuzzy_score,
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

  // Pass 4: Fuzzy matching
  for (const payout of payouts) {
    if (matched_payout_ids.has(payout.id)) continue;
    if (payout.raw?.status === 'FAILED') continue;
    
    let bestMatch: { ledger: TransactionRecord; score: number; breakdown: ScoreBreakdown } | null = null;
    
    for (const ledger of ledger_entries) {
      if (matched_ledger_ids.has(ledger.id)) continue;
      
      if (!amountsMatchConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents)) {
        continue;
      }
      
      const fuzzy_score_ref = tokenSortRatio(payout.reference || "", ledger.reference || "") / 100;
      if (fuzzy_score_ref < settings.fuzzy_threshold / 100) continue;
      
      const amount_score = calculateAmountScoreConsideringSignAndStatus(payout, ledger, settings.amount_tolerance_cents);
      const hours_diff = calculateTimeDifferenceHours(payout.timestamp, ledger.timestamp);
      const time_score = hours_diff !== null 
        ? Math.max(0, 1 - hours_diff / settings.time_window_hours)
        : 0.5;
      
      const score_breakdown: ScoreBreakdown = {
        exact_match: 0,
        amount_score,
        time_score,
        fuzzy_score: fuzzy_score_ref,
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
  size: number;
  pivot_id: string;
  pivot_type: "payout" | "ledger";
  records: TransactionRecord[];
  amount: number;
  status: "unmatched" | "partial" | "resolved" | "reversed" | "fee" | "failed";
  notes?: string;
  merchant_name: string;
}

/**
 * Build clusters with intelligent categorization
 * Uses proper status values: "failed", "fee", "reversed", "unmatched", "partial"
 */
export function buildClusters(
  unmatched_transactions: TransactionRecord[],
  matched_transactions: TransactionRecord[] = []
): ClusterData[] {
  const cluster_data: ClusterData[] = [];
  let clusterCounter = 1;

  // 1. FAILED payouts cluster - Use "failed" status
  const failed_payouts = unmatched_transactions.filter(
    tx => tx.source === "payout" && tx.raw?.status === 'FAILED'
  );

  if (failed_payouts.length > 0) {
    cluster_data.push({
      pivot_id: failed_payouts[0].id,
      pivot_type: "payout",
      records: failed_payouts,
      amount: failed_payouts.reduce((sum, tx) => sum + tx.amount_cents, 0),
      status: "failed",
      notes: "FAILED payouts - no ledger entries expected (NO CASH IMPACT)",
      merchant_name: `Cluster ${clusterCounter++} - Failed Payouts`,
      size: failed_payouts.length
    });
  }

  // 2. NOISE transactions cluster - Use "unmatched" status
  const noise_transactions = unmatched_transactions.filter(
    tx => tx.reference?.startsWith("NOISE-")
  );

  if (noise_transactions.length > 0) {
    cluster_data.push({
      pivot_id: noise_transactions[0].id,
      pivot_type: "ledger",
      records: noise_transactions,
      amount: noise_transactions.reduce((sum, tx) => sum + tx.amount_cents, 0),
      status: "unmatched",
      notes: "NOISE transactions - internal entries (TRUE CASH IMPACT)",
      merchant_name: `Cluster ${clusterCounter++} - Noise Transactions`,
      size: noise_transactions.length
    });
  }

  // 3. Create a map of matched references and their amounts for fee detection
  const matchedRefs = new Map<string, number>();
  for (const tx of matched_transactions) {
    if (tx.reference) {
      matchedRefs.set(tx.reference, Math.abs(tx.amount_cents));
    }
  }

  // 4. Group TXN- entries by reference
  const txn_entries = unmatched_transactions.filter(
    tx => tx.reference?.startsWith("TXN-") && 
          !failed_payouts.includes(tx) && 
          !noise_transactions.includes(tx)
  );

  // Group by reference (not individual entries)
  const txn_by_reference = new Map<string, TransactionRecord[]>();
  for (const tx of txn_entries) {
    if (!txn_by_reference.has(tx.reference!)) {
      txn_by_reference.set(tx.reference!, []);
    }
    txn_by_reference.get(tx.reference!)!.push(tx);
  }

  // Process each TXN reference group together
  for (const [ref, txs] of txn_by_reference) {
    if (txs.length === 0) continue;

    // Sort by absolute amount descending
    const sorted = [...txs].sort((a, b) => 
      Math.abs(b.amount_cents) - Math.abs(a.amount_cents)
    );

    const main_tx = sorted[0];
    const others = sorted.slice(1);

    // Check if this reference was matched (i.e., appears in matched_transactions)
    const wasMatched = matchedRefs.has(ref);
    const matchedAmount = matchedRefs.get(ref) || 0;

    // Check if this is a fee group (multiple entries with same reference)
    if (txs.length > 1) {
      // For multiple entries with same reference, check if they're fees
      // Criteria: smaller amounts than the matched transaction (if it was matched)
      const is_fee_group = others.every(fee => {
        if (wasMatched) {
          // If this reference was matched, fees should be much smaller than the matched amount
          const ratio = Math.abs(fee.amount_cents) / matchedAmount;
          return ratio > 0.001 && ratio < 0.05; // 0.1% to 5% of matched amount
        } else {
          // If not matched, use relative size compared to largest in group
          const ratio = Math.abs(fee.amount_cents) / Math.abs(main_tx.amount_cents);
          return ratio > 0.001 && ratio < 0.05; // 0.1% to 5% of largest in group
        }
      });

      if (is_fee_group) {
        // All entries with this reference are fees - group them together
        cluster_data.push({
          pivot_id: main_tx.id,
          pivot_type: main_tx.source,
          records: txs,
          amount: txs.reduce((sum, tx) => sum + tx.amount_cents, 0),
          status: "fee",
          notes: wasMatched 
            ? `Fees attached to matched transaction ${ref} (NO CASH IMPACT)`
            : "Fees for unmatched transaction (NO CASH IMPACT)",
          merchant_name: `Cluster ${clusterCounter++} - Fees (${ref})`,
          size: txs.length
        });
        continue;
      }
    }

    // Check if SINGLE entry is a fee
    // Criteria: same reference as a matched transaction AND smaller amount
    if (txs.length === 1) {
      const tx = txs[0];
      
      if (wasMatched) {
        // This reference was matched - check if this is a fee (smaller than matched amount)
        const is_smaller_fee = Math.abs(tx.amount_cents) < matchedAmount * 0.05; // Less than 5% of matched amount
        
        if (is_smaller_fee) {
          // Single small amount entry with same reference as matched transaction - treat as fee
          cluster_data.push({
            pivot_id: tx.id,
            pivot_type: tx.source,
            records: txs,
            amount: tx.amount_cents,
            status: "fee",
            notes: `Fee for matched transaction ${ref} (NO CASH IMPACT)`,
            merchant_name: `Cluster ${clusterCounter++} - Fee (${ref})`,
            size: txs.length
          });
          continue;
        }
      }
    }

    // Check if this is a reversal
    // NEW LOGIC: Check if this appears as a reversal in the data
    // Look for matching references where one is SUCCESS and one is REVERSED
    if (txs.length === 1) {
      const tx = txs[0];
      
      // Check if this might be a reversal
      // Criteria: Debit entry, negative amount, and there's a matching REVERSED payout
      const is_potential_reversal = tx.raw?.type === 'DEBIT' && 
                                   tx.amount_cents < 0;
      
      if (is_potential_reversal) {
        // Check if there's a REVERSED payout with the same reference
        const reversedPayout = matched_transactions.find(
          m => m.reference === ref && m.raw?.status === 'REVERSED'
        );
        
        if (reversedPayout) {
          // This is a reversal of a REVERSED payout
          cluster_data.push({
            pivot_id: tx.id,
            pivot_type: "ledger",
            records: txs,
            amount: tx.amount_cents,
            status: "reversed",
            notes: `Reversal of REVERSED payout ${ref} (NO CASH IMPACT)`,
            merchant_name: `Cluster ${clusterCounter++} - Reversal (${ref})`,
            size: txs.length
          });
          continue;
        }
      }
    }

    // If multiple entries with same reference but not fees
    cluster_data.push({
      pivot_id: txs[0].id,
      pivot_type: txs[0].source,
      records: txs,
      amount: txs.reduce((sum, tx) => sum + tx.amount_cents, 0),
      status: txs.length > 1 ? "partial" : "unmatched",
      notes: txs.length > 1 
        ? `Multiple entries for same reference - ${txs.length} transactions (POTENTIAL CASH IMPACT)`
        : wasMatched 
          ? `Unmatched entry for reference ${ref} (matched elsewhere)` 
          : "Single unmatched transaction (POTENTIAL CASH IMPACT)",
      merchant_name: `Cluster ${clusterCounter++} - ${ref}`,
      size: txs.length
    });
  }

  // 5. Handle any remaining uncategorized transactions
  const categorized = new Set([
    ...failed_payouts.map(t => t.id),
    ...noise_transactions.map(t => t.id),
    ...txn_entries.map(t => t.id)
  ]);

  const remaining = unmatched_transactions.filter(tx => !categorized.has(tx.id));

  if (remaining.length > 0) {
    // Check if remaining are fees (share reference with matched transactions)
    const fee_entries = remaining.filter(tx => {
      if (!tx.reference) return false;
      return matchedRefs.has(tx.reference) && 
             Math.abs(tx.amount_cents) < (matchedRefs.get(tx.reference)! * 0.05);
    });

    const other_entries = remaining.filter(tx => !fee_entries.includes(tx));

    // Create cluster for fees
    if (fee_entries.length > 0) {
      cluster_data.push({
        pivot_id: fee_entries[0].id,
        pivot_type: fee_entries[0].source,
        records: fee_entries,
        amount: fee_entries.reduce((sum, tx) => sum + tx.amount_cents, 0),
        status: "fee",
        notes: "Miscellaneous fee entries (NO CASH IMPACT)",
        merchant_name: `Cluster ${clusterCounter++} - Miscellaneous Fees`,
        size: fee_entries.length
      });
    }

    // Create cluster for other entries
    if (other_entries.length > 0) {
      cluster_data.push({
        pivot_id: other_entries[0].id,
        pivot_type: other_entries[0].source,
        records: other_entries,
        amount: other_entries.reduce((sum, tx) => sum + tx.amount_cents, 0),
        status: "unmatched",
        notes: "Other unmatched entries (POTENTIAL CASH IMPACT)",
        merchant_name: `Cluster ${clusterCounter++} - Other Entries`,
        size: other_entries.length
      });
    }
  }

  // 6. Sort clusters by status in specific order, then by amount within each status
  const statusOrder: Record<string, number> = {
    'failed': 1,
    'reversed': 2,
    'fee': 3,
    'partial': 4,
    'unmatched': 5
  };

  return cluster_data
    .filter(cluster => cluster.records.length > 0)
    .sort((a, b) => {
      // First sort by status
      const statusA = statusOrder[a.status] || 99;
      const statusB = statusOrder[b.status] || 99;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      // Within same status, sort by absolute amount (largest first)
      const amountA = Math.abs(a.amount);
      const amountB = Math.abs(b.amount);
      return amountB - amountA;
    })
    .map((cluster, index) => {
      // Update merchant names to reflect status grouping
      const statusDisplay = {
        'failed': 'Failed Payouts',
        'reversed': 'Reversed Entries',
        'fee': 'Fee Entries',
        'partial': 'Partial Matches',
        'unmatched': 'Unmatched Entries',
        'resolved' : 'Resolved '
      }[cluster.status] || cluster.status;

      return {
        ...cluster,
        merchant_name: `Cluster ${index + 1} - ${statusDisplay}`,
      };
    });
}
/**
 * Calculate TRUE unmatched amount - only real cash flow imbalances
 * 
 * EXCLUDES (based on status):
 * - status === "failed" (FAILED payouts - no money moved)
 * - status === "fee" (Fee entries - part of matched transactions)
 * - status === "reversed" (Reversal debits - offset by credits)
 * 
 * INCLUDES:
 * - status === "unmatched" (NOISE and other genuine unmatched)
 * - status === "partial" (Multiple entries that need investigation)
 */
export function calculateTotalUnmatchedAmount(
  unmatched_payouts: TransactionRecord[],
  unmatched_ledger: TransactionRecord[],
  clusters: (Cluster | ClusterData)[]
): number {
  let true_unmatched_cents = 0;
  const counted_ids = new Set<string>();
  
  // Process each cluster based on status
  for (const cluster of clusters) {
    // ✅ Exclude by status: failed, fee, reversed
    if (cluster.status === 'failed' || 
        cluster.status === 'fee' || 
        cluster.status === 'reversed') {
      // Mark as counted but don't include in total
      cluster.records.forEach(r => counted_ids.add(r.id));
      continue;
    }
    
    // ✅ Include: unmatched, partial, resolved
    true_unmatched_cents += cluster.amount;
    cluster.records.forEach(r => counted_ids.add(r.id));
  }
  
  // Handle any unclustered transactions
  const unclustered_payouts = unmatched_payouts.filter(p => !counted_ids.has(p.id));
  const unclustered_ledger = unmatched_ledger.filter(l => !counted_ids.has(l.id));
  
  for (const payout of unclustered_payouts) {
    // Exclude FAILED payouts
    if (payout.raw?.status === 'FAILED') {
      continue;
    }
    true_unmatched_cents += payout.amount_cents;
  }
  
  for (const ledger of unclustered_ledger) {
    // Exclude small fees (< 10000 cents = $100)
    if (Math.abs(ledger.amount_cents) < 10000 && ledger.reference?.startsWith('TXN-')) {
      continue;
    }
    true_unmatched_cents += ledger.amount_cents;
  }
  
  return true_unmatched_cents;
}

/**
 * Main reconciliation function
 */
export function performReconciliation(
  payouts: TransactionRecord[],
  ledger_entries: TransactionRecord[],
  settings: JobSettings
): {
  matches: MatchResult[];
  clusters: ClusterData[];
  unmatched_payouts: TransactionRecord[];
  unmatched_ledger: TransactionRecord[];
  total_unmatched_amount_cents: number;
  matched_count: number;
  unmatched_count: number;
  match_rate: number;
} {
  // 1. Run matching engine
  const matches = runMatchingEngine(payouts, ledger_entries, settings);

  // 2. Identify unmatched transactions
  const matched_payout_ids = new Set(matches.map(m => m.payout_id));
  const matched_ledger_ids = new Set(matches.map(m => m.ledger_id));

  const unmatched_payouts = payouts.filter(p => !matched_payout_ids.has(p.id));
  const unmatched_ledger = ledger_entries.filter(l => !matched_ledger_ids.has(l.id));

  // 3. Get all matched transactions for fee detection
  const matched_payouts = payouts.filter(p => matched_payout_ids.has(p.id));
  const matched_ledgers = ledger_entries.filter(l => matched_ledger_ids.has(l.id));
  const all_matched_transactions = [...matched_payouts, ...matched_ledgers];

  // 4. Build clusters with intelligent categorization AND matched transactions
  const clusters = buildClusters(
    [...unmatched_payouts, ...unmatched_ledger],
    all_matched_transactions // Pass matched transactions for fee detection
  );

  // 5. Calculate TRUE total unmatched amount (only real cash impacts)
  const total_unmatched_amount_cents = calculateTotalUnmatchedAmount(
    unmatched_payouts,
    unmatched_ledger,
    clusters
  );

  // 6. Calculate metrics
  const matched_count = matches.length;
  const unmatched_count = unmatched_payouts.length + unmatched_ledger.length;
  const match_rate = payouts.length > 0 ? matched_count / payouts.length : 0;

  return {
    matches,
    clusters,
    unmatched_payouts,
    unmatched_ledger,
    total_unmatched_amount_cents,
    matched_count,
    unmatched_count,
    match_rate
  };
}

/**
 * Export helper function for getting corrected total
 */
export function getCorrectedTotalUnmatchedAmount(
  unmatched_payouts: TransactionRecord[],
  unmatched_ledger: TransactionRecord[],
  clusters: Cluster[]
): number {
  return calculateTotalUnmatchedAmount(unmatched_payouts, unmatched_ledger, clusters);
}
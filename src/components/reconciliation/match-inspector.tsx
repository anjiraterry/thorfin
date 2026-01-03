import { Check, X, ArrowRight, Info } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Separator } from "@/src/components/ui/separator";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Progress } from "@/src/components/ui/progress";
import type { MatchRecord, TransactionRecord, ScoreBreakdown } from "@/types/@types";

interface MatchInspectorProps {
  match?: (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord }) | null;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const percentage = value * 100;
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">{label}</span>
        <span className="font-mono text-slate-900 dark:text-white font-medium">
          {percentage.toFixed(0)}% <span className="text-slate-400 dark:text-slate-500">(w:{weight})</span>
        </span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function TransactionDetails({ tx, title }: { tx: TransactionRecord; title: string }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-900 dark:text-white">{title}</h4>
      <Card className="border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">Transaction ID</span>
            <span className="font-mono text-xs text-slate-900 dark:text-white font-medium">{tx.tx_id || "-"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">Amount</span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              {formatCents(tx.amount_cents)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">Merchant</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[150px] font-medium">
              {tx.merchant_id || "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">Date</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : "-"}
            </span>
          </div>
          {tx.reference && (
            <div className="pt-3 border-t border-slate-100 dark:border-gray-700">
              <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Reference</span>
              <span className="text-xs text-slate-600 dark:text-slate-300 break-all font-medium">{tx.reference}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchInspector({ match, onAccept, onReject, isAccepting, isRejecting }: MatchInspectorProps) {
  if (!match) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <Info className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Select a match to view details</p>
        </div>
      </div>
    );
  }

  const breakdown = match.breakdown as ScoreBreakdown;
  const totalScore = match.score * 100;

  const confidenceColors: Record<string, string> = {
    high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  };

  const matchTypeColors: Record<string, string> = {
    exact: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    deterministic: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    fuzzy: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    cluster: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  };

  // Fixed TypeScript error by providing default value
  const confidenceLevel = match.confidence_level || "medium";
  const matchType = match.match_type || "fuzzy";

  return (
    <div className="h-full flex flex-col">
    
        <div className="space-y-6 pb-4">
          {/* Header with score and badges */}
          <div className="flex items-start justify-between">
            <div>
              <Badge 
                variant="outline" 
                className={`capitalize mb-2 ${matchTypeColors[matchType]}`}
              >
                {matchType}
              </Badge>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Match Details</h3>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {totalScore.toFixed(0)}%
              </p>
              <Badge 
                variant="outline" 
                className={`mt-1 capitalize ${confidenceColors[confidenceLevel]}`}
              >
                {confidenceLevel} confidence
              </Badge>
            </div>
          </div>

          <Separator className="bg-slate-200 dark:bg-gray-700" />

          {/* Score Breakdown */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-900 dark:text-white">Score Breakdown</h4>
            <ScoreBar
              label="Exact Match"
              value={breakdown.exact_match}
              weight={breakdown.weights.exact}
            />
            <ScoreBar
              label="Amount"
              value={breakdown.amount_score}
              weight={breakdown.weights.amount}
            />
            <ScoreBar
              label="Timestamp"
              value={breakdown.time_score}
              weight={breakdown.weights.time}
            />
            <ScoreBar
              label="Fuzzy Reference"
              value={breakdown.fuzzy_score}
              weight={breakdown.weights.fuzzy}
            />
          </div>

          <Separator className="bg-slate-200 dark:bg-gray-700" />

          {/* Transaction Details */}
          <div className="space-y-6">
            <TransactionDetails tx={match.payout} title="Payout Record" />
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-slate-200 dark:bg-gray-700"></div>
                </div>
                <div className="relative bg-white dark:bg-gray-800 px-4">
                  <ArrowRight className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </div>
            <TransactionDetails tx={match.ledger} title="Ledger Record" />
          </div>

          <Separator className="bg-slate-200 dark:bg-gray-700" />

          {/* Action Buttons */}
          {match.accepted === 0 && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400"
                onClick={onReject}
                disabled={isRejecting}
                data-testid="button-reject-match"
              >
                <X className="h-4 w-4 mr-2" />
                {isRejecting ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                className="flex-1 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
                onClick={onAccept}
                disabled={isAccepting}
                data-testid="button-accept-match"
              >
                <Check className="h-4 w-4 mr-2" />
                {isAccepting ? "Accepting..." : "Accept"}
              </Button>
            </div>
          )}

          {/* Accepted/Rejected Status */}
          {match.accepted === 1 && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-center">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Match Accepted</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                This match has been accepted and recorded
              </p>
            </div>
          )}

          {match.accepted === -1 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center">
              <X className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Match Rejected</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                This match has been rejected
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 p-4">
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Payout Row:</span>
                <span className="font-mono text-slate-900 dark:text-white">#{match.payout.row_index + 1}</span>
              </div>
              <div className="flex justify-between">
                <span>Ledger Row:</span>
                <span className="font-mono text-slate-900 dark:text-white">#{match.ledger.row_index + 1}</span>
              </div>
              <div className="flex justify-between">
                <span>Matched:</span>
                <span className="text-slate-900 dark:text-white">
                  {new Date(match.matched_at).toLocaleString()}
                </span>
              </div>
              {match.updated_at && (
                <div className="flex justify-between">
                  <span>Updated:</span>
                  <span className="text-slate-900 dark:text-white">
                    {new Date(match.updated_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
    
    </div>
  );
}
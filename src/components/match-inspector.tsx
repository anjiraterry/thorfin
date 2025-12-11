import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import type { MatchRecord, TransactionRecord, ScoreBreakdown } from "@shared/schema";

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

function ScoreBar({ label, value, weight, color }: { label: string; value: number; weight: number; color: string }) {
  const percentage = value * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {percentage.toFixed(0)}% <span className="text-muted-foreground">(w:{weight})</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function TransactionDetails({ tx, title }: { tx: TransactionRecord; title: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="bg-background rounded-md p-3 space-y-2 border">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">ID</span>
          <span className="font-mono text-xs">{tx.txId || "-"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Amount</span>
          <span className="font-mono text-sm font-medium">{formatCents(tx.amountCents)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Merchant</span>
          <span className="text-xs truncate max-w-[150px]">{tx.merchantId || "-"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Date</span>
          <span className="text-xs">{tx.timestamp || "-"}</span>
        </div>
        {tx.reference && (
          <div className="pt-2 border-t">
            <span className="text-xs text-muted-foreground block mb-1">Reference</span>
            <span className="text-xs break-all">{tx.reference}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchInspector({ match, onAccept, onReject, isAccepting, isRejecting }: MatchInspectorProps) {
  if (!match) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Select a match to view details</p>
        </div>
      </div>
    );
  }

  const breakdown = match.scoreBreakdown as ScoreBreakdown;
  const totalScore = match.score * 100;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline" className="capitalize mb-2">
              {match.matchType}
            </Badge>
            <h3 className="text-lg font-semibold">Match Details</h3>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold font-mono">{totalScore.toFixed(0)}%</p>
            <Badge
              variant={match.confidenceLevel === "high" ? "default" : match.confidenceLevel === "medium" ? "secondary" : "destructive"}
              className="capitalize"
            >
              {match.confidenceLevel}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Score Breakdown</h4>
          <ScoreBar
            label="Exact Match"
            value={breakdown.exactMatch}
            weight={breakdown.weights.exact}
            color="bg-chart-1"
          />
          <ScoreBar
            label="Amount"
            value={breakdown.amountScore}
            weight={breakdown.weights.amount}
            color="bg-chart-2"
          />
          <ScoreBar
            label="Timestamp"
            value={breakdown.timeScore}
            weight={breakdown.weights.time}
            color="bg-chart-4"
          />
          <ScoreBar
            label="Fuzzy Reference"
            value={breakdown.fuzzyScore}
            weight={breakdown.weights.fuzzy}
            color="bg-chart-3"
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <TransactionDetails tx={match.payout} title="Payout Record" />
          <div className="flex justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <TransactionDetails tx={match.ledger} title="Ledger Record" />
        </div>

        <Separator />

        {match.accepted === 0 && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onReject}
              disabled={isRejecting}
              data-testid="button-reject-match"
            >
              <X className="h-4 w-4 mr-2" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
            <Button
              className="flex-1"
              onClick={onAccept}
              disabled={isAccepting}
              data-testid="button-accept-match"
            >
              <Check className="h-4 w-4 mr-2" />
              {isAccepting ? "Accepting..." : "Accept"}
            </Button>
          </div>
        )}

        {match.accepted === 1 && (
          <div className="bg-chart-2/10 border border-chart-2/20 rounded-md p-4 text-center">
            <Check className="h-5 w-5 text-chart-2 mx-auto mb-2" />
            <p className="text-sm font-medium text-chart-2">Match Accepted</p>
          </div>
        )}

        {match.accepted === -1 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 text-center">
            <X className="h-5 w-5 text-destructive mx-auto mb-2" />
            <p className="text-sm font-medium text-destructive">Match Rejected</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>Row: Payout #{match.payout.rowIndex + 1}, Ledger #{match.ledger.rowIndex + 1}</p>
          <p>Created: {new Date(match.createdAt!).toLocaleString()}</p>
        </div>
      </div>
    </ScrollArea>
  );
}

"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileJson,
  FileText,
  Check,
  X,
  ChevronRight,
  Search,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Percent,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Separator } from "@/src/components/ui/separator";
import { useToast } from "@/src/hooks/use-toast";
import { useAppStore } from "@/src/lib/store";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/src/lib/queryClient";
import { ClusterView } from "@/src/components/cluster-view";
import type { JobResultsResponse, TransactionRecord, MatchRecord, ScoreBreakdown } from "@/@types";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  };

  return (
    <Badge 
      variant="outline" 
      className={`text-xs capitalize ${colors[level] || colors.medium}`}
    >
      {level}
    </Badge>
  );
}

function MatchTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    exact: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    deterministic: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    fuzzy: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    cluster: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  };

  return (
    <Badge 
      variant="outline" 
      className={`text-xs capitalize ${colors[type] || colors.fuzzy}`}
    >
      {type}
    </Badge>
  );
}

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
}

function KPICard({ label, value, subtext, icon }: KPICardProps) {
  return (
    <Card className="border-2 border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{label}</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {value}
            </p>
            {subtext && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtext}</p>}
          </div>
          {icon && (
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-gray-700">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 dark:border-gray-700 px-6 py-4">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-xl border-slate-300 dark:border-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className={`rounded-xl ${currentPage === pageNum ? "bg-blue-500 text-white" : "border-slate-300 dark:border-gray-700"}`}
            >
              {pageNum}
            </Button>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-xl border-slate-300 dark:border-gray-700"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function LimitSelector({ 
  value, 
  onChange, 
  options = [10, 20, 50, 100],
  label = "Show"
}: {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="text-sm text-slate-600 dark:text-slate-400">per page</span>
    </div>
  );
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

interface MatchInspectorProps {
  match?: (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord }) | null;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

function MatchInspector({ match, onAccept, onReject, isAccepting, isRejecting }: MatchInspectorProps) {
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

  const confidenceLevel = match.confidence_level || "medium";
  const matchType = match.match_type || "fuzzy";

  return (
    <div className="space-y-6">
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
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    current_job_id,
    selected_match_id,
    setSelectedMatchId,
    active_tab,
    setActiveTab,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchPage, setCurrentMatchPage] = useState(1);
  const [currentPayoutPage, setCurrentPayoutPage] = useState(1);
  const [currentLedgerPage, setCurrentLedgerPage] = useState(1);
  const [matchesLimit, setMatchesLimit] = useState(20);
  const [transactionsLimit, setTransactionsLimit] = useState(15);
  const [clustersLimit, setClustersLimit] = useState(10);

  const { data: results, isLoading, error } = useQuery<JobResultsResponse>({
    queryKey: [
      "/api/job", 
      current_job_id, 
      "results",
      currentMatchPage,
      matchesLimit,
      currentPayoutPage,
      transactionsLimit,
      currentLedgerPage,
      searchQuery
    ],
    enabled: !!current_job_id,
    queryFn: async () => {
      const params = new URLSearchParams({
        matchesPage: currentMatchPage.toString(),
        matchesLimit: matchesLimit.toString(),
        transactionsPage: currentPayoutPage.toString(),
        transactionsLimit: transactionsLimit.toString(),
        clustersPage: "1",
        clustersLimit: clustersLimit.toString(),
        ...(searchQuery && { search: searchQuery })
      });
      
      const response = await fetch(`/api/job/${current_job_id}/results?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }
      return response.json();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/match/${matchId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job", current_job_id, "results"] });
      toast({ 
        title: "Match accepted",
        description: "The match has been accepted and recorded."
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/match/${matchId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job", current_job_id, "results"] });
      toast({ 
        title: "Match rejected",
        description: "The match has been rejected."
      });
    },
  });

  useEffect(() => {
    if (!current_job_id) {
      router.push("/");
    }
  }, [current_job_id, router]);

  useEffect(() => {
    // Reset pagination when changing tabs or search
    setCurrentMatchPage(1);
    setCurrentPayoutPage(1);
    setCurrentLedgerPage(1);
  }, [active_tab, searchQuery]);

  const handlePageChange = (page: number, type: 'matches' | 'payouts' | 'ledger') => {
    if (type === 'matches') {
      setCurrentMatchPage(page);
    } else if (type === 'payouts') {
      setCurrentPayoutPage(page);
    } else {
      setCurrentLedgerPage(page);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Loading reconciliation results...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md border-2 border-slate-200 dark:border-gray-800 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4 font-medium">Failed to load results</p>
            <Button 
              onClick={() => router.push("/")}
              className="rounded-xl text-md bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedMatch = results.matches.find((m) => m.id === selected_match_id);

  const handleDownloadPDF = () => {
    window.open(`/api/download/${current_job_id}/pdf`, "_blank");
  };

  const handleDownloadJSON = () => {
    window.open(`/api/download/${current_job_id}/json`, "_blank");
  };

  const handleDownloadCSV = () => {
    window.open(`/api/download/${current_job_id}/csv`, "_blank");
  };

  // Get pagination data from API response
  const matchesPagination = results.pagination.matches;
  const transactionsPagination = results.pagination.transactions;
  const clustersPagination = results.pagination.clusters;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      {/* subtle gradient accents */}
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-tl from-blue-500/10 to-purple-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-7xl px-6 py-8 z-10">
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-2">
                Reconciliation Results
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Review matches, unmatched transactions, and download reports
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="rounded-xl border-slate-300 dark:border-gray-700 px-4 py-2 hover:border-blue-400"
              data-testid="button-back-home"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              New Reconciliation
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <KPICard
              label="Processed Rows"
              value={(results.stats.total_payouts + results.stats.total_ledger).toLocaleString()}
              subtext={`${results.stats.total_payouts} payouts, ${results.stats.total_ledger} ledger`}
              icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
            />
            <KPICard
              label="Match Rate"
              value={`${(results.stats.match_rate * 100).toFixed(1)}%`}
              subtext={results.stats.match_rate >= 0.7 ? "Good" : "Needs review"}
              icon={<Percent className="h-4 w-4 text-green-500" />}
            />
            <KPICard
              label="Matched"
              value={results.stats.matched_count.toLocaleString()}
              subtext="Successful matches"
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            />
            <KPICard
              label="Unmatched"
              value={results.stats.unmatched_count.toLocaleString()}
              subtext="Requires attention"
              icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
            />
            <KPICard
              label="Unmatched Amount"
              value={formatCents(results.stats.total_unmatched_amount)}
              subtext="Total unmatched value"
              icon={<AlertCircle className="h-4 w-4 text-red-500" />}
            />
          </div>

          {/* Export Options */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-slate-800/60 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Export results</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Download reconciliation reports in different formats
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadCSV}
                  className="rounded-xl border-slate-300 dark:border-gray-700 hover:border-blue-400"
                  data-testid="button-download-csv"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadJSON}
                  className="rounded-xl border-slate-300 dark:border-gray-700 hover:border-blue-400"
                  data-testid="button-download-json"
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  className="rounded-xl text-md bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-600"
                  data-testid="button-download-pdf"
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF Report
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Main content area */}
        <Card className="border-2 border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                Reconciliation Details
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-slate-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800"
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <Tabs 
              value={active_tab} 
              onValueChange={(v: string) => setActiveTab(v as typeof active_tab)}
            >
              <div className="px-6 pb-4 border-b border-slate-200 dark:border-gray-700">
                <TabsList className="bg-slate-100 dark:bg-gray-800/50 p-1 rounded-xl">
                  <TabsTrigger 
                    value="matches" 
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700"
                    data-testid="tab-matches"
                  >
                    Matches ({matchesPagination.total})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="transactions" 
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700"
                    data-testid="tab-transactions"
                  >
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="clusters" 
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700"
                    data-testid="tab-clusters"
                  >
                    Clusters ({clustersPagination.total})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex">
                <div className={`${active_tab === 'matches' ? 'w-3/4' : 'w-full'}`}>
                  <TabsContent value="matches" className="m-0 p-0">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Showing {((currentMatchPage - 1) * matchesLimit) + 1}-
                          {Math.min(currentMatchPage * matchesLimit, matchesPagination.total)} of {matchesPagination.total} matches
                        </div>
                        <LimitSelector
                          value={matchesLimit}
                          onChange={setMatchesLimit}
                          label="Show"
                          options={[10, 20, 50, 100]}
                        />
                      </div>
                      <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-50 dark:bg-gray-700/50">
                            <TableRow>
                              <TableHead className="w-[100px] text-slate-700 dark:text-slate-300">Type</TableHead>
                              <TableHead className="text-slate-700 dark:text-slate-300">Payout ID</TableHead>
                              <TableHead className="text-slate-700 dark:text-slate-300">Ledger ID</TableHead>
                              <TableHead className="text-right text-slate-700 dark:text-slate-300">Amount</TableHead>
                              <TableHead className="text-center text-slate-700 dark:text-slate-300">Score</TableHead>
                              <TableHead className="text-center text-slate-700 dark:text-slate-300">Confidence</TableHead>
                              <TableHead className="text-center text-slate-700 dark:text-slate-300">Status</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.matches.map((match) => (
                              <TableRow
                                key={match.id}
                                className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/30 ${
                                  selected_match_id === match.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                                }`}
                                onClick={() => setSelectedMatchId(match.id)}
                                data-testid={`row-match-${match.id}`}
                              >
                                <TableCell>
                                  <MatchTypeBadge type={match.match_type || "unknown"} />
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                                  {match.payout?.tx_id || "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                                  {match.ledger?.tx_id || "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-slate-900 dark:text-white">
                                  {formatCents(match.payout?.amount_cents || 0)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                                    {(match.score * 100).toFixed(0)}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <ConfidenceBadge level={match.confidence_level || "medium"} />
                                </TableCell>
                                <TableCell className="text-center">
                                  {match.accepted === 1 ? (
                                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
                                      <Check className="h-3 w-3 mr-1" />
                                      Accepted
                                    </Badge>
                                  ) : match.accepted === -1 ? (
                                    <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">
                                      <X className="h-3 w-3 mr-1" />
                                      Rejected
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-slate-300 border-slate-200 dark:border-gray-600">
                                      Pending
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {matchesPagination.pages > 1 && (
                        <Pagination
                          currentPage={currentMatchPage}
                          totalPages={matchesPagination.pages}
                          onPageChange={(page) => handlePageChange(page, 'matches')}
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="transactions" className="m-0 p-0">
                    <div className="p-6">
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            Unmatched Payouts ({transactionsPagination.total_payouts})
                          </h3>
                          <LimitSelector
                            value={transactionsLimit}
                            onChange={setTransactionsLimit}
                            label="Show"
                            options={[10, 15, 25, 50, 100]}
                          />
                        </div>
                        <div className="flex items-center justify-between mb-2 text-sm text-slate-600 dark:text-slate-400">
                          <span>
                            Showing {((currentPayoutPage - 1) * transactionsLimit) + 1}-
                            {Math.min(currentPayoutPage * transactionsLimit, transactionsPagination.total_payouts)} of {transactionsPagination.total_payouts} payouts
                          </span>
                        </div>
                        <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          <Table>
                            <TableHeader className="bg-slate-50 dark:bg-gray-700/50">
                              <TableRow>
                                <TableHead className="text-slate-700 dark:text-slate-300">TX ID</TableHead>
                                <TableHead className="text-right text-slate-700 dark:text-slate-300">Amount</TableHead>
                                <TableHead className="text-slate-700 dark:text-slate-300">Merchant</TableHead>
                                <TableHead className="text-slate-700 dark:text-slate-300">Reference</TableHead>
                                <TableHead className="text-slate-700 dark:text-slate-300">Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.unmatched_payouts.map((tx: TransactionRecord) => (
                                <TableRow key={tx.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30" data-testid={`row-unmatched-payout-${tx.id}`}>
                                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{tx.tx_id || "-"}</TableCell>
                                  <TableCell className="text-right font-mono text-slate-900 dark:text-white">
                                    {formatCents(tx.amount_cents)}
                                  </TableCell>
                                  <TableCell className="text-slate-600 dark:text-slate-400">{tx.merchant_id || "-"}</TableCell>
                                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                    {tx.reference || "-"}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">{tx.timestamp || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {transactionsPagination.pages_payouts > 1 && (
                          <Pagination
                            currentPage={currentPayoutPage}
                            totalPages={transactionsPagination.pages_payouts}
                            onPageChange={(page) => handlePageChange(page, 'payouts')}
                          />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            Unmatched Ledger ({transactionsPagination.total_ledger})
                          </h3>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Showing {((currentLedgerPage - 1) * transactionsLimit) + 1}-
                            {Math.min(currentLedgerPage * transactionsLimit, transactionsPagination.total_ledger)} of {transactionsPagination.total_ledger} ledger entries
                          </div>
                        </div>
                        <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          <Table>
                            <TableHeader className="bg-slate-50 dark:bg-gray-700/50">
                              <TableRow>
                                <TableHead className="text-slate-700 dark:text-slate-300">Entry ID</TableHead>
                                <TableHead className="text-right text-slate-700 dark:text-slate-300">Amount</TableHead>
                                <TableHead className="text-slate-700 dark:text-slate-300">Merchant</TableHead>
                                <TableHead className="text-slate-700 dark:text-slate-300">Reference</TableHead>
                                <TableHead className="text-slate-700 dark:text-slate-300">Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.unmatched_ledger.map((tx: TransactionRecord) => (
                                <TableRow key={tx.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30" data-testid={`row-unmatched-ledger-${tx.id}`}>
                                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">{tx.tx_id || "-"}</TableCell>
                                  <TableCell className="text-right font-mono text-slate-900 dark:text-white">
                                    {formatCents(tx.amount_cents)}
                                  </TableCell>
                                  <TableCell className="text-slate-600 dark:text-slate-400">{tx.merchant_id || "-"}</TableCell>
                                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                    {tx.reference || "-"}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">{tx.timestamp || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {transactionsPagination.pages_ledger > 1 && (
                          <Pagination
                            currentPage={currentLedgerPage}
                            totalPages={transactionsPagination.pages_ledger}
                            onPageChange={(page) => handlePageChange(page, 'ledger')}
                          />
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="clusters" className="m-0 p-0">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          Clusters ({clustersPagination.total})
                        </h3>
                        <LimitSelector
                          value={clustersLimit}
                          onChange={setClustersLimit}
                          label="Show"
                          options={[5, 10, 20, 50]}
                        />
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Showing {Math.min(clustersLimit, clustersPagination.total)} of {clustersPagination.total} clusters
                      </div>
                      <div>
                        <ClusterView clusters={results.clusters} jobId={current_job_id!} />
                      </div>
                    </div>
                  </TabsContent>
                </div>

              
                {active_tab === "matches" && (
                  <div className="w-1/3 border-l border-slate-200 dark:border-gray-700">
                    <div className="p-6 h-full">
                      <Card className=" border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 rounded-2xl h-full flex flex-col">
                        <CardHeader className="pb-4 shrink-0">
                          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                            Match Inspector
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col  ">
                          {selectedMatch ? (
                            
                      
                              <div className="pb-4  ">
                               
                                <MatchInspector
                                  match={selectedMatch}
                                  onAccept={() => selected_match_id && acceptMutation.mutate(selected_match_id)}
                                  onReject={() => selected_match_id && rejectMutation.mutate(selected_match_id)}
                                  isAccepting={acceptMutation.isPending}
                                  isRejecting={rejectMutation.isPending}
                                />
                               
                              </div>
                          
                          ) : (
                            <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                                <Info className="h-8 w-8 text-slate-400" />
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 text-sm">
                                Select a match to inspect details
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
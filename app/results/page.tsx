'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileJson,
  FileText,
  Settings,
  Check,
  X,
  ChevronRight,
  Search,
  Filter,
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
import { MatchInspector } from "@/src/components/match-inspector";
import { ClusterView } from "@/src/components/cluster-view";
import type { JobResultsResponse, TransactionRecord, MatchRecord, Cluster } from "@/@types";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function ConfidenceBadge({ level }: { level: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    high: "default",
    medium: "secondary",
    low: "destructive",
  };
  return (
    <Badge variant={variants[level] || "secondary"} className="text-xs capitalize">
      {level}
    </Badge>
  );
}

function MatchTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {type}
    </Badge>
  );
}

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "default" | "success" | "warning" | "destructive";
}

function KPICard({ label, value, subtext, variant = "default" }: KPICardProps) {
  const colors = {
    default: "",
    success: "text-chart-2",
    warning: "text-chart-4",
    destructive: "text-destructive",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-semibold font-mono ${colors[variant]}`}>{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    currentJobId,
    selectedMatchId,
    setSelectedMatchId,
    activeTab,
    setActiveTab,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");

  const { data: results, isLoading, error } = useQuery<JobResultsResponse>({
    queryKey: ["/api/job", currentJobId, "results"],
    enabled: !!currentJobId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/match/${matchId}/accept`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job", currentJobId, "results"] });
      toast({ title: "Match accepted" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", `/api/match/${matchId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job", currentJobId, "results"] });
      toast({ title: "Match rejected" });
    },
  });

  useEffect(() => {
    if (!currentJobId) {
      router.push("/");
    }
  }, [currentJobId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-destructive mb-4">Failed to load results</p>
            <Button onClick={() => router.push("/")} data-testid="button-back-home">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedMatch = results.matches.find((m) => m.id === selectedMatchId);

  const filteredMatches = results.matches.filter((match) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      match.payout?.txId?.toLowerCase().includes(query) ||
      match.ledger?.txId?.toLowerCase().includes(query) ||
      match.payout?.reference?.toLowerCase().includes(query) ||
      match.ledger?.reference?.toLowerCase().includes(query)
    );
  });

  const handleDownloadPDF = () => {
    window.open(`/api/download/${currentJobId}/pdf`, "_blank");
  };

  const handleDownloadJSON = () => {
    window.open(`/api/download/${currentJobId}/json`, "_blank");
  };

  const handleDownloadCSV = () => {
    window.open(`/api/download/${currentJobId}/csv`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Reconciliation Results</h1>
            <Badge variant="outline">{results.job.name}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV} data-testid="button-download-csv">
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadJSON} data-testid="button-download-json">
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} data-testid="button-download-pdf">
              <Download className="h-4 w-4 mr-2" />
              PDF Report
            </Button>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/settings")}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-4 border-t bg-muted/30">
          <KPICard
            label="Processed Rows"
            value={(results.stats.totalPayouts + results.stats.totalLedger).toLocaleString()}
            subtext={`${results.stats.totalPayouts} payouts, ${results.stats.totalLedger} ledger`}
          />
          <KPICard
            label="Match Rate"
            value={`${(results.stats.matchRate * 100).toFixed(1)}%`}
            variant={results.stats.matchRate >= 0.7 ? "success" : "warning"}
          />
          <KPICard
            label="Matched"
            value={results.stats.matchedCount.toLocaleString()}
            variant="success"
          />
          <KPICard
            label="Unmatched"
            value={results.stats.unmatchedCount.toLocaleString()}
            variant={results.stats.unmatchedCount > 0 ? "warning" : "default"}
          />
          <KPICard
            label="Unmatched Amount"
            value={formatCents(results.stats.totalUnmatchedAmount)}
            variant={results.stats.totalUnmatchedAmount > 0 ? "destructive" : "default"}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="p-4 border-b">
            <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as typeof activeTab)}>
              <div className="flex items-center justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="matches" data-testid="tab-matches">
                    Matches ({results.matches.length})
                  </TabsTrigger>
                  <TabsTrigger value="transactions" data-testid="tab-transactions">
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger value="clusters" data-testid="tab-clusters">
                    Clusters ({results.clusters.length})
                  </TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            {activeTab === "matches" && (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Payout ID</TableHead>
                    <TableHead>Ledger ID</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Confidence</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches.map((match) => (
                    <TableRow
                      key={match.id}
                      className={`cursor-pointer hover-elevate ${
                        selectedMatchId === match.id ? "bg-accent" : ""
                      }`}
                      onClick={() => setSelectedMatchId(match.id)}
                      data-testid={`row-match-${match.id}`}
                    >
                      <TableCell>
                        <MatchTypeBadge type={match.matchType || "unknown"} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {match.payout?.txId || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {match.ledger?.txId || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCents(match.payout?.amountCents || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm">
                          {(match.score * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <ConfidenceBadge level={match.confidenceLevel || "medium"} />
                      </TableCell>
                      <TableCell className="text-center">
                        {match.accepted === 1 ? (
                          <Badge variant="default" className="bg-chart-2">
                            <Check className="h-3 w-3 mr-1" />
                            Accepted
                          </Badge>
                        ) : match.accepted === -1 ? (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {activeTab === "transactions" && (
              <div className="p-4">
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Unmatched Payouts ({results.unmatchedPayouts.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TX ID</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.unmatchedPayouts.slice(0, 50).map((tx) => (
                        <TableRow key={tx.id} data-testid={`row-unmatched-payout-${tx.id}`}>
                          <TableCell className="font-mono text-xs">{tx.txId || "-"}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCents(tx.amountCents)}
                          </TableCell>
                          <TableCell>{tx.merchantId || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {tx.reference || "-"}
                          </TableCell>
                          <TableCell className="text-xs">{tx.timestamp || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Unmatched Ledger ({results.unmatchedLedger.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry ID</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.unmatchedLedger.slice(0, 50).map((tx) => (
                        <TableRow key={tx.id} data-testid={`row-unmatched-ledger-${tx.id}`}>
                          <TableCell className="font-mono text-xs">{tx.txId || "-"}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCents(tx.amountCents)}
                          </TableCell>
                          <TableCell>{tx.merchantId || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {tx.reference || "-"}
                          </TableCell>
                          <TableCell className="text-xs">{tx.timestamp || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === "clusters" && (
              <ClusterView clusters={results.clusters} jobId={currentJobId!} />
            )}
          </ScrollArea>
        </div>

        {activeTab === "matches" && (
          <div className="w-[400px] shrink-0 bg-muted/30">
            <MatchInspector
              match={selectedMatch}
              onAccept={() => selectedMatchId && acceptMutation.mutate(selectedMatchId)}
              onReject={() => selectedMatchId && rejectMutation.mutate(selectedMatchId)}
              isAccepting={acceptMutation.isPending}
              isRejecting={rejectMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
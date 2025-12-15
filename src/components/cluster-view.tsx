import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, Loader2, AlertCircle, Info, Zap } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/src/lib/queryClient";
import { useToast } from "@/src/hooks/use-toast";
import { Separator } from "@/src/components/ui/separator";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import type { Cluster } from "@/@types";

interface ClusterViewProps {
  clusters: Cluster[];
  jobId: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function ClusterCard({ cluster, jobId }: { cluster: Cluster; jobId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cluster/${cluster.id}/summary`, {
        llm_budget_tokens: 500,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job", jobId, "results"] });
      toast({ 
        title: "Summary generated",
        description: "AI summary has been generated for this cluster"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate summary",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const confidenceColors: Record<string, string> = {
    high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  };

  return (
    <Card className="mb-6 border-2 border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 rounded-2xl overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-4 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                )}
                <div>
                  <CardTitle className="text-base font-medium text-slate-900 dark:text-white">
                    {cluster.merchant_name || "Unknown Merchant"}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-gray-600">
                      {cluster.date_bucket}
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-gray-600">
                      {cluster.amount_bucket}
                    </Badge>
                    {cluster.llm_confidence && (
                      <Badge variant="outline" className={`text-xs capitalize ${confidenceColors[cluster.llm_confidence] || confidenceColors.medium}`}>
                        {cluster.llm_confidence} confidence
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                  {formatCents(cluster.total_amount_cents || 0)}
                </p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    {cluster.size} transactions
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    {cluster.evidence_ids?.length || 0} evidence
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator className="bg-slate-200 dark:bg-gray-700" />
          <CardContent className="pt-4 space-y-4">
            {cluster.llm_summary ? (
              <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">AI Summary</p>
                      {cluster.token_usage && cluster.token_usage > 0 && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {cluster.token_usage} tokens
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {cluster.llm_summary}
                    </p>
                  </div>
                </div>
                
                {cluster.suggested_action && (
                  <div className="pt-3 border-t border-slate-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3 w-3 text-orange-500" />
                      <p className="text-xs font-medium text-slate-900 dark:text-white">Suggested Action</p>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{cluster.suggested_action}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-4 border border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-gray-700">
                      <AlertCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">No AI Summary</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Generate an AI-powered analysis of this cluster
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateSummaryMutation.mutate()}
                    disabled={generateSummaryMutation.isPending}
                    className="rounded-xl border-slate-300 dark:border-gray-700 hover:border-blue-400"
                    data-testid={`button-generate-summary-${cluster.id}`}
                  >
                    {generateSummaryMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                  Evidence Transactions
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {cluster.evidence_ids?.length || 0} records
                </span>
              </div>
              
              <ScrollArea className="h-64 rounded-xl border border-slate-200 dark:border-gray-700">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 dark:bg-gray-800">
                    <TableRow>
                      <TableHead className="text-slate-700 dark:text-slate-300">ID</TableHead>
                      <TableHead className="text-slate-700 dark:text-slate-300">Source</TableHead>
                      <TableHead className="text-right text-slate-700 dark:text-slate-300">Amount</TableHead>
                      <TableHead className="text-slate-700 dark:text-slate-300">Reference</TableHead>
                      <TableHead className="text-slate-700 dark:text-slate-300">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.evidence_ids?.slice(0, 20).map((id, idx) => (
                      <TableRow key={id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30" data-testid={`row-evidence-${id}`}>
                        <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {id.slice(0, 10)}...
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${idx % 2 === 0 
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" 
                              : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                            }`}
                          >
                            {idx % 2 === 0 ? "Payout" : "Ledger"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-slate-900 dark:text-white">
                          {formatCents(Math.floor(Math.random() * 10000) + 10000)} {/* Placeholder */}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                          REF-{id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          2024-{String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-{String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {cluster.evidence_ids && cluster.evidence_ids.length > 20 && (
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 p-3">
                  <div className="flex items-center justify-center">
                    <Info className="h-4 w-4 text-slate-400 mr-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Showing 20 of {cluster.evidence_ids.length} transactions
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-3 border border-slate-200 dark:border-gray-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cluster ID</p>
                  <p className="font-mono text-sm text-slate-900 dark:text-white truncate">
                    {cluster.id}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-3 border border-slate-200 dark:border-gray-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Pattern Type</p>
                  <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300">
                    {cluster.pattern_type || "Exception"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function ClusterView({ clusters, jobId }: ClusterViewProps) {
  if (clusters.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
          <Info className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-slate-600 dark:text-slate-400 font-medium">No exception clusters found</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          All transactions have been matched successfully
        </p>
      </div>
    );
  }

  const sortedClusters = [...clusters].sort(
    (a, b) => (b.total_amount_cents || 0) - (a.total_amount_cents || 0)
  );

  const totalUnmatchedAmount = sortedClusters.reduce(
    (sum, cluster) => sum + (cluster.total_amount_cents || 0), 0
  );

  return (
    <div className="p-2">
      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6 border border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">Exception Clusters</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              AI-powered analysis of unmatched transaction patterns
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {clusters.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Clusters</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-gray-700"></div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {formatCents(totalUnmatchedAmount)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Value</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-300px)] pr-2">
        <div className="pb-4">
          {sortedClusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} jobId={jobId} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
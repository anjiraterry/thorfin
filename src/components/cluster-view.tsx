import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Cluster } from "@shared/schema";

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
      return apiRequest("POST", `/api/cluster/${cluster.id}/generate-summary`, {
        llmBudgetTokens: 500,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job", jobId, "results"] });
      toast({ title: "Summary generated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate summary",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-base">{cluster.merchantName || "Unknown Merchant"}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cluster.dateBucket} &middot; {cluster.amountBucket}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold">
                    {formatCents(cluster.totalAmountCents)}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {cluster.size} transactions
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {cluster.llmSummary ? (
              <div className="bg-muted/50 rounded-md p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">AI Summary</p>
                    <p className="text-sm text-muted-foreground">{cluster.llmSummary}</p>
                  </div>
                </div>
                {cluster.suggestedAction && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Suggested Action</p>
                    <p className="text-sm">{cluster.suggestedAction}</p>
                  </div>
                )}
                {cluster.llmConfidence && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence:</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {cluster.llmConfidence}
                    </Badge>
                  </div>
                )}
                {cluster.tokenUsage && cluster.tokenUsage > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tokens used: {cluster.tokenUsage}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-md p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">No AI summary generated yet</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateSummaryMutation.mutate()}
                  disabled={generateSummaryMutation.isPending}
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
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Evidence Transactions</h4>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.evidenceIds.slice(0, 10).map((id, idx) => (
                      <TableRow key={id} data-testid={`row-evidence-${id}`}>
                        <TableCell className="font-mono text-xs">{id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {idx % 2 === 0 ? "Payout" : "Ledger"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">-</TableCell>
                        <TableCell className="text-xs text-muted-foreground">-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {cluster.evidenceIds.length > 10 && (
                <p className="text-xs text-muted-foreground mt-2">
                  And {cluster.evidenceIds.length - 10} more transactions...
                </p>
              )}
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
        <p className="text-muted-foreground">No exception clusters found</p>
        <p className="text-xs text-muted-foreground mt-1">
          All transactions have been matched successfully
        </p>
      </div>
    );
  }

  const sortedClusters = [...clusters].sort(
    (a, b) => b.totalAmountCents - a.totalAmountCents
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Exception Clusters</h3>
        <Badge variant="secondary">{clusters.length} clusters</Badge>
      </div>
      {sortedClusters.map((cluster) => (
        <ClusterCard key={cluster.id} cluster={cluster} jobId={jobId} />
      ))}
    </div>
  );
}

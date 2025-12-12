"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import { useAppStore } from "@/src/lib/store";
import { useQuery } from "@tanstack/react-query";
import type { JobStatusResponse } from "@/@types";

const POLL_INTERVAL = 1000;

export default function ProcessingPage() {
  const router = useRouter();
  const { current_job_id } = useAppStore();

const { data: status, error } = useQuery<JobStatusResponse>({
  queryKey: ["job-status", current_job_id],
  queryFn: async () => {
    if (!current_job_id) throw new Error("No job ID");
    
    const response = await fetch(`/api/job/${current_job_id}/status`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch job status: ${response.status}`);
    }
    
    return await response.json();
  },
  enabled: !!current_job_id,
  refetchInterval: (query) => {
    const data = query.state.data;
    if (data?.status === "completed" || data?.status === "failed") {
      return false;
    }
    return POLL_INTERVAL;
  },
});

  useEffect(() => {
    if (!current_job_id) {
      router.push("/");
    }
  }, [current_job_id, router]);

  useEffect(() => {
    if (status?.status === "completed") {
      const timeout = setTimeout(() => {
        router.push("/reconciliation/results");
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [status?.status, router]);

  if (!current_job_id) {
    return null;
  }

  const isCompleted = status?.status === "completed";
  const isFailed = status?.status === "failed";
  const progress = status?.progress || 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">
            {isCompleted
              ? "Processing Complete"
              : isFailed
              ? "Processing Failed"
              : "Processing Files"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            {isCompleted ? (
              <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-chart-2" />
              </div>
            ) : isFailed ? (
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isCompleted
                  ? "All transactions processed"
                  : isFailed
                  ? "An error occurred"
                  : "Matching transactions..."}
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {status?.match_rate !== undefined && status.match_rate > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Current match rate</p>
              <p className="text-2xl font-semibold font-mono">
                {(status.match_rate * 100).toFixed(1)}%
              </p>
            </div>
          )}

          {isFailed && status?.error_message && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
              <p className="text-sm text-destructive">{status.error_message}</p>
            </div>
          )}

          <div className="flex justify-center gap-4">
            {isCompleted && (
              <Button onClick={() => router.push("/results")} data-testid="button-view-results">
                View Results
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {isFailed && (
              <Button variant="outline" onClick={() => router.push("/")} data-testid="button-try-again">
                Try Again
              </Button>
            )}
          </div>

          {!isCompleted && !isFailed && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Processing steps: Parsing files, normalizing data, exact matching,
                deterministic matching, fuzzy matching, clustering exceptions
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
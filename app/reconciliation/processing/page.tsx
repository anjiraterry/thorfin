"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, ArrowRight, Zap, Info, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import { useAppStore } from "@/src/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobStatusResponse } from "@/@types";

const POLL_INTERVAL = 1000;

export default function ProcessingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { current_job_id, resetJob } = useAppStore();
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: status, error, refetch } = useQuery<JobStatusResponse>({
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

  const handleRetry = async () => {
    if (!current_job_id) return;
    
    setIsRetrying(true);
    
    try {
      // Reset the query data to trigger a refetch and restart polling
      queryClient.setQueryData(["job-status", current_job_id], {
        ...status,
        status: "processing",
        progress: 0,
        match_rate: 0,
        error_message: undefined
      });
      
      // Force a refetch
      await refetch();
      
    } catch (error) {
      console.error("Error retrying job:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleBackToHome = () => {
    resetJob();
    router.push("/");
  };

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
    <div className="relative min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      {/* subtle gradient accents */}
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-tl from-blue-500/10 to-purple-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-6xl px-6 py-12 z-10">
        <section className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-semibold text-slate-900 dark:text-white">
            {isCompleted
              ? "Processing Complete"
              : isFailed
              ? "Processing Failed"
              : "Processing Your Files"}
          </h1>

          <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
            {isCompleted
              ? "All transactions have been processed and matched successfully."
              : isFailed
              ? "An error occurred during processing. Please try again."
              : "Analyzing and matching transactions between payout and ledger files."}
          </p>
        </section>

        <div className="mx-auto max-w-xl">
          <Card className="border-2 border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 rounded-2xl shadow-lg overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white text-center">
                {isCompleted
                  ? " Processing Complete"
                  : isFailed
                  ? "Processing Failed"
                  : "Processing in Progress"}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Status Icon */}
              <div className="flex justify-center">
                {isCompleted ? (
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-700 dark:text-green-500" />
                  </div>
                ) : isFailed ? (
                  <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-red-600 dark:text-red-500" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isCompleted
                      ? "All transactions processed"
                      : isFailed
                      ? "Processing stopped"
                      : "Matching transactions..."}
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {progress}%
                  </span>
                </div>
                <Progress 
                  value={progress} 
                  indicatorColor={isFailed ? "red" : isCompleted ? "green" : "blue"} 
                  className="h-2"
                />
              </div>

              {/* Match Rate Display */}
              {status?.match_rate !== undefined && status.match_rate > 0 && (
                <div className="text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Current match rate</p>
                  <p className="text-3xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    {(status.match_rate * 100).toFixed(1)}%
                  </p>
                </div>
              )}

              {/* Error Message */}
              {isFailed && status?.error_message && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                  <p className="text-sm text-red-700 dark:text-red-300">{status.error_message}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                {isCompleted && (
                  <Button 
                    onClick={() => router.push("/reconciliation/results")} 
                    className="rounded-xl text-md bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
                    data-testid="button-view-results"
                  >
                    View Results
                    <ArrowRight className="ml-3 h-5 w-5" />
                  </Button>
                )}
                {isFailed && (
                  <>
                    <Button 
                      onClick={handleRetry} 
                      className="rounded-xl bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
                      disabled={isRetrying}
                      data-testid="button-try-again"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Try Again
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleBackToHome} 
                      className="rounded-xl border-slate-300 dark:border-gray-700 px-6 py-3 hover:border-blue-400"
                      data-testid="button-back-home"
                    >
                      Back to Home
                    </Button>
                  </>
                )}
              </div>

              {/* Processing Steps Info */}
              {!isCompleted && !isFailed && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-800 dark:bg-slate-800/60">
                  <div className="flex gap-3">
                    <Info className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <p className="font-medium text-slate-900 dark:text-white mb-1">
                        Processing steps
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Parsing files</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Normalizing data</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Exact matching</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Deterministic matching</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Fuzzy matching</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>Clustering exceptions</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Processing Status Details */}
        {!isCompleted && !isFailed && (
          <div className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This may take a few moments depending on file size...
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Do not close this window while processing is in progress.
            </p>
          </div>
        )}
      </main>

      {/* Global scrollbar styles */}
      <style jsx global>{`
        * {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        *::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 3px;
        }

        *::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 3px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }

        .dark * {
          scrollbar-color: #475569 transparent;
        }

        .dark *::-webkit-scrollbar-thumb {
          background-color: #475569;
        }

        .dark *::-webkit-scrollbar-thumb:hover {
          background-color: #64748b;
        }

        body {
          overflow-x: hidden;
        }
      `}</style>
    </div>
  );
}
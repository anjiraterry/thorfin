'use client'

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  ArrowRight,
  Check,
  Zap,
  FileCheck,
  Info,
  Loader2
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Progress } from "@/src/components/ui/progress";
import { useToast } from "@/src/hooks/use-toast";
import { useAppStore } from "@/src/lib/store";
import type { UploadResponse } from "@/@types";

interface FileDropZoneProps {
  label: string;
  description: string;
  file: File | null;
  onFileDrop: (file: File) => void;
  accept: string;
  testId: string;
}

function FileDropZone({
  label,
  description,
  file,
  onFileDrop,
  accept,
  testId
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) onFileDrop(droppedFile);
    },
    [onFileDrop]
  );

  return (
    <div
      className={`relative min-h-[280px] cursor-pointer rounded-2xl border-2 p-8 text-center transition-all flex flex-col items-center justify-center ${
        isDragging
          ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
          : file
          ? "border-blue-400 bg-blue-50/30 dark:bg-blue-900/10"
          : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 dark:border-gray-800 dark:bg-slate-800/60"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      data-testid={testId}
    >
      <input
        type="file"
        accept={accept}
        onChange={(e) => e.target.files && onFileDrop(e.target.files[0])}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />

      {file ? (
        <>
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Check className="h-8 w-8 text-blue-600 dark:text-blue-300" />
          </div>
          <p className="text-lg font-medium text-slate-900 dark:text-white">
            {file.name}
          </p>
          <p className="text-sm text-slate-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </>
      ) : (
        <>
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700">
            <FileSpreadsheet className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
            {label}
          </h3>
          <p className="mb-3 text-slate-600 dark:text-slate-400">
            {description}
          </p>
          <div className="text-sm text-slate-500">
            Drag & drop or click to browse
            <br />
            <div className="text-left mt-4">
            File Requirements
       
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  CSV (.csv)
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Excel (.xlsx, .xls)
                </li>
              </ul>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    setCurrentJobId,
    setPayoutColumns,
    setLedgerColumns,
    setPayoutPreview,
    setLedgerPreview,
  } = useAppStore();

  const [payoutFile, setPayoutFile] = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const simulateProgress = (targetProgress: number, status: string) => {
    setUploadProgress(targetProgress);
    setUploadStatus(status);
  };

  const handleUpload = async () => {
    if (!payoutFile || !ledgerFile) {
      toast({
        title: "Missing files",
        description: "Please upload both payout and ledger files.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    simulateProgress(10, "Preparing files...");

    try {
      const formData = new FormData();
      formData.append("payoutFile", payoutFile);
      formData.append("ledgerFile", ledgerFile);

      simulateProgress(25, "Uploading to server...");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());

      simulateProgress(60, "Processing data...");

      const data: UploadResponse = await response.json();

      simulateProgress(85, "Analyzing file structure...");

      setCurrentJobId(data.job_id);
      setPayoutColumns(data.payout_columns || []);
      setLedgerColumns(data.ledger_columns || []);
      setPayoutPreview(data.payout_preview || []);
      setLedgerPreview(data.ledger_preview || []);

      simulateProgress(100, "Almost done...");

      // Small delay to show 100% completion
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: "Files uploaded successfully",
        description: "Now configure your column mappings.",
      });

      router.push("/reconciliation/mapping");
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Unexpected error",
        variant: "destructive",
      });
      setUploadStatus("Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-gray-900">
      {/* subtle gradient accents */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
            <FileCheck className="h-4 w-4" />
            Reconciliation setup
          </div>

          <h1 className="mb-4 text-4xl font-semibold text-slate-900 dark:text-white">
            Upload your payout and ledger files
          </h1>

          <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
            These files are used to detect matches, surface discrepancies,
            and prepare reconciliation summaries.
          </p>
        </section>

        <div className="mb-10 grid gap-8 lg:grid-cols-2">
          <FileDropZone
            label="Payouts File"
            description="Export from payment provider"
            file={payoutFile}
            onFileDrop={setPayoutFile}
            accept=".csv,.xlsx"
            testId="payout-drop"
          />
          <FileDropZone
            label="Ledger File"
            description="Export from accounting system"
            file={ledgerFile}
            onFileDrop={setLedgerFile}
            accept=".csv,.xlsx"
            testId="ledger-drop"
          />
        </div>

        {isUploading && (
          <div className="mx-auto mb-8 max-w-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {uploadStatus}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {uploadProgress < 20 && "Getting started..."}
                  {uploadProgress >= 20 && uploadProgress < 40 && "Uploading..."}
                  {uploadProgress >= 40 && uploadProgress < 70 && "Processing..."}
                  {uploadProgress >= 70 && uploadProgress < 90 && "Analyzing..."}
                  {uploadProgress >= 90 && uploadProgress < 100 && "Almost done..."}
                  {uploadProgress === 100 && "Complete!"}
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {uploadProgress}%
                </span>
              </div>
            </div>
            <Progress 
              value={uploadProgress} 
              indicatorColor="blue" 
              className="h-2"
            />
            {uploadProgress === 100 && (
              <p className="mt-3 text-center text-sm text-green-600 dark:text-green-400">
                ✓ Ready to proceed with column mapping
              </p>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mx-auto mb-12 max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-gray-800 dark:bg-slate-800/60">
          <div className="flex gap-3">
            <Info className="mt-1 h-5 w-5 text-blue-500" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-900 dark:text-white mb-1">
                What happens next
              </p>
              <p>
                After upload, you'll map columns between files. No data is modified.
                All processing happens on exported data only.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleUpload}
            disabled={!payoutFile || !ledgerFile || isUploading}
            className="rounded-xl text-md bg-blue-500 px-6 py-3 font-medium text-white transition hover:from-blue-600 hover:to-indigo-600"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Continue to Mapping
                <ArrowRight className="ml-3 h-5 w-5" />
              </>
            )}
          </Button>
        </div>

     
      </main>
    </div>
  );
}
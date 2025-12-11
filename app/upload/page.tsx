'use client'

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import { useToast } from "@/src/hooks/use-toast";
import { useAppStore } from "@/src/lib/store";
import { apiRequest } from "@/src/lib/queryClient";
import type { UploadResponse } from "@/@types";

interface FileDropZoneProps {
  label: string;
  description: string;
  file: File | null;
  onFileDrop: (file: File) => void;
  accept: string;
  testId: string;
}

function FileDropZone({ label, description, file, onFileDrop, accept, testId }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        onFileDrop(droppedFile);
      }
    },
    [onFileDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        onFileDrop(selectedFile);
      }
    },
    [onFileDrop]
  );

  return (
    <Card
      className={`relative transition-colors cursor-pointer ${
        isDragging ? "border-primary border-2 bg-primary/5" : file ? "border-chart-2" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={testId}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        data-testid={`${testId}-input`}
      />
      <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
        {file ? (
          <>
            <div className="w-12 h-12 rounded-full bg-chart-2/10 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-chart-2" />
            </div>
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            <p className="text-xs text-muted-foreground mt-3">
              Drag and drop or click to browse
            </p>
          </>
        )}
      </CardContent>
    </Card>
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
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("payoutFile", payoutFile);
      formData.append("ledgerFile", ledgerFile);
      formData.append("jobName", `Reconciliation ${new Date().toLocaleDateString()}`);

      setUploadProgress(30);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setUploadProgress(80);

      const data: UploadResponse = await response.json();
      
      setCurrentJobId(data.jobId);
      setPayoutColumns(data.payoutColumns || []);
      setLedgerColumns(data.ledgerColumns || []);
      setPayoutPreview(data.payoutPreview || []);
      setLedgerPreview(data.ledgerPreview || []);

      setUploadProgress(100);

      toast({
        title: "Files uploaded successfully",
        description: "Now configure your column mappings.",
      });

      router.push("/mapping");
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const canUpload = payoutFile && ledgerFile && !isUploading;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold mb-2">Reconciliation Assistant</h1>
          <p className="text-muted-foreground">
            Upload your payout and ledger files to begin the reconciliation process
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <FileDropZone
            label="Payouts File"
            description="CSV or XLSX from your payment provider"
            file={payoutFile}
            onFileDrop={setPayoutFile}
            accept=".csv,.xlsx,.xls"
            testId="dropzone-payout"
          />
          <FileDropZone
            label="Ledger File"
            description="CSV or XLSX from your accounting system"
            file={ledgerFile}
            onFileDrop={setLedgerFile}
            accept=".csv,.xlsx,.xls"
            testId="dropzone-ledger"
          />
        </div>

        {isUploading && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Uploading files...</span>
              <span className="text-sm font-mono">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleUpload}
            disabled={!canUpload}
            data-testid="button-upload"
          >
            {isUploading ? (
              "Uploading..."
            ) : (
              <>
                Continue to Mapping
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Step number={1} title="Upload" description="Upload your payout and ledger files" active />
              <Step number={2} title="Map" description="Map columns to standard fields" />
              <Step number={3} title="Match" description="Automatic matching with AI assistance" />
              <Step number={4} title="Export" description="Download PDF report and CSV" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  active = false,
}: {
  number: number;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`w-8 h-8 rounded-full mx-auto mb-3 flex items-center justify-center text-sm font-medium ${
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {number}
      </div>
      <h3 className="font-medium text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
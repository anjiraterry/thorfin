"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles, AlertCircle } from "lucide-react";

import type { ColumnMapping } from "@/@types";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/src/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/src/components/ui/table";
import { useToast } from "@/src/hooks/use-toast";
import { useAppStore } from "@/src/lib/store";

const CANONICAL_FIELDS = [
  { key: "txId", label: "Transaction ID", required: false },
  { key: "amount", label: "Amount", required: true },
  { key: "currency", label: "Currency", required: false },
  { key: "timestamp", label: "Timestamp/Date", required: false },
  { key: "fee", label: "Fee", required: false },
  { key: "merchantId", label: "Merchant ID", required: false },
  { key: "reference", label: "Reference/Note", required: false },
];

function autoDetectMapping(columns: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lowerColumns = columns.map((c) => c.toLowerCase());

  columns.forEach((col, idx) => {
    const lower = lowerColumns[idx];
    
    if (lower.includes("payout_id") || lower.includes("tx_id") || lower.includes("entry_id") || lower.includes("transaction_id")) {
      mapping.txId = col;
    } else if (lower === "amount" || lower.includes("amount")) {
      mapping.amount = col;
    } else if (lower === "currency" || lower.includes("currency")) {
      mapping.currency = col;
    } else if (lower.includes("created") || lower.includes("posted") || lower.includes("date") || lower.includes("timestamp")) {
      mapping.timestamp = col;
    } else if (lower.includes("fee")) {
      mapping.fee = col;
    } else if (lower.includes("merchant")) {
      mapping.merchantId = col;
    } else if (lower.includes("reference") || lower.includes("note") || lower === "ref") {
      mapping.reference = col;
    }
  });

  return mapping;
}

interface MappingCardProps {
  title: string;
  columns: string[];
  preview: Record<string, unknown>[];
  mapping: Partial<ColumnMapping>;
  onMappingChange: (field: keyof ColumnMapping, value: string) => void;
  testIdPrefix: string;
}

function MappingCard({ title, columns, preview, mapping, onMappingChange, testIdPrefix }: MappingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>Map your columns to standard fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {CANONICAL_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label className="flex items-center gap-2">
                {field.label}
                {field.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
              </Label>
              <Select
                value={mapping[field.key as keyof ColumnMapping] || ""}
                onValueChange={(value: string) => onMappingChange(field.key as keyof ColumnMapping, value)}
              >
                <SelectTrigger data-testid={`${testIdPrefix}-${field.key}`}>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- None --</SelectItem>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {preview.length > 0 && (
          <div className="mt-6">
            <Label className="mb-2 block">Preview (first 3 rows)</Label>
            <div className="border rounded-md overflow-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.slice(0, 6).map((col) => (
                      <TableHead key={col} className="font-mono text-xs whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 3).map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.slice(0, 6).map((col) => (
                        <TableCell key={col} className="font-mono text-xs whitespace-nowrap">
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MappingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    currentJobId,
    payoutColumns,
    ledgerColumns,
    payoutPreview,
    ledgerPreview,
    payoutMapping,
    ledgerMapping,
    setPayoutMapping,
    setLedgerMapping,
    settings,
  } = useAppStore();

  const [localPayoutMapping, setLocalPayoutMapping] = useState<Partial<ColumnMapping>>({});
  const [localLedgerMapping, setLocalLedgerMapping] = useState<Partial<ColumnMapping>>({});
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!currentJobId) {
      router.push("/");
      return;
    }

    const autoPayoutMapping = autoDetectMapping(payoutColumns);
    const autoLedgerMapping = autoDetectMapping(ledgerColumns);
    setLocalPayoutMapping(autoPayoutMapping);
    setLocalLedgerMapping(autoLedgerMapping);
  }, [currentJobId, payoutColumns, ledgerColumns, router]);

  const handlePayoutMappingChange = (field: keyof ColumnMapping, value: string) => {
    setLocalPayoutMapping((prev: any) => ({
      ...prev,
      [field]: value === "__none__" ? undefined : value,
    }));
  };

  const handleLedgerMappingChange = (field: keyof ColumnMapping, value: string) => {
    setLocalLedgerMapping((prev: any) => ({
      ...prev,
      [field]: value === "__none__" ? undefined : value,
    }));
  };

  const handleAutoDetect = () => {
    const autoPayoutMapping = autoDetectMapping(payoutColumns);
    const autoLedgerMapping = autoDetectMapping(ledgerColumns);
    setLocalPayoutMapping(autoPayoutMapping);
    setLocalLedgerMapping(autoLedgerMapping);
    toast({
      title: "Auto-detection complete",
      description: "Column mappings have been auto-detected. Please review and adjust as needed.",
    });
  };

  const validateMappings = (): boolean => {
    if (!localPayoutMapping.amount) {
      toast({
        title: "Missing required field",
        description: "Please map the Amount column for payouts.",
        variant: "destructive",
      });
      return false;
    }
    if (!localLedgerMapping.amount) {
      toast({
        title: "Missing required field",
        description: "Please map the Amount column for ledger.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleStartProcessing = async () => {
    if (!validateMappings()) return;
    if (!currentJobId) return;

    setIsStarting(true);

    try {
      const response = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentJobId,
          payoutMapping: localPayoutMapping as ColumnMapping,
          ledgerMapping: localLedgerMapping as ColumnMapping,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setPayoutMapping(localPayoutMapping as ColumnMapping);
      setLedgerMapping(localLedgerMapping as ColumnMapping);

      router.push("/processing");
    } catch (error) {
      toast({
        title: "Failed to start processing",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  if (!currentJobId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Column Mapping</h1>
            <p className="text-muted-foreground text-sm">
              Map your file columns to standard transaction fields
            </p>
          </div>
          <Button variant="outline" onClick={handleAutoDetect} data-testid="button-auto-detect">
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Detect
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <MappingCard
            title="Payouts Mapping"
            columns={payoutColumns}
            preview={payoutPreview}
            mapping={localPayoutMapping}
            onMappingChange={handlePayoutMappingChange}
            testIdPrefix="select-payout"
          />
          <MappingCard
            title="Ledger Mapping"
            columns={ledgerColumns}
            preview={ledgerPreview}
            mapping={localLedgerMapping}
            onMappingChange={handleLedgerMappingChange}
            testIdPrefix="select-ledger"
          />
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push("/")} data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleStartProcessing} disabled={isStarting} data-testid="button-start">
            {isStarting ? "Starting..." : "Start Processing"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
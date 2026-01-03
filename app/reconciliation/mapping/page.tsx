"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles, Info, Zap } from "lucide-react";

import type { ColumnMapping } from "@/types/@types";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/src/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/src/components/ui/table";
import { useToast } from "@/src/hooks/use-toast";
import { useAppStore } from "@/src/lib/store";

const CANONICAL_FIELDS = [
  { key: "tx_id", label: "Transaction ID", required: false },
  { key: "amount", label: "Amount", required: true },
  { key: "currency", label: "Currency", required: false },
  { key: "timestamp", label: "Timestamp/Date", required: false },
  { key: "fee", label: "Fee", required: false },
  { key: "merchant_id", label: "Merchant ID", required: false },
  { key: "reference", label: "Reference/Note", required: false },
];

function autoDetectMapping(columns: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lowerColumns = columns.map((c) => c.toLowerCase());

  columns.forEach((col, idx) => {
    const lower = lowerColumns[idx];
    
    if (lower.includes("payout_id") || lower.includes("tx_id") || lower.includes("entry_id") || lower.includes("transaction_id")) {
      mapping.tx_id = col;
    } else if (lower === "amount" || lower.includes("amount")) {
      mapping.amount = col;
    } else if (lower === "currency" || lower.includes("currency")) {
      mapping.currency = col;
    } else if (lower.includes("created") || lower.includes("posted") || lower.includes("date") || lower.includes("timestamp")) {
      mapping.timestamp = col;
    } else if (lower.includes("fee")) {
      mapping.fee = col;
    } else if (lower.includes("merchant")) {
      mapping.merchant_id = col;
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
    <Card className="border-2 border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-800/60 rounded-2xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">{title}</CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Map your columns to standard fields
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-2 gap-4">
          {CANONICAL_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                {field.label}
                {field.required && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 border-none"
                  >
                    Required
                  </Badge>
                )}
              </Label>
              <Select
                value={mapping[field.key as keyof ColumnMapping] || ""}
                onValueChange={(value: string) => onMappingChange(field.key as keyof ColumnMapping, value)}
              >
                <SelectTrigger 
                  className="border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 transition-colors rounded-xl"
                  data-testid={`${testIdPrefix}-${field.key}`}
                >
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent className="border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl">
                  <SelectItem value="__none__">-- None --</SelectItem>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col} className="focus:bg-blue-50 dark:focus:bg-blue-900/20">
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

          {preview.length > 0 && (
          <div className="mt-6 ">
            <Label className="mb-2 block text-sm font-medium text-slate-900 dark:text-white">
              Preview (first 3 rows)
            </Label>
            <div className="border pb-2 border-slate-200 dark:border-gray-700 rounded-xl overflow-auto  max-h-48 bg-white dark:bg-gray-800">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-gray-700/50">
                  <TableRow>
                    {columns.slice(0, 6).map((col) => (
                      <TableHead 
                        key={col} 
                        className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs py-3"
                      >
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 3).map((row, idx) => (
                    <TableRow 
                      key={idx} 
                      className="border-b border-slate-100 dark:border-gray-700 last:border-0 hover:bg-slate-50 dark:hover:bg-gray-700/30"
                    >
                      {columns.slice(0, 6).map((col) => (
                        <TableCell 
                          key={col} 
                          className="font-mono text-xs whitespace-nowrap text-slate-600 dark:text-slate-400 py-2"
                        >
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
    current_job_id,
    payout_columns,
    ledger_columns,
    payout_preview,
    ledger_preview,
    setPayoutMapping,
    setLedgerMapping,
    settings,
  } = useAppStore();

  const [localPayoutMapping, setLocalPayoutMapping] = useState<Partial<ColumnMapping>>({});
  const [localLedgerMapping, setLocalLedgerMapping] = useState<Partial<ColumnMapping>>({});
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!current_job_id) {
      router.push("/");
      return;
    }

    const autoPayoutMapping = autoDetectMapping(payout_columns);
    const autoLedgerMapping = autoDetectMapping(ledger_columns);
    setLocalPayoutMapping(autoPayoutMapping);
    setLocalLedgerMapping(autoLedgerMapping);
  }, [current_job_id, payout_columns, ledger_columns, router]);

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
    const autoPayoutMapping = autoDetectMapping(payout_columns);
    const autoLedgerMapping = autoDetectMapping(ledger_columns);
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
    if (!current_job_id) return;

    setIsStarting(true);

    try {
      const response = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: current_job_id,
          payout_mapping: localPayoutMapping as ColumnMapping,
          ledger_mapping: localLedgerMapping as ColumnMapping,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setPayoutMapping(localPayoutMapping as ColumnMapping);
      setLedgerMapping(localLedgerMapping as ColumnMapping);

      router.push("/reconciliation/processing");
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

  if (!current_job_id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      {/* subtle gradient accents */}
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-linear-to-tl from-blue-500/10 to-purple-500/10 blur-3xl" />

      <main className="relative mx-auto max-w-6xl px-6 py-12 z-10">
        <section className="mb-12 text-center">
      

          <h1 className="mb-4 text-4xl font-semibold text-slate-900 dark:text-white">
            Map your file columns
          </h1>

          <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
            Connect your payout and ledger columns to standard transaction fields for accurate reconciliation.
          </p>
        </section>

        <div className="mb-8 flex justify-end">
          <Button
            onClick={handleAutoDetect}
            variant="outline"
            className="rounded-xl border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400"
            data-testid="button-auto-detect"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Detect Columns
          </Button>
        </div>

        <div className="mb-10 grid gap-8 lg:grid-cols-2">
          <MappingCard
            title="Payouts Mapping"
            columns={payout_columns}
            preview={payout_preview}
            mapping={localPayoutMapping}
            onMappingChange={handlePayoutMappingChange}
            testIdPrefix="select-payout"
          />
          <MappingCard
            title="Ledger Mapping"
            columns={ledger_columns}
            preview={ledger_preview}
            mapping={localLedgerMapping}
            onMappingChange={handleLedgerMappingChange}
            testIdPrefix="select-ledger"
          />
        </div>

        {/* Instructions */}
        <div className="mx-auto mb-12 max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-gray-800 dark:bg-slate-800/60">
          <div className="flex gap-3">
            <Info className="mt-1 h-5 w-5 text-blue-500" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-900 dark:text-white mb-1">
                Tips for successful mapping
              </p>
              <ul className="space-y-2 mt-2">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span><strong>Amount</strong> is required for both files</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span><strong>Transaction ID</strong> helps with exact matching</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span><strong>Timestamp</strong> improves fuzzy matching accuracy</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span>Use <strong>Auto-Detect</strong> for quick mapping suggestions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="rounded-xl border-slate-300 dark:border-gray-700 px-6 py-3 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-3 h-5 w-5" />
            Back to Upload
          </Button>
          <Button
            onClick={handleStartProcessing}
            disabled={isStarting}
            className="rounded-xl text-md bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
            data-testid="button-start"
          >
            {isStarting ? "Starting..." : "Start Processing"}
            <ArrowRight className="ml-3 h-5 w-5" />
          </Button>
        </div>
      </main>

      {/* Global styles for custom scrollbars */}
      <style jsx global>{`
        /* Custom scrollbar styles for the entire app */
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

        /* Dark mode scrollbars */
        .dark * {
          scrollbar-color: #475569 transparent;
        }

        .dark *::-webkit-scrollbar-thumb {
          background-color: #475569;
        }

        .dark *::-webkit-scrollbar-thumb:hover {
          background-color: #64748b;
        }

        /* Specific styles for table containers */
        [class*="overflow-auto"]::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        [class*="overflow-auto"]::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
          margin: 2px;
        }

        [class*="overflow-auto"]::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
          border: 2px solid #f1f5f9;
        }

        [class*="overflow-auto"]::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .dark [class*="overflow-auto"]::-webkit-scrollbar-track {
          background: #1e293b;
        }

        .dark [class*="overflow-auto"]::-webkit-scrollbar-thumb {
          background: #475569;
          border: 2px solid #1e293b;
        }

        .dark [class*="overflow-auto"]::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        /* Prevent horizontal scroll on body */
        body {
          overflow-x: hidden;
        }
      `}</style>
    </div>
  );
}
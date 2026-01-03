import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { InsertTransactionRecord, ColumnMapping } from "@/types/@types";

export interface ParsedFile {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function parseCSV(content: string): ParsedFile {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const columns = result.meta.fields || [];
  const rows = result.data as Record<string, unknown>[];

  return { columns, rows };
}

export function parseXLSX(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  
  if (jsonData.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = (jsonData[0] as string[]).map((col) => String(col).trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row: Record<string, unknown> = {};
    const rowData = jsonData[i] as unknown[];
    
    columns.forEach((col, idx) => {
      row[col] = rowData[idx] ?? null;
    });
    
    if (Object.values(row).some((v) => v !== null && v !== undefined && v !== "")) {
      rows.push(row);
    }
  }

  return { columns, rows };
}

export function parseFile(filename: string, content: Buffer | string): ParsedFile {
  const extension = filename.toLowerCase().split(".").pop();

  if (extension === "csv") {
    const text = typeof content === "string" ? content : content.toString("utf-8");
    return parseCSV(text);
  } else if (extension === "xlsx" || extension === "xls") {
    const buffer = typeof content === "string" ? Buffer.from(content) : content;
    return parseXLSX(buffer);
  }

  throw new Error(`Unsupported file format: ${extension}`);
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return Math.round(num * 100);
    }
  }
  return 0;
}

function normalizeTimestamp(value: unknown): string | null {
  if (!value) return null;
  
  if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      return new Date(excelDate.y, excelDate.m - 1, excelDate.d).toISOString();
    }
  }
  
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return value;
  }
  
  return null;
}

export function normalizeTransactions(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  source: "payout" | "ledger",
  jobId: string,
  filename: string
): InsertTransactionRecord[] {
  return rows.map((row, index) => {
    // Use snake_case property names from ColumnMapping type
    const txId = mapping.tx_id ? String(row[mapping.tx_id] ?? "") : undefined;
    const amountCents = parseAmount(row[mapping.amount]);
    const currency = mapping.currency ? String(row[mapping.currency] ?? "USD") : "USD";
    const timestamp = mapping.timestamp ? (normalizeTimestamp(row[mapping.timestamp]) ?? new Date().toISOString()) : new Date().toISOString();
    const feeCents = mapping.fee ? parseAmount(row[mapping.fee]) : undefined;
    const merchantId = mapping.merchant_id ? String(row[mapping.merchant_id] ?? "") : undefined;
    const reference = mapping.reference ? String(row[mapping.reference] ?? "") : undefined;

    // Return in snake_case format to match InsertTransactionRecord type
    return {
      job_id: jobId, // snake_case
      source,
      source_filename: filename, // snake_case
      row_index: index, // snake_case
      tx_id: txId || undefined, // snake_case
      amount_cents: amountCents, // snake_case
      currency,
      timestamp,
      fee_cents: feeCents, // snake_case
      merchant_id: merchantId || undefined, // snake_case
      reference: reference || undefined,
      raw: row,
      normalized_fields: { // snake_case
        tx_id: txId,
        amount_cents: amountCents,
        currency,
        timestamp,
        fee_cents: feeCents,
        merchant_id: merchantId,
        reference,
      },
    };
  });
}

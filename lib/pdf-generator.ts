import PDFDocument from "pdfkit";
import type { Job, MatchRecord, Cluster, TransactionRecord } from "@/@types";

interface PdfData {
  job: Job;
  stats: {
    total_payouts: number;
    total_ledger: number;
    matched_count: number;
    unmatched_count: number;
    match_rate: number;
    total_unmatched_amount: number;
  };
  matches: (MatchRecord & { payout: TransactionRecord; ledger: TransactionRecord })[];
  clusters: Cluster[];
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// Helper function to safely format cents (handles undefined)
function safeFormatCents(cents: number | undefined): string {
  if (cents === undefined) return "$0.00";
  return formatCents(cents);
}

export function generatePDFReport(data: PdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cover Page
    doc.fontSize(24).font("Helvetica-Bold").text("Reconciliation Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).font("Helvetica").text(data.job.name || "Untitled Job", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#666666").text(
      `Generated: ${new Date().toLocaleString()}`,
      { align: "center" }
    );
    doc.moveDown(2);

    // Summary Statistics
    doc.fillColor("#000000");
    doc.fontSize(16).font("Helvetica-Bold").text("Summary Statistics");
    doc.moveDown(0.5);
    
    const statsY = doc.y;
    doc.fontSize(10).font("Helvetica");
    
    const statsData = [
      ["Total Payouts", data.stats.total_payouts.toLocaleString()],
      ["Total Ledger Entries", data.stats.total_ledger.toLocaleString()],
      ["Matched Transactions", data.stats.matched_count.toLocaleString()],
      ["Unmatched Transactions", data.stats.unmatched_count.toLocaleString()],
      ["Match Rate", `${(data.stats.match_rate * 100).toFixed(1)}%`],
      ["Total Unmatched Amount", formatCents(data.stats.total_unmatched_amount)],
    ];

    statsData.forEach(([label, value], i) => {
      doc.text(label, 50, statsY + i * 18);
      doc.text(value, 250, statsY + i * 18);
    });

    doc.moveDown(4);

    // Match Summary
    if (data.matches.length > 0) {
      doc.addPage();
      doc.fontSize(16).font("Helvetica-Bold").text("Match Summary");
      doc.moveDown(0.5);
      
      doc.fontSize(8).font("Helvetica");
      
      const matchHeaders = ["Type", "Payout ID", "Ledger ID", "Amount", "Score", "Confidence"];
      const colWidths = [60, 100, 100, 80, 50, 70];
      let tableY = doc.y;
      
      // Header
      doc.font("Helvetica-Bold");
      matchHeaders.forEach((header, i) => {
        let x = 50;
        for (let j = 0; j < i; j++) x += colWidths[j];
        doc.text(header, x, tableY, { width: colWidths[i] });
      });
      
      tableY += 15;
      doc.moveTo(50, tableY).lineTo(510, tableY).stroke();
      tableY += 5;

      // Rows
      doc.font("Helvetica");
      const displayMatches = data.matches.slice(0, 50);
      
      displayMatches.forEach((match) => {
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
        }
        
        const rowData = [
          match.match_type || "-",
          match.payout?.tx_id?.slice(0, 12) || "-",
          match.ledger?.tx_id?.slice(0, 12) || "-",
          safeFormatCents(match.payout?.amount_cents),
          `${((match.score || 0) * 100).toFixed(0)}%`,
          match.confidence_level || "-",
        ];
        
        rowData.forEach((cell, i) => {
          let x = 50;
          for (let j = 0; j < i; j++) x += colWidths[j];
          doc.text(String(cell), x, tableY, { width: colWidths[i] });
        });
        
        tableY += 12;
      });

      if (data.matches.length > 50) {
        doc.moveDown();
        doc.fillColor("#666666").text(`... and ${data.matches.length - 50} more matches`);
        doc.fillColor("#000000");
      }
    }

    // Cluster Analysis
    if (data.clusters.length > 0) {
      doc.addPage();
      doc.fontSize(16).font("Helvetica-Bold").text("Exception Clusters");
      doc.moveDown(0.5);

      data.clusters.slice(0, 20).forEach((cluster, index) => {
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(12).font("Helvetica-Bold");
        doc.text(`${index + 1}. ${cluster.merchant_name || "Unknown Merchant"}`);
        
        doc.fontSize(9).font("Helvetica").fillColor("#666666");
        doc.text(
          `Amount Bucket: ${cluster.amount_bucket || "Unknown"} | Date: ${cluster.date_bucket || "Unknown"} | Transactions: ${cluster.size || 0} | Total: ${safeFormatCents(cluster.total_amount_cents)}`
        );
        
        doc.fillColor("#000000");
        
        if (cluster.llm_summary) {
          doc.moveDown(0.3);
          doc.fontSize(9).font("Helvetica-Oblique");
          doc.text(`AI Summary: ${cluster.llm_summary}`);
          
          if (cluster.suggested_action) {
            doc.moveDown(0.2);
            doc.text(`Suggested Action: ${cluster.suggested_action}`);
          }
        }
        
        doc.moveDown(0.8);
      });

      if (data.clusters.length > 20) {
        doc.fillColor("#666666").text(`... and ${data.clusters.length - 20} more clusters`);
        doc.fillColor("#000000");
      }
    }

    // Footer on last page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#999999");
      doc.text(
        `Page ${i + 1} of ${pageCount} | Generated by Reconciliation Assistant`,
        50,
        doc.page.height - 40,
        { align: "center", width: doc.page.width - 100 }
      );
    }

    doc.end();
  });
}
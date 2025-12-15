"use client"
import {
  ArrowRight,
  FileCheck,
  Shield,
  Zap,
  CheckCircle,
  Upload,
  SlidersHorizontal,
  Cpu,
  Download
} from "lucide-react";
import { ThemeToggle } from "@/src/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-600 dark:bg-gray-900 dark:text-slate-300">

      {/* subtle decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[40%] -right-40 h-[28rem] w-[28rem] rounded-full bg-linear-to-br from-indigo-500/10 to-blue-500/10 blur-3xl" />

      {/* Header */}
    

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          <CheckCircle className="h-4 w-4" />
          Automate repetitive finance & compliance prep work
        </div>

        <h1 className="mx-auto mb-6 max-w-3xl text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Stop drowning in reconciliation and compliance paperwork
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Two boring, high-leverage fintech automations that save real hours.
          No regulated decisions. No production access. Just work that disappears.
        </p>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-8 md:grid-cols-2">

          {/* Reconciliation */}
          <div className="group relative rounded-2xl border-2 border-slate-200 bg-white transition-all hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 dark:border-gray-800 dark:bg-slate-800/60 dark:hover:border-blue-400">
            <div className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <FileCheck className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>

              <h2 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Reconciliation Assistant
              </h2>

              <p className="mb-6 text-slate-600 dark:text-slate-400">
                Match payout exports with ledger data. Surface exceptions.
                Explain what broke and why.
              </p>

              <div className="mb-6 space-y-3">
                <Feature text="Deterministic matching engine" />
                <Feature text="Exception clustering" />
                <Feature text="AI reconciliation summaries" />
                <Feature text="Exportable evidence reports" />
              </div>

              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Time saved
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  4–10 hrs/week
                </div>
              </div>

              <button
                onClick={() => (window.location.href = "/reconciliation/upload")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-6 py-3 font-medium text-white transition hover:from-blue-600 hover:to-indigo-600"
              >
                Start Reconciliation
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Compliance */}
          <div className="group relative rounded-2xl border-2 border-slate-200 bg-white transition-all hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/5 dark:border-gray-800 dark:bg-slate-800/60 dark:hover:border-indigo-400">
            <div className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
              </div>

              <h2 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">
                Compliance Prep Assistant
              </h2>

              <p className="mb-6 text-slate-600 dark:text-slate-400">
                Pre-process KYC documents, flag gaps, and generate
                reviewer-ready packets.
              </p>

              <div className="mb-6 space-y-3">
                <Feature text="Bulk document ingestion" />
                <Feature text="OCR + field extraction" />
                <Feature text="Quality & completeness checks" />
                <Feature text="Audit-friendly outputs" />
              </div>

              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Time saved
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  6–12 hrs/week
                </div>
              </div>

              <button
                onClick={() => (window.location.href = "/compliance/upload")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-3 font-medium text-white transition hover:from-indigo-600 hover:to-blue-600"
              >
                Start Compliance Review
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-semibold text-slate-900 dark:text-white">
            Simple. Predictable. Boring in the right way.
          </h2>

          <div className="grid gap-8 md:grid-cols-4">
            <Step icon={Upload} title="Upload" desc="Drop files or bulk exports" />
            <Step icon={SlidersHorizontal} title="Map" desc="Auto-detect or adjust columns" />
            <Step icon={Cpu} title="Process" desc="Rules first, AI second" />
            <Step icon={Download} title="Export" desc="PDFs, CSVs, evidence" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 text-center md:grid-cols-3">
            <Stat value="10+" label="Hours saved per week" />
            <Stat value="85%+" label="Auto-match rate" />
            <Stat value="100%" label="Evidence-backed output" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 dark:border-gray-800">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Thorfin· Built for teams who work with time
        </p>
      </footer>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle className="h-4 w-4 text-slate-400" />
      <span>{text}</span>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  desc
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="mb-1 font-medium text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="mb-1 text-4xl font-semibold text-slate-900 dark:text-white">
        {value}
      </div>
      <div className="text-slate-600 dark:text-slate-400">{label}</div>
    </div>
  );
}

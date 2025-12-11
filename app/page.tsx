"use client"
import { ArrowRight, FileCheck, Shield, Zap, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">FinOps Prep Suite</span>
          </div>
          <div className="text-sm text-slate-600">
            Save 10+ hours per week on finance prep work
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-6">
          <CheckCircle className="w-4 h-4" />
          Automate repetitive finance & compliance prep work
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight mb-6 max-w-3xl mx-auto">
          Stop drowning in reconciliation and compliance paperwork
        </h1>
        
        <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
          Two brutal, boring, high-value fintech automations that save your team hours every week. 
          No touching regulated decisions. Just the prep work nobody wants to do.
        </p>
      </section>

      {/* Module Cards */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Module A: Reconciliation */}
          <div className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all duration-300 overflow-hidden hover:shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full" />
            
            <div className="relative p-8">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-bold mb-3">Reconciliation Assistant</h2>
              <p className="text-slate-600 mb-6">
                Match payout CSVs with ledger entries automatically. Get exception clusters with AI summaries.
              </p>
              
              <div className="space-y-3 mb-8">
                <Feature text="Deterministic matching engine" />
                <Feature text="Exception clustering & analysis" />
                <Feature text="AI-generated summaries" />
                <Feature text="Exportable PDF reports" />
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
                  Time Saved
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  4-10 hours/week
                </div>
              </div>
              
              <button 
                onClick={() => window.location.href = '/reconciliation/upload'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors group-hover:scale-[1.02] transition-transform"
              >
                Start Reconciliation
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Module B: Compliance Prep */}
          <div className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500 transition-all duration-300 overflow-hidden hover:shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full" />
            
            <div className="relative p-8">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              
              <h2 className="text-2xl font-bold mb-3">Compliance Prep Assistant</h2>
              <p className="text-slate-600 mb-6">
                Process KYC documents with OCR, extract fields, flag issues, and generate reviewer packets.
              </p>
              
              <div className="space-y-3 mb-8">
                <Feature text="Bulk document processing" />
                <Feature text="OCR + field extraction" />
                <Feature text="Quality & completeness checks" />
                <Feature text="Reviewer-ready packets" />
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
                  Time Saved
                </div>
                <div className="text-3xl font-bold text-emerald-600">
                  6-12 hours/week
                </div>
              </div>
              
              <button 
                onClick={() => window.location.href = '/compliance/upload'}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors group-hover:scale-[1.02] transition-transform"
              >
                Start Compliance Review
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Simple, Fast, Reliable</h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <Step 
              number="1" 
              title="Upload" 
              description="Drop your files or upload in bulk"
            />
            <Step 
              number="2" 
              title="Map" 
              description="Auto-detect columns or map manually"
            />
            <Step 
              number="3" 
              title="Process" 
              description="Deterministic rules + AI summaries"
            />
            <Step 
              number="4" 
              title="Export" 
              description="Download PDF reports and CSVs"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <Stat value="10+" label="Hours saved per week" />
            <Stat value="85%+" label="Auto-match rate" />
            <Stat value="100%" label="Evidence-backed output" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-600">
          <p>FinOps Prep Suite — Built for finance and compliance teams who value their time</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <CheckCircle className="w-3 h-3 text-blue-600" />
      </div>
      <span className="text-sm text-slate-700">{text}</span>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-white border-2 border-blue-200 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-blue-600">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-slate-900 mb-2">{value}</div>
      <div className="text-slate-600">{label}</div>
    </div>
  );
}
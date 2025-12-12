import { create } from "zustand";
import type { 
  Job, 
  TransactionRecord, 
  MatchRecord, 
  Cluster,
  ColumnMapping,
  JobSettings,
  defaultSettings
} from "@/@types";

interface AppState {
  current_job_id: string | null;
  setCurrentJobId: (id: string | null) => void;

  selected_transaction_id: string | null;
  setSelectedTransactionId: (id: string | null) => void;

  selected_match_id: string | null;
  setSelectedMatchId: (id: string | null) => void;

  selected_cluster_id: string | null;
  setSelectedClusterId: (id: string | null) => void;

  active_tab: "transactions" | "matches" | "clusters";
  setActiveTab: (tab: "transactions" | "matches" | "clusters") => void;

  view_mode: "split" | "table";
  setViewMode: (mode: "split" | "table") => void;

  settings: JobSettings;
  setSettings: (settings: Partial<JobSettings>) => void;

  payout_columns: string[];
  setPayoutColumns: (columns: string[]) => void;

  ledger_columns: string[];
  setLedgerColumns: (columns: string[]) => void;

  payout_mapping: ColumnMapping | null;
  setPayoutMapping: (mapping: ColumnMapping | null) => void;

  ledger_mapping: ColumnMapping | null;
  setLedgerMapping: (mapping: ColumnMapping | null) => void;

  payout_preview: Record<string, unknown>[];
  setPayoutPreview: (preview: Record<string, unknown>[]) => void;

  ledger_preview: Record<string, unknown>[];
  setLedgerPreview: (preview: Record<string, unknown>[]) => void;

  reset: () => void;
}

const initialSettings: JobSettings = {
  amount_tolerance_cents: 100,
  time_window_hours: 48,
  fuzzy_threshold: 85,
  token_budget: 2000,
  max_rows: 10000,
};

export const useAppStore = create<AppState>((set) => ({
  // State properties (snake_case)
  current_job_id: null,
  selected_transaction_id: null,
  selected_match_id: null,
  selected_cluster_id: null,
  active_tab: "transactions",
  view_mode: "split",
  settings: initialSettings,
  payout_columns: [],
  ledger_columns: [],
  payout_mapping: null,
  ledger_mapping: null,
  payout_preview: [],
  ledger_preview: [],

  // Actions (camelCase for React convention)
  setCurrentJobId: (id) => set({ current_job_id: id }),
  setSelectedTransactionId: (id) => set({ selected_transaction_id: id }),
  setSelectedMatchId: (id) => set({ selected_match_id: id }),
  setSelectedClusterId: (id) => set({ selected_cluster_id: id }),
  setActiveTab: (tab) => set({ active_tab: tab }),
  setViewMode: (mode) => set({ view_mode: mode }),
  
  setSettings: (newSettings) =>
    set((state) => ({ 
      settings: { ...state.settings, ...newSettings } 
    })),

  setPayoutColumns: (columns) => set({ payout_columns: columns }),
  setLedgerColumns: (columns) => set({ ledger_columns: columns }),
  setPayoutMapping: (mapping) => set({ payout_mapping: mapping }),
  setLedgerMapping: (mapping) => set({ ledger_mapping: mapping }),
  setPayoutPreview: (preview) => set({ payout_preview: preview }),
  setLedgerPreview: (preview) => set({ ledger_preview: preview }),

  reset: () =>
    set({
      current_job_id: null,
      selected_transaction_id: null,
      selected_match_id: null,
      selected_cluster_id: null,
      active_tab: "transactions",
      view_mode: "split",
      payout_columns: [],
      ledger_columns: [],
      payout_mapping: null,
      ledger_mapping: null,
      payout_preview: [],
      ledger_preview: [],
      settings: initialSettings,
    }),
}));

// Optional: Create selectors for easier access
export const appSelectors = {
  // Getters for state (can use in components)
  currentJobId: (state: AppState) => state.current_job_id,
  selectedTransactionId: (state: AppState) => state.selected_transaction_id,
  selectedMatchId: (state: AppState) => state.selected_match_id,
  selectedClusterId: (state: AppState) => state.selected_cluster_id,
  activeTab: (state: AppState) => state.active_tab,
  viewMode: (state: AppState) => state.view_mode,
  settings: (state: AppState) => state.settings,
  payoutColumns: (state: AppState) => state.payout_columns,
  ledgerColumns: (state: AppState) => state.ledger_columns,
  payoutMapping: (state: AppState) => state.payout_mapping,
  ledgerMapping: (state: AppState) => state.ledger_mapping,
  payoutPreview: (state: AppState) => state.payout_preview,
  ledgerPreview: (state: AppState) => state.ledger_preview,
};
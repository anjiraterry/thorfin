import { create } from "zustand";
import type { 
  Job, 
  TransactionRecord, 
  MatchRecord, 
  Cluster,
  ColumnMapping,
  JobSettings,
  defaultSettings
} from "@shared/schema";

interface AppState {
  currentJobId: string | null;
  setCurrentJobId: (id: string | null) => void;

  selectedTransactionId: string | null;
  setSelectedTransactionId: (id: string | null) => void;

  selectedMatchId: string | null;
  setSelectedMatchId: (id: string | null) => void;

  selectedClusterId: string | null;
  setSelectedClusterId: (id: string | null) => void;

  activeTab: "transactions" | "matches" | "clusters";
  setActiveTab: (tab: "transactions" | "matches" | "clusters") => void;

  viewMode: "split" | "table";
  setViewMode: (mode: "split" | "table") => void;

  settings: JobSettings;
  setSettings: (settings: Partial<JobSettings>) => void;

  payoutColumns: string[];
  setPayoutColumns: (columns: string[]) => void;

  ledgerColumns: string[];
  setLedgerColumns: (columns: string[]) => void;

  payoutMapping: ColumnMapping | null;
  setPayoutMapping: (mapping: ColumnMapping | null) => void;

  ledgerMapping: ColumnMapping | null;
  setLedgerMapping: (mapping: ColumnMapping | null) => void;

  payoutPreview: Record<string, unknown>[];
  setPayoutPreview: (preview: Record<string, unknown>[]) => void;

  ledgerPreview: Record<string, unknown>[];
  setLedgerPreview: (preview: Record<string, unknown>[]) => void;

  reset: () => void;
}

const initialSettings: JobSettings = {
  amountToleranceCents: 100,
  timeWindowHours: 48,
  fuzzyThreshold: 85,
  tokenBudget: 2000,
  maxRows: 10000,
};

export const useAppStore = create<AppState>((set) => ({
  currentJobId: null,
  setCurrentJobId: (id) => set({ currentJobId: id }),

  selectedTransactionId: null,
  setSelectedTransactionId: (id) => set({ selectedTransactionId: id }),

  selectedMatchId: null,
  setSelectedMatchId: (id) => set({ selectedMatchId: id }),

  selectedClusterId: null,
  setSelectedClusterId: (id) => set({ selectedClusterId: id }),

  activeTab: "transactions",
  setActiveTab: (tab) => set({ activeTab: tab }),

  viewMode: "split",
  setViewMode: (mode) => set({ viewMode: mode }),

  settings: initialSettings,
  setSettings: (newSettings) =>
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),

  payoutColumns: [],
  setPayoutColumns: (columns) => set({ payoutColumns: columns }),

  ledgerColumns: [],
  setLedgerColumns: (columns) => set({ ledgerColumns: columns }),

  payoutMapping: null,
  setPayoutMapping: (mapping) => set({ payoutMapping: mapping }),

  ledgerMapping: null,
  setLedgerMapping: (mapping) => set({ ledgerMapping: mapping }),

  payoutPreview: [],
  setPayoutPreview: (preview) => set({ payoutPreview: preview }),

  ledgerPreview: [],
  setLedgerPreview: (preview) => set({ ledgerPreview: preview }),

  reset: () =>
    set({
      currentJobId: null,
      selectedTransactionId: null,
      selectedMatchId: null,
      selectedClusterId: null,
      activeTab: "transactions",
      payoutColumns: [],
      ledgerColumns: [],
      payoutMapping: null,
      ledgerMapping: null,
      payoutPreview: [],
      ledgerPreview: [],
    }),
}));

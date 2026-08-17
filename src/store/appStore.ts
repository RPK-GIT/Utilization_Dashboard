"use client";

import { create } from "zustand";
import type { AppConfig, Dataset, FilterState } from "@/core/types";
import { EMPTY_FILTERS } from "@/core/types";
import { DEFAULT_CONFIG } from "@/core/config/defaults";
import { bumpVersion } from "@/core/config/schema";
import { classifyRows } from "@/core/classify/engine";
import { buildValidationReport } from "@/core/ingest/validation";
import {
  loadConfig,
  loadConfigHistory,
  loadDatasets,
  persistConfig,
  persistConfigHistory,
  persistDatasets,
} from "./db";
import { loadFilters, saveFilters } from "@/components/filterPersistence";

const FILTERS_KEY = "utilization:filters";

/**
 * Interactive-mode application store. Configuration, datasets, derived data
 * and presentation state are kept separate; nothing here embeds business
 * rules — those live in the core engines.
 */

interface AppState {
  hydrated: boolean;
  config: AppConfig;
  configHistory: AppConfig[];
  datasets: Dataset[];
  filters: FilterState;

  hydrate: () => Promise<void>;
  /** Persists an edited configuration, bumping the version. */
  saveConfig: (next: AppConfig) => Promise<AppConfig>;
  addDataset: (dataset: Dataset, replaceId?: string) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  /** Re-classifies a dataset with the CURRENT configuration (explicit action). */
  reprocessDataset: (id: string) => Promise<void>;
  setFilters: (filters: FilterState) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  config: DEFAULT_CONFIG,
  configHistory: [DEFAULT_CONFIG],
  datasets: [],
  filters: { ...EMPTY_FILTERS },

  hydrate: async () => {
    if (get().hydrated) return;
    const [config, history, datasets] = await Promise.all([
      loadConfig(),
      loadConfigHistory(),
      loadDatasets(),
    ]);
    if (!config) {
      await persistConfig(DEFAULT_CONFIG);
      await persistConfigHistory([DEFAULT_CONFIG]);
    }
    set({
      hydrated: true,
      config: config ?? DEFAULT_CONFIG,
      configHistory: history.length > 0 ? history : [DEFAULT_CONFIG],
      datasets,
      // A refresh keeps the user's filter state (session-scoped).
      filters: loadFilters(FILTERS_KEY) ?? { ...EMPTY_FILTERS },
    });
  },

  saveConfig: async (next) => {
    const current = get().config;
    const saved: AppConfig = {
      ...next,
      version: bumpVersion(current.version),
      updatedAt: new Date().toISOString(),
    };
    const history = [...get().configHistory, saved];
    await persistConfig(saved);
    await persistConfigHistory(history);
    set({ config: saved, configHistory: history });
    return saved;
  },

  addDataset: async (dataset, replaceId) => {
    const datasets = [
      ...get().datasets.filter((d) => d.id !== replaceId),
      dataset,
    ].sort((a, b) => a.period.localeCompare(b.period));
    await persistDatasets(datasets);
    set({ datasets });
  },

  deleteDataset: async (id) => {
    const datasets = get().datasets.filter((d) => d.id !== id);
    await persistDatasets(datasets);
    set({ datasets });
  },

  reprocessDataset: async (id) => {
    const { config, datasets } = get();
    const next = datasets.map((d) => {
      if (d.id !== id) return d;
      const classified = classifyRows(d.rows, config, d.period);
      return {
        ...d,
        classified,
        configVersion: config.version,
        configSnapshot: config,
        processedAt: new Date().toISOString(),
        validation: buildValidationReport({
          fileName: d.fileName,
          sheetName: d.sheetName,
          sourceRows: d.rows,
          classifiedRows: classified,
          config,
        }),
      };
    });
    await persistDatasets(next);
    set({ datasets: next });
  },

  setFilters: (filters) => {
    saveFilters(FILTERS_KEY, filters);
    set({ filters });
  },
}));

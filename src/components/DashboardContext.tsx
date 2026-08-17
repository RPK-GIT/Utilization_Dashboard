"use client";

import * as React from "react";
import type {
  ClassifiedRow,
  FilterState,
  SnapshotConfig,
} from "@/core/types";
import { applyFilters } from "@/core/filters/engine";

/**
 * Mode-aware dashboard context. The interactive app feeds it from the store;
 * the executive snapshot viewer feeds it from the embedded frozen payload.
 * Views and drilldowns consume this context only, so both modes render the
 * exact same components.
 */

export type DashboardMode = "interactive" | "snapshot";

export interface DashboardMeta {
  title: string;
  subtitle: string;
  periodLabel: string;
  generatedAt: string | null;
  dataThrough: string | null;
}

export interface DashboardData {
  mode: DashboardMode;
  rows: ClassifiedRow[];
  /** Rows with the active filters applied — the scope for every KPI/chart/table. */
  filtered: ClassifiedRow[];
  config: SnapshotConfig;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  availablePeriods: { period: string; label: string }[];
  meta: DashboardMeta;
}

const DashboardContext = React.createContext<DashboardData | null>(null);

export function DashboardProvider({
  value,
  children,
}: {
  value: Omit<DashboardData, "filtered">;
  children: React.ReactNode;
}) {
  const filtered = React.useMemo(
    () => applyFilters(value.rows, value.filters),
    [value.rows, value.filters],
  );
  const data = React.useMemo(() => ({ ...value, filtered }), [value, filtered]);
  return (
    <DashboardContext.Provider value={data}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardData {
  const ctx = React.useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}

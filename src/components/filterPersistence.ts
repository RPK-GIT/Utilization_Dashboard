"use client";

import type { FilterState } from "@/core/types";
import { EMPTY_FILTERS } from "@/core/types";

/**
 * Session-scoped filter persistence so a browser refresh keeps the user's
 * dashboard state (hash routing already covers back/forward). Works on
 * http and file:// alike; malformed or missing values fall back cleanly.
 */

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function loadFilters(key: string): FilterState | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FilterState>;
    return {
      ...EMPTY_FILTERS,
      periods: stringArray(parsed.periods),
      teams: stringArray(parsed.teams),
      employees: stringArray(parsed.employees),
      categories: stringArray(parsed.categories),
      codes: stringArray(parsed.codes),
      dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : null,
      dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : null,
      search: typeof parsed.search === "string" ? parsed.search : "",
    };
  } catch {
    return null;
  }
}

export function saveFilters(key: string, filters: FilterState): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(filters));
  } catch {
    // Storage unavailable (private mode, file:// restrictions) — state still
    // survives in-app navigation via React state.
  }
}

/* ------------------------------------------------------------------ */
/* Presentation (visualization) preferences — session-scoped, NEVER    */
/* part of the business configuration.                                 */
/* ------------------------------------------------------------------ */

export interface StoredVizSelection {
  metric: string;
  viz: string;
  dimension: string;
}

export function loadPresentation(key: string): Record<string, StoredVizSelection> {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePresentation(
  key: string,
  value: Record<string, StoredVizSelection>,
): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal — presentation preferences simply reset next session.
  }
}

import type { ClassifiedRow, FilterState } from "../types";
import { EMPTY_FILTERS } from "../types";

/**
 * Filter engine. A single applyFilters() feeds every KPI card, chart, table
 * and drilldown so filtered views stay consistent across the application.
 */

export function applyFilters(
  rows: ClassifiedRow[],
  filters: FilterState,
): ClassifiedRow[] {
  const search = filters.search.trim().toUpperCase();
  return rows.filter((row) => {
    if (filters.periods.length && !filters.periods.includes(row.month)) return false;
    if (filters.teams.length && !filters.teams.includes(row.team)) return false;
    if (filters.employees.length && !filters.employees.includes(row.employee)) return false;
    if (
      filters.categories.length &&
      (!row.developmentCategory || !filters.categories.includes(row.developmentCategory))
    ) {
      return false;
    }
    if (
      filters.codes.length &&
      (!row.developmentCode || !filters.codes.includes(row.developmentCode))
    ) {
      return false;
    }
    if (filters.dateFrom && (!row.date || row.date < filters.dateFrom)) return false;
    if (filters.dateTo && (!row.date || row.date > filters.dateTo)) return false;
    if (search) {
      const haystack = `${row.wbs} ${row.employee} ${row.shortText}`.toUpperCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.periods.length > 0 ||
    filters.teams.length > 0 ||
    filters.employees.length > 0 ||
    filters.categories.length > 0 ||
    filters.codes.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.search.trim() !== ""
  );
}

export function clearFilters(): FilterState {
  return { ...EMPTY_FILTERS };
}

export interface FilterChip {
  kind: keyof FilterState;
  label: string;
  value: string;
}

/** Active filters rendered as removable chips. */
export function filterChips(
  filters: FilterState,
  periodLabel: (period: string) => string,
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const p of filters.periods)
    chips.push({ kind: "periods", label: `Period: ${periodLabel(p)}`, value: p });
  for (const t of filters.teams)
    chips.push({ kind: "teams", label: `Team: ${t}`, value: t });
  for (const e of filters.employees)
    chips.push({ kind: "employees", label: `Employee: ${e}`, value: e });
  for (const c of filters.categories)
    chips.push({ kind: "categories", label: `Category: ${c}`, value: c });
  for (const c of filters.codes)
    chips.push({ kind: "codes", label: `Code: ${c}`, value: c });
  if (filters.dateFrom)
    chips.push({ kind: "dateFrom", label: `From: ${filters.dateFrom}`, value: filters.dateFrom });
  if (filters.dateTo)
    chips.push({ kind: "dateTo", label: `To: ${filters.dateTo}`, value: filters.dateTo });
  if (filters.search.trim())
    chips.push({ kind: "search", label: `Search: ${filters.search.trim()}`, value: filters.search });
  return chips;
}

/** Returns a new FilterState with one chip removed. */
export function removeChip(filters: FilterState, chip: FilterChip): FilterState {
  const next: FilterState = { ...filters };
  switch (chip.kind) {
    case "periods":
    case "teams":
    case "employees":
    case "categories":
    case "codes":
      next[chip.kind] = filters[chip.kind].filter((v) => v !== chip.value);
      break;
    case "dateFrom":
      next.dateFrom = null;
      break;
    case "dateTo":
      next.dateTo = null;
      break;
    case "search":
      next.search = "";
      break;
  }
  return next;
}

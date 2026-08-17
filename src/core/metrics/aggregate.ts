import type { ClassifiedRow } from "../types";
import { billableHours, sumHours } from "./engine";

/**
 * Aggregation helpers feeding charts and analysis tables. Charts consume
 * these pre-aggregated datasets — they never scan raw rows themselves.
 */

export interface HoursBucket {
  key: string;
  hours: number;
  rows: number;
}

export function groupHours(
  rows: ClassifiedRow[],
  keyFn: (row: ClassifiedRow) => string | null,
): HoursBucket[] {
  const map = new Map<string, HoursBucket>();
  for (const row of rows) {
    const key = keyFn(row);
    if (key === null) continue;
    const bucket = map.get(key);
    if (bucket) {
      bucket.hours += row.hours;
      bucket.rows += 1;
    } else {
      map.set(key, { key, hours: row.hours, rows: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

export function hoursByCategory(rows: ClassifiedRow[]): HoursBucket[] {
  return groupHours(rows, (r) => r.developmentCategory);
}

export function hoursByTeam(rows: ClassifiedRow[]): HoursBucket[] {
  return groupHours(rows, (r) => r.team);
}

export function hoursByMonth(rows: ClassifiedRow[]): HoursBucket[] {
  return groupHours(rows, (r) => r.month).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/** Per-code aggregation for the code analysis table and top-N charts. */
export interface CodeSummary {
  code: string;
  description: string;
  category: string;
  hours: number;
  rows: number;
  employees: number;
  shareOfDevelopment: number;
}

export function summarizeCodes(rows: ClassifiedRow[]): CodeSummary[] {
  const devRows = rows.filter((r) => r.isDevelopment && r.developmentCode);
  const devTotal = sumHours(devRows);
  const map = new Map<
    string,
    { hours: number; rows: number; employees: Set<string>; description: string; category: string }
  >();
  for (const row of devRows) {
    const code = row.developmentCode!;
    let entry = map.get(code);
    if (!entry) {
      entry = {
        hours: 0,
        rows: 0,
        employees: new Set(),
        description: row.developmentDescription ?? "Unknown code",
        category: row.developmentCategory ?? "Unknown",
      };
      map.set(code, entry);
    }
    entry.hours += row.hours;
    entry.rows += 1;
    entry.employees.add(row.employee);
  }
  return [...map.entries()]
    .map(([code, e]) => ({
      code,
      description: e.description,
      category: e.category,
      hours: e.hours,
      rows: e.rows,
      employees: e.employees.size,
      shareOfDevelopment: devTotal === 0 ? 0 : (e.hours / devTotal) * 100,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/** Monthly trend point with the executive ratio KPIs precomputed. */
export interface MonthTrendPoint {
  month: string;
  totalHours: number;
  billableHours: number;
  billablePercentage: number;
  productiveHours: number;
  productivePercentage: number;
  ipHours: number;
  acceleratorHours: number;
}

export function monthlyTrend(rows: ClassifiedRow[]): MonthTrendPoint[] {
  const months = new Map<string, ClassifiedRow[]>();
  for (const row of rows) {
    const list = months.get(row.month);
    if (list) list.push(row);
    else months.set(row.month, [row]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const total = sumHours(list);
      const billable = billableHours(list);
      const productive = sumHours(list.filter((r) => r.isProductive));
      return {
        month,
        totalHours: total,
        billableHours: billable,
        billablePercentage: total === 0 ? 0 : (billable / total) * 100,
        productiveHours: productive,
        productivePercentage: total === 0 ? 0 : (productive / total) * 100,
        ipHours: sumHours(list.filter((r) => r.developmentCategory === "IP")),
        acceleratorHours: sumHours(
          list.filter((r) => r.developmentCategory === "Accelerator"),
        ),
      };
    });
}

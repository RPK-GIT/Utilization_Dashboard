import type { KpiFormat } from "./types";

/** Shared number/date formatting used by cards, charts, tables and snapshots. */

export function formatHours(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatKpi(value: number, format: KpiFormat): string {
  switch (format) {
    case "percent":
      return formatPercent(value);
    case "count":
      return formatCount(value);
    default:
      return formatHours(value);
  }
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-07" -> "July 2026". */
export function periodLabel(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return period;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : period;
}

/** ISO date -> "17 Aug 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]?.slice(0, 3) ?? m[2]} ${m[1]}`;
}

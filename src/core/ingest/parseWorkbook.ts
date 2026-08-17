import * as XLSX from "xlsx";
import type { SourceRow } from "../types";
import {
  extractHeaders,
  type HeaderInfo,
  type MappableField,
} from "./columnMapping";

/**
 * Excel parsing and row normalization. Parsing is browser-side (ArrayBuffer)
 * so no backend is required.
 */

export interface ParsedSheet {
  sheetName: string;
  headers: HeaderInfo[];
  /** Raw data rows (array-of-arrays, header row removed). */
  rows: unknown[][];
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: ParsedSheet[];
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;
    const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: null,
    });
    if (matrix.length === 0) continue;
    const headers = extractHeaders(matrix[0] ?? []);
    if (headers.length === 0) continue;
    sheets.push({ sheetName, headers, rows: matrix.slice(1) });
  }
  return { fileName, sheets };
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    // Excel serial date fallback when cellDates is not honored.
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return isFinite(value) ? value : null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return isFinite(n) ? n : null;
}

export interface NormalizedResult {
  rows: SourceRow[];
  /** Rows dropped because they were entirely empty. */
  emptyRows: number;
  /** Row indexes (1-based, incl. header offset) with unparseable hours. */
  invalidHourRows: number[];
}

/**
 * Applies the confirmed column mapping and normalizes values:
 * strings trimmed, hours coerced to numbers, dates to ISO.
 * Rows with missing/invalid critical values are preserved (hours default 0)
 * so the validation report and Data Quality page can surface them.
 */
export function normalizeRows(
  sheet: ParsedSheet,
  mapping: Partial<Record<MappableField, HeaderInfo>>,
): NormalizedResult {
  const rows: SourceRow[] = [];
  const invalidHourRows: number[] = [];
  let emptyRows = 0;

  const idx = (field: MappableField) => mapping[field]?.index ?? -1;
  const iWbs = idx("wbs");
  const iEmployee = idx("employee");
  const iHours = idx("hours");
  const iShort = idx("shortText");
  const iDate = idx("date");

  sheet.rows.forEach((raw, i) => {
    if (!raw || raw.every((v) => v == null || String(v).trim() === "")) {
      emptyRows += 1;
      return;
    }
    const rowIndex = i + 2; // 1-based plus header row
    const hoursValue = iHours >= 0 ? toNumber(raw[iHours]) : null;
    if (hoursValue === null && raw[iHours] != null && raw[iHours] !== "") {
      invalidHourRows.push(rowIndex);
    }
    rows.push({
      rowIndex,
      wbs: iWbs >= 0 && raw[iWbs] != null ? String(raw[iWbs]).trim() : "",
      employee:
        iEmployee >= 0 && raw[iEmployee] != null ? String(raw[iEmployee]).trim() : "",
      hours: hoursValue ?? 0,
      shortText: iShort >= 0 && raw[iShort] != null ? String(raw[iShort]).trim() : "",
      date: iDate >= 0 ? toIsoDate(raw[iDate]) : null,
    });
  });

  return { rows, emptyRows, invalidHourRows };
}

/** Detects the dominant reporting period (yyyy-mm) from row dates. */
export function detectPeriod(rows: SourceRow[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.date) continue;
    const month = row.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [month, count] of counts) {
    if (count > bestCount) {
      best = month;
      bestCount = count;
    }
  }
  return best;
}

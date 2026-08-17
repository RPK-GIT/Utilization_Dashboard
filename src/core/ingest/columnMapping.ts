import type { ColumnMapping } from "../types";

/**
 * Header-based column detection. Columns are identified by header name first
 * (robust against reordered exports); the administrator can override the
 * mapping during import and the result is persisted in configuration.
 */

export interface HeaderInfo {
  /** Header cell text. */
  name: string;
  /** 0-based column index in the sheet. */
  index: number;
  /** Excel column letter, e.g. "B". */
  letter: string;
}

export const REQUIRED_FIELDS = ["wbs", "employee", "hours", "shortText"] as const;
export type MappableField = (typeof REQUIRED_FIELDS)[number] | "date";

export const FIELD_LABELS: Record<MappableField, string> = {
  wbs: "WBS Element",
  employee: "Employee / Resource",
  hours: "Hours",
  shortText: "Short Description",
  date: "Date",
};

/** Synonym patterns tried in order when auto-detecting a field's header. */
const FIELD_PATTERNS: Record<MappableField, RegExp[]> = {
  wbs: [/^wbs/i, /wbs/i],
  employee: [/name of employee/i, /employee/i, /resource/i, /applicant/i],
  hours: [/^hours?$/i, /number\s*\(unit\)/i, /^number\b/i, /quantity/i, /^qty/i],
  shortText: [/short\s*text/i, /short\s*desc/i, /description/i],
  date: [/^date$/i, /\bdate\b/i, /posting/i],
};

export function columnLetter(index: number): string {
  let letter = "";
  let n = index;
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

export function extractHeaders(headerRow: unknown[]): HeaderInfo[] {
  return headerRow
    .map((cell, index) => ({
      name: cell == null ? "" : String(cell).trim(),
      index,
      letter: columnLetter(index),
    }))
    .filter((h) => h.name !== "");
}

/**
 * Detects the column for each field: exact match against a persisted mapping
 * first, then synonym patterns.
 */
export function detectMapping(
  headers: HeaderInfo[],
  persisted: ColumnMapping | null,
): Partial<Record<MappableField, HeaderInfo>> {
  const result: Partial<Record<MappableField, HeaderInfo>> = {};
  const byName = new Map(headers.map((h) => [h.name.toUpperCase(), h]));

  const fields: MappableField[] = [...REQUIRED_FIELDS, "date"];
  const taken = new Set<number>();

  // Pass 1: persisted header names.
  if (persisted) {
    for (const field of fields) {
      const wanted = field === "date" ? persisted.date : persisted[field];
      if (!wanted) continue;
      const hit = byName.get(wanted.toUpperCase());
      if (hit && !taken.has(hit.index)) {
        result[field] = hit;
        taken.add(hit.index);
      }
    }
  }

  // Pass 2: synonym patterns for anything unresolved.
  for (const field of fields) {
    if (result[field]) continue;
    for (const pattern of FIELD_PATTERNS[field]) {
      const hit = headers.find((h) => !taken.has(h.index) && pattern.test(h.name));
      if (hit) {
        result[field] = hit;
        taken.add(hit.index);
        break;
      }
    }
  }

  return result;
}

export interface MappingValidation {
  ok: boolean;
  missing: MappableField[];
}

export function validateMapping(
  mapping: Partial<Record<MappableField, HeaderInfo>>,
): MappingValidation {
  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  return { ok: missing.length === 0, missing };
}

/** Converts a resolved mapping to the persistable header-name form. */
export function toPersistedMapping(
  mapping: Partial<Record<MappableField, HeaderInfo>>,
): ColumnMapping | null {
  if (!validateMapping(mapping).ok) return null;
  return {
    wbs: mapping.wbs!.name,
    employee: mapping.employee!.name,
    hours: mapping.hours!.name,
    shortText: mapping.shortText!.name,
    date: mapping.date?.name ?? null,
  };
}

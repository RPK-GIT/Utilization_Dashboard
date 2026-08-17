import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook, normalizeRows, detectPeriod } from "@/core/ingest/parseWorkbook";
import { detectMapping, toPersistedMapping, validateMapping } from "@/core/ingest/columnMapping";
import { buildValidationReport } from "@/core/ingest/validation";
import { classifyRows } from "@/core/classify/engine";
import { testConfig } from "./fixtures/rows";

/** Builds an xlsx ArrayBuffer mirroring the real export layout (columns A–L). */
function sampleWorkbook(rows: unknown[][]): ArrayBuffer {
  const header = [
    "Exception", "WBS Element", "Name", "Date", "Name of Employee or Applicant",
    "Number (unit)", "Int. meas. unit", "Short Text", "Activity Type",
    "AE Personnel Number", "Processing status", "Stat. key figure",
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

const DATA_ROWS: unknown[][] = [
  ["", "0004A20078-011.02-005", "PRJ", new Date(2026, 6, 7), "Casey Sample", 4, "H", "9004333638 - Mapping", "AFIC", "1", "30", ""],
  ["", "0004I00021-002.01-001", "PRJ", new Date(2026, 6, 8), "Casey Sample", 6.5, "H", "DTEC development", "AFIC", "1", "30", ""],
  ["", "0004I00021-002.01-002", "PRJ", new Date(2026, 6, 9), "Riley Sample", 2, "H", "AIUG session", "AFIC", "2", "30", ""],
  ["", "0004A99999-008.02-900", "PRJ", new Date(2026, 6, 9), "Riley Sample", 3, "H", "Bench", "AFIC", "2", "30", ""],
  // duplicate of row 3
  ["", "0004I00021-002.01-002", "PRJ", new Date(2026, 6, 9), "Riley Sample", 2, "H", "AIUG session", "AFIC", "2", "30", ""],
];

describe("workbook parsing and column mapping", () => {
  it("parses sheets and detects headers with column letters", () => {
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    expect(parsed.sheets).toHaveLength(1);
    const sheet = parsed.sheets[0];
    expect(sheet.sheetName).toBe("Sheet1");
    const wbsHeader = sheet.headers.find((h) => h.name === "WBS Element")!;
    expect(wbsHeader.letter).toBe("B");
  });

  it("auto-detects the business fields from header names", () => {
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    const mapping = detectMapping(parsed.sheets[0].headers, null);
    expect(mapping.wbs?.letter).toBe("B");
    expect(mapping.employee?.letter).toBe("E");
    expect(mapping.hours?.letter).toBe("F");
    expect(mapping.shortText?.letter).toBe("H");
    expect(mapping.date?.letter).toBe("D");
    expect(validateMapping(mapping).ok).toBe(true);
  });

  it("prefers a persisted mapping when headers match", () => {
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    const persisted = {
      wbs: "WBS Element",
      employee: "Name", // deliberately remap employee to column C
      hours: "Number (unit)",
      shortText: "Short Text",
      date: "Date",
    };
    const mapping = detectMapping(parsed.sheets[0].headers, persisted);
    expect(mapping.employee?.letter).toBe("C");
  });

  it("reports missing required columns", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Foo", "Bar"], ["a", "b"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Odd");
    const parsed = parseWorkbook(
      XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
      "odd.xlsx",
    );
    const mapping = detectMapping(parsed.sheets[0].headers, null);
    const validation = validateMapping(mapping);
    expect(validation.ok).toBe(false);
    expect(validation.missing).toContain("wbs");
    expect(validation.missing).toContain("hours");
  });

  it("round-trips a mapping to its persistable form", () => {
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    const mapping = detectMapping(parsed.sheets[0].headers, null);
    expect(toPersistedMapping(mapping)).toEqual({
      wbs: "WBS Element",
      employee: "Name of Employee or Applicant",
      hours: "Number (unit)",
      shortText: "Short Text",
      date: "Date",
    });
  });
});

describe("normalization and period detection", () => {
  it("normalizes rows with trimmed strings, numeric hours and ISO dates", () => {
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    const mapping = detectMapping(parsed.sheets[0].headers, null);
    const { rows } = normalizeRows(parsed.sheets[0], mapping);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      wbs: "0004A20078-011.02-005",
      employee: "Casey Sample",
      hours: 4,
      date: "2026-07-07",
    });
    expect(rows[1].hours).toBeCloseTo(6.5);
  });

  it("detects the dominant reporting period from dates", () => {
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    const mapping = detectMapping(parsed.sheets[0].headers, null);
    const { rows } = normalizeRows(parsed.sheets[0], mapping);
    expect(detectPeriod(rows)).toBe("2026-07");
  });
});

describe("validation report", () => {
  it("summarizes the dataset against the business rules", () => {
    const config = testConfig();
    const parsed = parseWorkbook(sampleWorkbook(DATA_ROWS), "test.xlsx");
    const mapping = detectMapping(parsed.sheets[0].headers, null);
    const { rows } = normalizeRows(parsed.sheets[0], mapping);
    const classified = classifyRows(rows, config, "2026-07");
    const report = buildValidationReport({
      fileName: "test.xlsx",
      sheetName: "Sheet1",
      sourceRows: rows,
      classifiedRows: classified,
      config,
    });
    expect(report.recordCount).toBe(5);
    expect(report.totalHours).toBeCloseTo(17.5);
    expect(report.employeeCount).toBe(2);
    expect(report.billableCandidateRows).toBe(1);
    expect(report.developmentCandidateRows).toBe(3);
    expect(report.unknownDevelopmentCodes).toEqual([
      { code: "AIUG", rows: 2, hours: 4 },
    ]);
    expect(report.duplicateRows).toBe(1);
    expect(report.dateRange).toEqual({ from: "2026-07-07", to: "2026-07-09" });
  });
});

/**
 * Generates a synthetic monthly export for E2E tests, mirroring the real
 * export's structure (12 columns A–L, same headers) with fictional employees.
 * The real customer/team export is never committed; this fixture is generated
 * on demand (e2e/fixtures/ is gitignored) via `npm run make:fixture`.
 *
 * Expected totals (asserted by e2e/dashboard.spec.ts):
 *   records 14, total hours 86.5, billable 24 (0004A 16 + 0004C 8),
 *   IP 22.5 (DTEC 14 + PCSI 6 + 2PC 2.5), Accelerator 6 (MSLM),
 *   productive 52.5, unknown-code hours 8 (AIUG), excluded 6, C9 4,
 *   learning 12, unclassified (0085I) 4, zero-hour row 1.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const HEADERS = [
  "Exception", "WBS Element", "Name", "Date", "Name of Employee or Applicant",
  "Number (unit)", "Int. meas. unit", "Short Text", "Activity Type",
  "AE Personnel Number", "Processing status", "Stat. key figure",
];

// Fictional team: Ivy/Iris are configured IP Delivery members in the test.
const ROWS = [
  ["", "0004A20001-011.02-005", "PRJ A", new Date(2026, 6, 6), "Ivy Ipdelivery", 8, "H", "9004000001 - Customer work", "AFIC", "1", "30", ""],
  ["", "0004A20001-011.02-005", "PRJ A", new Date(2026, 6, 7), "Ivy Ipdelivery", 8, "H", "9004000002 - Customer work", "AFIC", "1", "30", ""],
  ["", "0004C30001-001.01-001", "PRJ C", new Date(2026, 6, 8), "Devon Developer", 8, "H", "9004000003 - Support ticket", "AFIC", "2", "30", ""],
  ["", "0004A99999-008.02-900", "BENCH", new Date(2026, 6, 9), "Devon Developer", 6, "H", "Bench time", "AFIC", "2", "30", ""],
  ["", "0004C91111-001.01-001", "PRJ C9", new Date(2026, 6, 9), "Casey Coder", 4, "H", "Internal project", "AFIC", "3", "30", ""],
  ["", "0004I00021-002.01-001", "DEV", new Date(2026, 6, 10), "Ivy Ipdelivery", 6, "H", "DTEC development sprint", "AFIC", "1", "30", ""],
  ["", "0004I00021-002.01-001", "DEV", new Date(2026, 6, 13), "Iris Ipdelivery", 8, "H", "dtec bugfixes", "AFIC", "4", "30", ""],
  ["", "0004I00021-002.01-002", "DEV", new Date(2026, 6, 14), "Devon Developer", 6, "H", "PCSI cockpit build", "AFIC", "2", "30", ""],
  ["", "0004I00021-002.01-003", "DEV", new Date(2026, 6, 15), "Casey Coder", 2.5, "H", "2PC: partner copilot", "AFIC", "3", "30", ""],
  ["", "0004I00021-002.01-004", "DEV", new Date(2026, 6, 16), "Devon Developer", 6, "H", "MSLM shelf life", "AFIC", "2", "30", ""],
  ["", "0004I00021-002.01-005", "DEV", new Date(2026, 6, 17), "Casey Coder", 8, "H", "AIUG user group", "AFIC", "3", "30", ""],
  ["", "0004I00021-002.01-006", "DEV", new Date(2026, 6, 20), "Iris Ipdelivery", 12, "H", "LEAR learning block", "AFIC", "4", "30", ""],
  ["", "0085I00001-001.01-001", "XCHG", new Date(2026, 6, 21), "Devon Developer", 4, "H", "Cross charge", "AFIC", "2", "30", ""],
  ["", "0004A20001-011.02-005", "PRJ A", new Date(2026, 6, 22), "Casey Coder", 0, "H", "9004000004 - Zero entry", "AFIC", "3", "30", ""],
];

const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...ROWS]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const outDir = path.join(process.cwd(), "e2e", "fixtures");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "EXPORT_FIXTURE.xlsx");
XLSX.writeFile(wb, outFile);
console.log(`Fixture written: ${outFile}`);

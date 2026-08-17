import type {
  AppConfig,
  ClassifiedRow,
  SourceRow,
  ValidationReport,
} from "../types";

/**
 * Builds the validation report shown before an import is confirmed and kept
 * with the dataset afterwards. Uses classified rows so the report exercises
 * the same configuration-driven rules as the dashboard.
 */
export function buildValidationReport(args: {
  fileName: string;
  sheetName: string;
  sourceRows: SourceRow[];
  classifiedRows: ClassifiedRow[];
  config: AppConfig;
}): ValidationReport {
  const { fileName, sheetName, sourceRows, classifiedRows } = args;

  const dates = sourceRows
    .map((r) => r.date)
    .filter((d): d is string => d !== null)
    .sort();

  const employees = new Set(
    sourceRows.filter((r) => r.employee).map((r) => r.employee.toUpperCase()),
  );

  const unknown = new Map<string, { rows: number; hours: number }>();
  for (const row of classifiedRows) {
    if (row.isDevelopment && row.developmentCategory === "Unknown" && row.developmentCode) {
      const entry = unknown.get(row.developmentCode) ?? { rows: 0, hours: 0 };
      entry.rows += 1;
      entry.hours += row.hours;
      unknown.set(row.developmentCode, entry);
    }
  }

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of sourceRows) {
    const key = `${row.wbs}|${row.employee}|${row.hours}|${row.shortText}|${row.date}`;
    if (seen.has(key)) duplicateRows += 1;
    else seen.add(key);
  }

  return {
    fileName,
    sheetName,
    recordCount: sourceRows.length,
    dateRange:
      dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    employeeCount: employees.size,
    totalHours: sourceRows.reduce((acc, r) => acc + r.hours, 0),
    billableCandidateRows: classifiedRows.filter((r) => r.isBillable).length,
    developmentCandidateRows: classifiedRows.filter((r) => r.isDevelopment).length,
    unknownDevelopmentCodes: [...unknown.entries()]
      .map(([code, e]) => ({ code, rows: e.rows, hours: e.hours }))
      .sort((a, b) => b.hours - a.hours),
    missingWbs: sourceRows.filter((r) => !r.wbs).length,
    missingEmployee: sourceRows.filter((r) => !r.employee).length,
    missingHours: sourceRows.filter((r) => r.hours === 0).length,
    missingShortDescription: sourceRows.filter((r) => !r.shortText).length,
    zeroHourRows: sourceRows.filter((r) => r.hours === 0).length,
    duplicateRows,
    unclassifiedRows: classifiedRows.filter(
      (r) => r.classification === "Unclassified",
    ).length,
  };
}

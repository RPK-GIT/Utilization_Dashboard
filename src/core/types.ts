/**
 * Core domain types shared by the interactive app, the classification and
 * metric engines, tests and the executive snapshot viewer.
 */

/** A normalized source transaction after column mapping. */
export interface SourceRow {
  /** 1-based row number in the source sheet (for traceability). */
  rowIndex: number;
  wbs: string;
  employee: string;
  hours: number;
  shortText: string;
  /** ISO date (yyyy-mm-dd) or null when the source has no usable date. */
  date: string | null;
}

export type Classification =
  | "Billable"
  | "Development"
  | "Excluded"
  | "Not Billable"
  | "Unclassified";

/** A source row enriched by the configuration-driven classification engine. */
export interface ClassifiedRow extends SourceRow {
  team: string;
  classification: Classification;
  isBillable: boolean;
  isDevelopment: boolean;
  isProductive: boolean;
  developmentCode: string | null;
  developmentDescription: string | null;
  developmentCategory: string | null;
  classificationReason: string;
  /** Reporting month in yyyy-mm form. */
  month: string;
}

/* ------------------------------------------------------------------ */
/* Configuration model                                                 */
/* ------------------------------------------------------------------ */

export interface BillableRules {
  allowedPrefixes: string[];
  /** Characters that must NOT appear immediately after an allowed prefix. */
  nextCharacterMustNotBe: string[];
  /** WBS elements explicitly excluded from billability. */
  excludedWbs: string[];
}

export interface DevelopmentRules {
  allowedPrefixes: string[];
}

export interface CodeDefinition {
  code: string;
  description: string;
  category: string;
  active: boolean;
}

export interface CategoryDefinition {
  name: string;
  /** Categories flagged productive contribute to Productive Hours. */
  productive: boolean;
  active: boolean;
}

export interface TeamDefinition {
  id: string;
  name: string;
  members: string[];
  /** The catch-all team receives every employee not configured elsewhere. */
  catchAll: boolean;
  active: boolean;
}

export type KpiFormat = "hours" | "percent" | "count";

export interface KpiDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  format: KpiFormat;
  category: "primary" | "secondary";
  enabled: boolean;
}

export interface ColumnMapping {
  wbs: string;
  employee: string;
  hours: string;
  shortText: string;
  date: string | null;
}

export interface AppConfig {
  /** Semantic configuration version, e.g. "v1.0". Bumped on every save. */
  version: string;
  updatedAt: string;
  billableRules: BillableRules;
  developmentRules: DevelopmentRules;
  codes: CodeDefinition[];
  categories: CategoryDefinition[];
  teams: TeamDefinition[];
  kpis: KpiDefinition[];
  /** Persisted source column mapping (header names). */
  columnMapping: ColumnMapping | null;
}

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

export interface ValidationReport {
  fileName: string;
  sheetName: string;
  recordCount: number;
  dateRange: { from: string; to: string } | null;
  employeeCount: number;
  totalHours: number;
  billableCandidateRows: number;
  developmentCandidateRows: number;
  unknownDevelopmentCodes: { code: string; rows: number; hours: number }[];
  missingWbs: number;
  missingEmployee: number;
  missingHours: number;
  missingShortDescription: number;
  zeroHourRows: number;
  duplicateRows: number;
  unclassifiedRows: number;
}

export interface Dataset {
  id: string;
  /** Reporting period, yyyy-mm. */
  period: string;
  /** Human label, e.g. "July 2026". */
  periodLabel: string;
  fileName: string;
  sheetName: string;
  uploadedAt: string;
  processedAt: string;
  /** Version of the configuration the rows were classified with. */
  configVersion: string;
  /** Frozen copy of the configuration used, for reproducibility. */
  configSnapshot: AppConfig;
  rows: SourceRow[];
  classified: ClassifiedRow[];
  validation: ValidationReport;
  status: "Validated";
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export interface FilterState {
  periods: string[];
  teams: string[];
  employees: string[];
  categories: string[];
  codes: string[];
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
}

export const EMPTY_FILTERS: FilterState = {
  periods: [],
  teams: [],
  employees: [],
  categories: [],
  codes: [],
  dateFrom: null,
  dateTo: null,
  search: "",
};

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

/** Subset of configuration a snapshot needs to interpret its data. */
export interface SnapshotConfig {
  codes: CodeDefinition[];
  categories: CategoryDefinition[];
  teams: TeamDefinition[];
  kpis: KpiDefinition[];
}

export interface SnapshotPayload {
  title: string;
  subtitle: string;
  periodLabel: string;
  generatedAt: string;
  dataThrough: string;
  configVersion: string;
  scope: "current-view" | "full";
  rows: ClassifiedRow[];
  config: SnapshotConfig;
  initialFilters: FilterState;
  availablePeriods: { period: string; label: string }[];
  /** Visualization selections active at generation time (presentation only). */
  presentation?: Record<string, { metric: string; viz: string; dimension: string }>;
}

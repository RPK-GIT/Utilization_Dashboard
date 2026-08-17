import type {
  AppConfig,
  ClassifiedRow,
  Dataset,
  FilterState,
  SnapshotPayload,
} from "../types";
import { EMPTY_FILTERS } from "../types";
import { applyFilters } from "../filters/engine";
import { periodLabel } from "../format";

/**
 * Executive snapshot assembly. The payload embeds classified rows plus the
 * minimal configuration subset needed to interpret them — never the admin
 * surface. Rows are frozen at generation time: later changes to live data or
 * configuration cannot alter an existing snapshot.
 */

export const SNAPSHOT_PLACEHOLDER =
  '<script id="snapshot-data" type="application/json">null</script>';

export function buildSnapshotPayload(args: {
  datasets: Dataset[];
  config: AppConfig;
  filters: FilterState;
  scope: "current-view" | "full";
  generatedAt: string;
}): SnapshotPayload {
  const { datasets, config, filters, scope, generatedAt } = args;
  const allRows: ClassifiedRow[] = datasets.flatMap((d) => d.classified);
  const effectiveFilters = scope === "current-view" ? filters : { ...EMPTY_FILTERS };

  // "Full" keeps every row; "current view" bakes the filter state in as the
  // initial view while still shipping the rows needed to change filters later.
  const rows = allRows;

  const periods = [...new Set(datasets.map((d) => d.period))].sort();
  const labels = periods.map((p) => periodLabel(p));
  const scopedRows = applyFilters(rows, effectiveFilters);
  const dates = scopedRows
    .map((r) => r.date)
    .filter((d): d is string => d !== null)
    .sort();

  const configVersions = [...new Set(datasets.map((d) => d.configVersion))];

  return {
    title: "US Solutions Utilization Dashboard",
    subtitle: "Executive Snapshot",
    periodLabel: labels.join(", "),
    generatedAt,
    dataThrough: dates.length > 0 ? dates[dates.length - 1] : (periods[periods.length - 1] ?? ""),
    configVersion: configVersions.join(", "),
    scope,
    rows,
    config: {
      codes: config.codes,
      categories: config.categories,
      teams: config.teams,
      kpis: config.kpis,
    },
    initialFilters: effectiveFilters,
    availablePeriods: periods.map((p) => ({ period: p, label: periodLabel(p) })),
  };
}

/** Serializes the payload safely for embedding inside a <script> tag. */
export function serializePayload(payload: SnapshotPayload): string {
  return JSON.stringify(payload).replace(/<\//g, "<\\/");
}

/** Injects the payload into the prebuilt single-file viewer template. */
export function injectPayload(template: string, payload: SnapshotPayload): string {
  if (!template.includes(SNAPSHOT_PLACEHOLDER)) {
    throw new Error(
      "Snapshot template is missing the data placeholder. Rebuild it with `npm run build:snapshot`.",
    );
  }
  return template.replace(
    SNAPSHOT_PLACEHOLDER,
    `<script id="snapshot-data" type="application/json">${serializePayload(payload)}</script>`,
  );
}

export function snapshotFileName(payload: SnapshotPayload): string {
  const period = payload.periodLabel.replace(/[^A-Za-z0-9]+/g, "_") || "AllPeriods";
  return `Utilization_Executive_Snapshot_${period}.html`;
}

import type { ClassifiedRow, SnapshotConfig } from "../types";
import { activityLabel, periodLabel } from "../format";
import { sumHours } from "./engine";

/**
 * Metric-explorer registry: which visualizations and breakdown dimensions
 * make sense for each metric. This sits above the charting library — the UI
 * resolves a (metric, dimension) pair to plain buckets here and only then
 * renders them with whatever chart type the user selected. The underlying
 * data and business calculations never change with the visualization; only
 * the presentation does.
 */

export type VisualizationType =
  | "kpi"
  | "donut"
  | "pie"
  | "horizontalBar"
  | "verticalBar"
  | "line"
  | "table";

export type DimensionId =
  | "activity"
  | "employee"
  | "team"
  | "category"
  | "month"
  | "billableSplit"
  | "productiveComposition";

/** Presentation preference for one analysis block (session-scoped). */
export interface VizSelection {
  metric: string;
  viz: VisualizationType;
  dimension: DimensionId;
}

export const VIZ_LABELS: Record<VisualizationType, string> = {
  kpi: "KPI",
  donut: "Donut",
  pie: "Pie",
  horizontalBar: "Horizontal Bar",
  verticalBar: "Vertical Bar",
  line: "Line",
  table: "Table",
};

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  activity: "Activity",
  employee: "Employee",
  team: "Team",
  category: "Category",
  month: "Month",
  billableSplit: "Billable vs Non-Billable",
  productiveComposition: "Productive composition",
};

export interface ExplorerMetricDef {
  id: string;
  name: string;
  /** Row subset the metric sums over (evaluated on the filtered scope). */
  predicate: (row: ClassifiedRow, productiveCategories: Set<string>) => boolean;
  dimensions: DimensionId[];
  defaultDimension: DimensionId;
  /** Context-aware: single-value metrics never offer pie/donut, etc. */
  visualizations: VisualizationType[];
  defaultVisualization: VisualizationType;
}

const notProductiveOther = (
  row: ClassifiedRow,
  productive: Set<string>,
): boolean =>
  !row.isBillable &&
  (!row.developmentCategory || !productive.has(row.developmentCategory));

/**
 * The metric registry. Adding a metric here automatically gives it the full
 * explorer UI — no component changes required.
 */
export const EXPLORER_METRICS: ExplorerMetricDef[] = [
  {
    id: "total_hours",
    name: "Total Hours",
    predicate: () => true,
    dimensions: ["team", "employee", "category", "month"],
    defaultDimension: "team",
    // No pie/donut: Total Hours has no inherent part-to-whole segmentation
    // (the Hours Composition block covers that story).
    visualizations: ["kpi", "horizontalBar", "verticalBar", "line", "table"],
    defaultVisualization: "horizontalBar",
  },
  {
    id: "billable_hours",
    name: "Billable Hours",
    predicate: (r) => r.isBillable,
    dimensions: ["employee", "team", "month", "billableSplit"],
    defaultDimension: "employee",
    visualizations: ["kpi", "donut", "pie", "horizontalBar", "verticalBar", "line", "table"],
    defaultVisualization: "horizontalBar",
  },
  {
    id: "ip_hours",
    name: "IP Hours",
    predicate: (r) => r.developmentCategory === "IP",
    dimensions: ["activity", "employee", "team", "month"],
    defaultDimension: "activity",
    visualizations: ["kpi", "donut", "pie", "horizontalBar", "verticalBar", "line", "table"],
    defaultVisualization: "horizontalBar",
  },
  {
    id: "accelerator_hours",
    name: "Accelerator Hours",
    predicate: (r) => r.developmentCategory === "Accelerator",
    dimensions: ["activity", "employee", "team", "month"],
    defaultDimension: "activity",
    visualizations: ["kpi", "donut", "pie", "horizontalBar", "verticalBar", "line", "table"],
    defaultVisualization: "horizontalBar",
  },
  {
    id: "productive_hours",
    name: "Productive Hours",
    predicate: (r) => r.isProductive,
    dimensions: ["productiveComposition", "employee", "team", "month"],
    defaultDimension: "productiveComposition",
    visualizations: ["kpi", "donut", "pie", "horizontalBar", "verticalBar", "line", "table"],
    defaultVisualization: "donut",
  },
  {
    id: "other_hours",
    name: "Other Hours",
    predicate: notProductiveOther,
    dimensions: ["category", "employee", "month"],
    defaultDimension: "category",
    visualizations: ["kpi", "donut", "pie", "horizontalBar", "verticalBar", "line", "table"],
    defaultVisualization: "horizontalBar",
  },
];

export function explorerMetric(id: string): ExplorerMetricDef {
  return EXPLORER_METRICS.find((m) => m.id === id) ?? EXPLORER_METRICS[0];
}

/**
 * Visualizations valid for a metric + dimension pair. A line chart needs an
 * ordered axis, so it is only offered for the Month dimension; part-to-whole
 * charts are only offered where the metric supports them.
 */
export function allowedVisualizations(
  def: ExplorerMetricDef,
  dimension: DimensionId,
): VisualizationType[] {
  return def.visualizations.filter((v) => (v === "line" ? dimension === "month" : true));
}

export interface ExplorerBucket {
  key: string;
  label: string;
  hours: number;
  /** Share of the metric total (0–100). */
  share: number;
  /** Secondary tooltip line (e.g. "DTEC · IP"). */
  detail?: string;
  /** Drilldown target, when a meaningful one exists. */
  nav?: { kind: "employee" | "code" | "category" | "team" | "month" | "classification"; value: string };
}

export interface ExplorerResult {
  metric: ExplorerMetricDef;
  /** Sum of the metric over the filtered scope. */
  metricHours: number;
  /** Sum of ALL hours in the filtered scope (for "% of Total"). */
  scopeHours: number;
  buckets: ExplorerBucket[];
}

/**
 * Resolves (filtered rows, metric, dimension) to plain buckets. Special
 * dimensions build meaningful compositions: billableSplit contrasts Billable
 * with Non-Billable (= Total − Billable); productiveComposition splits
 * productive hours into Billable + each productive category.
 */
export function computeExplorer(
  rows: ClassifiedRow[],
  metricId: string,
  dimension: DimensionId,
  config: Pick<SnapshotConfig, "codes" | "categories">,
): ExplorerResult {
  const def = explorerMetric(metricId);
  const productive = new Set(
    config.categories.filter((c) => c.active && c.productive).map((c) => c.name),
  );
  const scopeHours = sumHours(rows);
  const metricRows = rows.filter((r) => def.predicate(r, productive));
  const metricHours = sumHours(metricRows);
  const share = (hours: number) => (metricHours === 0 ? 0 : (hours / metricHours) * 100);

  const configCategories = new Set(config.categories.map((c) => c.name));
  const describe = (code: string) =>
    config.codes.find((c) => c.code.toUpperCase() === code.toUpperCase())?.description;

  let buckets: ExplorerBucket[] = [];

  if (dimension === "billableSplit") {
    const billable = sumHours(rows.filter((r) => r.isBillable));
    const shareOfScope = (h: number) => (scopeHours === 0 ? 0 : (h / scopeHours) * 100);
    buckets = [
      {
        key: "Billable",
        label: "Billable",
        hours: billable,
        share: shareOfScope(billable),
        nav: { kind: "classification", value: "Billable" },
      },
      {
        key: "Non-Billable",
        label: "Non-Billable",
        hours: scopeHours - billable,
        share: shareOfScope(scopeHours - billable),
        detail: "Total Hours − Billable Hours",
      },
    ];
  } else if (dimension === "productiveComposition") {
    const billable = sumHours(metricRows.filter((r) => r.isBillable));
    buckets = [
      {
        key: "Billable",
        label: "Billable",
        hours: billable,
        share: share(billable),
        nav: { kind: "classification" as const, value: "Billable" },
      },
      ...[...productive].map((name) => {
        const hours = sumHours(metricRows.filter((r) => r.developmentCategory === name));
        return {
          key: name,
          label: name,
          hours,
          share: share(hours),
          nav: { kind: "category" as const, value: name },
        };
      }),
    ].filter((b) => b.hours > 0 || b.key === "Billable");
  } else {
    const groups = new Map<string, number>();
    for (const row of metricRows) {
      let key: string;
      switch (dimension) {
        case "employee":
          key = row.employee;
          break;
        case "team":
          key = row.team;
          break;
        case "month":
          key = row.month;
          break;
        case "category":
          key = row.developmentCategory ?? row.classification;
          break;
        case "activity":
          key = row.developmentCode ?? "—";
          break;
        default:
          key = "—";
      }
      groups.set(key, (groups.get(key) ?? 0) + row.hours);
    }
    buckets = [...groups.entries()].map(([key, hours]) => {
      switch (dimension) {
        case "activity": {
          const description = describe(key);
          return {
            key,
            label: description ?? `Unknown code (${key})`,
            hours,
            share: share(hours),
            detail: activityLabel(description, key),
            nav: { kind: "code" as const, value: key },
          };
        }
        case "month":
          return {
            key,
            label: periodLabel(key),
            hours,
            share: share(hours),
            nav: { kind: "month" as const, value: key },
          };
        case "category":
          return {
            key,
            label: key,
            hours,
            share: share(hours),
            nav: configCategories.has(key)
              ? { kind: "category" as const, value: key }
              : { kind: "classification" as const, value: key },
          };
        case "team":
          return {
            key,
            label: key,
            hours,
            share: share(hours),
            nav: { kind: "team" as const, value: key },
          };
        default:
          return {
            key,
            label: key,
            hours,
            share: share(hours),
            nav: { kind: "employee" as const, value: key },
          };
      }
    });
    buckets.sort((a, b) =>
      dimension === "month" ? a.key.localeCompare(b.key) : b.hours - a.hours,
    );
  }

  return { metric: def, metricHours, scopeHours, buckets };
}

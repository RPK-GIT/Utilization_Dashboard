import type { AppConfig, ClassifiedRow, KpiDefinition, KpiFormat } from "../types";

/**
 * Centralized metric engine. Every KPI shown anywhere in the application —
 * dashboard cards, drilldowns, snapshots, validation summaries — is computed
 * here from classified rows. Percentages are always ratios of summed hours,
 * never averages of individual percentages.
 */

export interface KpiValue {
  id: string;
  name: string;
  description: string;
  format: KpiFormat;
  category: "primary" | "secondary";
  value: number;
}

type KpiComputation = (ctx: MetricContext) => number;

interface MetricContext {
  rows: ClassifiedRow[];
  config: Pick<AppConfig, "categories" | "teams">;
}

export function sumHours(rows: ClassifiedRow[]): number {
  return rows.reduce((acc, r) => acc + r.hours, 0);
}

function hoursInCategory(rows: ClassifiedRow[], category: string): number {
  return sumHours(rows.filter((r) => r.developmentCategory === category));
}

function teamNameById(ctx: MetricContext, id: string): string | null {
  return ctx.config.teams.find((t) => t.id === id)?.name ?? null;
}

function hoursForTeamId(ctx: MetricContext, id: string): number {
  const name = teamNameById(ctx, id);
  if (!name) return 0;
  return sumHours(ctx.rows.filter((r) => r.team === name));
}

export function billableHours(rows: ClassifiedRow[]): number {
  return sumHours(rows.filter((r) => r.isBillable));
}

export function productiveHours(ctx: MetricContext): number {
  // isProductive is derived once by the classification engine (billable rows
  // plus development rows in productive categories) so no row double-counts.
  return sumHours(ctx.rows.filter((r) => r.isProductive));
}

function percent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

/**
 * Formula registry keyed by KPI id. Metadata (name, description, enabled)
 * lives in configuration; formulas live here, centrally.
 */
const KPI_FORMULAS: Record<string, KpiComputation> = {
  total_hours: (ctx) => sumHours(ctx.rows),
  billable_hours: (ctx) => billableHours(ctx.rows),
  billable_percentage: (ctx) => percent(billableHours(ctx.rows), sumHours(ctx.rows)),
  ip_hours: (ctx) => hoursInCategory(ctx.rows, "IP"),
  accelerator_hours: (ctx) => hoursInCategory(ctx.rows, "Accelerator"),
  productive_hours: (ctx) => productiveHours(ctx),
  productive_percentage: (ctx) => percent(productiveHours(ctx), sumHours(ctx.rows)),
  ip_delivery_hours: (ctx) => hoursForTeamId(ctx, "ip-delivery"),
  development_team_hours: (ctx) => hoursForTeamId(ctx, "development"),
  development_hours: (ctx) => sumHours(ctx.rows.filter((r) => r.isDevelopment)),
};

/** Computes all enabled KPIs for the rows in scope. */
export function computeKpis(
  rows: ClassifiedRow[],
  config: Pick<AppConfig, "categories" | "teams" | "kpis">,
): KpiValue[] {
  const ctx: MetricContext = { rows, config };
  return config.kpis
    .filter((k) => k.enabled)
    .map((k: KpiDefinition) => ({
      id: k.id,
      name: k.name,
      description: k.description,
      format: k.format,
      category: k.category,
      value: KPI_FORMULAS[k.id]?.(ctx) ?? 0,
    }));
}

export function kpiValue(kpis: KpiValue[], id: string): number {
  return kpis.find((k) => k.id === id)?.value ?? 0;
}

/** Per-employee utilization summary used by the team page and drilldowns. */
export interface EmployeeSummary {
  employee: string;
  team: string;
  totalHours: number;
  billableHours: number;
  billablePercentage: number;
  ipHours: number;
  acceleratorHours: number;
  productiveHours: number;
  productivePercentage: number;
}

export function summarizeEmployees(rows: ClassifiedRow[]): EmployeeSummary[] {
  const byEmployee = new Map<string, ClassifiedRow[]>();
  for (const row of rows) {
    const list = byEmployee.get(row.employee);
    if (list) list.push(row);
    else byEmployee.set(row.employee, [row]);
  }
  return [...byEmployee.entries()]
    .map(([employee, list]) => {
      const total = sumHours(list);
      const billable = billableHours(list);
      const productive = sumHours(list.filter((r) => r.isProductive));
      return {
        employee,
        team: list[0].team,
        totalHours: total,
        billableHours: billable,
        billablePercentage: percent(billable, total),
        ipHours: hoursInCategory(list, "IP"),
        acceleratorHours: hoursInCategory(list, "Accelerator"),
        productiveHours: productive,
        productivePercentage: percent(productive, total),
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);
}

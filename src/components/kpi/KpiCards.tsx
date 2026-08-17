"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card } from "../ui/primitives";
import { computeKpis } from "@/core/metrics/engine";
import { formatKpi } from "@/core/format";
import { hasActiveFilters } from "@/core/filters/engine";
import { goDetail, goSection } from "../navigation";

/**
 * KPI stat tiles. Values come exclusively from the central metric engine
 * applied to the filtered scope. KPIs that represent a meaningful subset of
 * source data navigate to the corresponding detail on click.
 */

const KPI_NAVIGATION: Record<string, () => void> = {
  total_hours: () => goSection("detail"),
  billable_hours: () => goDetail("classification", "Billable"),
  productive_hours: () => goDetail("classification", "Productive"),
  development_hours: () => goDetail("classification", "Development"),
  ip_hours: () => goDetail("category", "IP"),
  accelerator_hours: () => goDetail("category", "Accelerator"),
};

export function KpiCards({ ids }: { ids?: string[] }) {
  const { filtered, config, filters } = useDashboard();
  const kpis = React.useMemo(() => computeKpis(filtered, config), [filtered, config]);
  const shown = ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  const filteredScope = hasActiveFilters(filters);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {shown.map((kpi) => {
        const navigate = KPI_NAVIGATION[kpi.id];
        const body = (
          <>
            <p className="truncate text-xs text-ink-2" title={kpi.description}>
              {kpi.name}
              {filteredScope ? <span className="text-accent-deep"> ·</span> : null}
            </p>
            <p
              className="mt-1 text-2xl font-semibold text-ink"
              data-testid={`kpi-${kpi.id}`}
            >
              {formatKpi(kpi.value, kpi.format)}
            </p>
          </>
        );
        return navigate ? (
          <Card key={kpi.id} className="p-0" data-kpi={kpi.id}>
            <button
              type="button"
              onClick={navigate}
              data-testid={`kpi-card-${kpi.id}`}
              title={`${kpi.description} — click for detail`}
              className="w-full rounded-lg px-4 py-3 text-left cursor-pointer transition-colors hover:bg-page focus:outline-2 focus:outline-accent/50"
            >
              {body}
            </button>
          </Card>
        ) : (
          <Card key={kpi.id} className="px-4 py-3" data-kpi={kpi.id}>
            {body}
          </Card>
        );
      })}
    </div>
  );
}

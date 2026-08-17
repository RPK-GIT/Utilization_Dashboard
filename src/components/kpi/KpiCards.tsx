"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card } from "../ui/primitives";
import { computeKpis } from "@/core/metrics/engine";
import { formatKpi } from "@/core/format";
import { hasActiveFilters } from "@/core/filters/engine";

/**
 * KPI stat tiles. Values come exclusively from the central metric engine
 * applied to the filtered scope.
 */
export function KpiCards({ ids }: { ids?: string[] }) {
  const { filtered, config, filters } = useDashboard();
  const kpis = React.useMemo(() => computeKpis(filtered, config), [filtered, config]);
  const shown = ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  const filteredScope = hasActiveFilters(filters);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {shown.map((kpi) => (
        <Card key={kpi.id} className="px-4 py-3" data-kpi={kpi.id}>
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
        </Card>
      ))}
    </div>
  );
}

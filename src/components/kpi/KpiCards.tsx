"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card } from "../ui/primitives";
import { computeKpis } from "@/core/metrics/engine";
import { formatKpi } from "@/core/format";
import { hasActiveFilters } from "@/core/filters/engine";
import { goDetail } from "../navigation";
import type { SnapshotConfig } from "@/core/types";

/**
 * KPI stat tiles. Values come exclusively from the central metric engine
 * applied to the filtered scope. Every KPI that represents a subset of the
 * source data navigates to a routed detail page (with ← Back) on click —
 * ratio KPIs (percentages) stay non-clickable by design.
 */

function kpiNavigation(config: SnapshotConfig): Record<string, () => void> {
  const teamName = (id: string) => config.teams.find((t) => t.id === id)?.name;
  const nav: Record<string, () => void> = {
    total_hours: () => goDetail("classification", "Total"),
    billable_hours: () => goDetail("classification", "Billable"),
    productive_hours: () => goDetail("classification", "Productive"),
    development_hours: () => goDetail("classification", "Development"),
    ip_hours: () => goDetail("category", "IP"),
    accelerator_hours: () => goDetail("category", "Accelerator"),
  };
  const ipDelivery = teamName("ip-delivery");
  if (ipDelivery) nav.ip_delivery_hours = () => goDetail("team", ipDelivery);
  const development = teamName("development");
  if (development) nav.development_team_hours = () => goDetail("team", development);
  return nav;
}

export function KpiCards({ ids }: { ids?: string[] }) {
  const { filtered, config, filters } = useDashboard();
  const kpis = React.useMemo(() => computeKpis(filtered, config), [filtered, config]);
  const navigation = React.useMemo(() => kpiNavigation(config), [config]);
  const shown = ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  const filteredScope = hasActiveFilters(filters);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {shown.map((kpi) => {
        const navigate = navigation[kpi.id];
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

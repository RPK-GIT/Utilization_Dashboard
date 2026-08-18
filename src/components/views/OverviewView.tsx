"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { ENTITY_COLORS, SERIES } from "../charts/theme";
import { KpiCards } from "../kpi/KpiCards";
import { HoursComposition } from "../kpi/HoursComposition";
import { MetricExplorer } from "../kpi/MetricExplorer";
import { VizContainer } from "../viz/VizContainer";
import { TrendContainer } from "../viz/TrendContainer";
import { goDetail } from "../navigation";
import { summarizeEmployees } from "@/core/metrics/engine";
import { monthlyTrend, summarizeCodes, groupHours } from "@/core/metrics/aggregate";
import { periodLabel } from "@/core/format";

/**
 * Executive overview — answers the 30-second questions: hours, billability,
 * productivity, IP/Accelerator split, top items, member utilization. Every
 * chart renders through the global visualization framework: intelligent
 * executive defaults, with context-aware alternative views the user can
 * switch to. All data derives from the same filtered scope and engines —
 * visualization type is a presentation choice, never a business-logic one.
 */
export function OverviewView() {
  const { filtered, config } = useDashboard();

  const employees = React.useMemo(() => summarizeEmployees(filtered), [filtered]);
  const codes = React.useMemo(() => summarizeCodes(filtered), [filtered]);
  const trend = React.useMemo(() => monthlyTrend(filtered), [filtered]);

  const ipHours = codes.filter((c) => c.category === "IP").reduce((a, c) => a + c.hours, 0);
  const accHours = codes
    .filter((c) => c.category === "Accelerator")
    .reduce((a, c) => a + c.hours, 0);

  const topIps = codes.filter((c) => c.category === "IP").slice(0, 6);
  const topAccelerators = codes.filter((c) => c.category === "Accelerator").slice(0, 6);
  const nonProductiveCategories = React.useMemo(() => {
    const productive = new Set(
      config.categories.filter((c) => c.productive).map((c) => c.name),
    );
    return groupHours(filtered, (r) =>
      r.developmentCategory && !productive.has(r.developmentCategory)
        ? r.developmentCategory
        : null,
    ).slice(0, 8);
  }, [filtered, config.categories]);

  const teamBillability = React.useMemo(() => {
    const byTeam = new Map<string, { total: number; billable: number }>();
    for (const row of filtered) {
      const entry = byTeam.get(row.team) ?? { total: 0, billable: 0 };
      entry.total += row.hours;
      if (row.isBillable) entry.billable += row.hours;
      byTeam.set(row.team, entry);
    }
    return [...byTeam.entries()].map(([name, v]) => ({
      key: name,
      label: name,
      value: v.total === 0 ? 0 : (v.billable / v.total) * 100,
    }));
  }, [filtered]);

  const memberBillability = employees
    .slice(0, 12)
    .map((e) => ({ key: e.employee, label: e.employee, value: e.billablePercentage }))
    .sort((a, b) => b.value - a.value);

  const codeItems = (list: typeof codes) =>
    list.map((c) => ({
      key: c.code,
      label: c.description,
      value: c.hours,
      detail: `${c.code} · ${c.category}`,
    }));

  return (
    <div className="flex flex-col gap-4">
      <KpiCards
        ids={[
          "total_hours",
          "billable_hours",
          "billable_percentage",
          "productive_hours",
          "productive_percentage",
          "ip_hours",
          "accelerator_hours",
          "ip_delivery_hours",
        ]}
      />
      <HoursComposition />
      <MetricExplorer />
      <div className="grid gap-4 lg:grid-cols-3">
        <VizContainer
          blockId="overview-team-billability"
          title="Team billability"
          subtitle="Billable share of each team's hours — click for the team detail"
          items={teamBillability}
          kinds={["horizontalBar", "verticalBar", "table"]}
          defaultKind="horizontalBar"
          format="percent"
          onItemClick={(key) => goDetail("team", key)}
        />
        <VizContainer
          blockId="overview-ip-accel"
          title="IP vs Accelerator"
          subtitle="Development hours split — click for detail"
          items={[
            { key: "IP", label: "IP", value: ipHours },
            { key: "Accelerator", label: "Accelerator", value: accHours },
          ]}
          kinds={["donut", "pie", "horizontalBar", "verticalBar", "table"]}
          defaultKind="donut"
          colors={ENTITY_COLORS}
          onItemClick={(key) => goDetail("category", key)}
        />
        <VizContainer
          blockId="overview-nonproductive"
          title="Where non-productive time goes"
          subtitle="Largest non-productive categories — click for detail"
          items={nonProductiveCategories.map((b) => ({
            key: b.key,
            label: b.key,
            value: b.hours,
          }))}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          onItemClick={(key) => goDetail("category", key)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <VizContainer
          blockId="overview-top-ips"
          title="Top IPs"
          subtitle="By development hours — click to drill down"
          items={codeItems(topIps)}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          labelWidth={210}
          onItemClick={(key) => goDetail("code", key)}
        />
        <VizContainer
          blockId="overview-top-accelerators"
          title="Top accelerators"
          subtitle="By development hours — click to drill down"
          items={codeItems(topAccelerators)}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          labelWidth={210}
          color={SERIES[1]}
          onItemClick={(key) => goDetail("code", key)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <VizContainer
          blockId="overview-member-billability"
          title="Member billable utilization"
          subtitle="Individual billable % — click for the employee detail"
          items={memberBillability}
          kinds={["horizontalBar", "verticalBar", "table"]}
          defaultKind="horizontalBar"
          format="percent"
          onItemClick={(key) => goDetail("employee", key)}
        />
        <TrendContainer
          blockId="overview-monthly-trend"
          title="Monthly trend"
          subtitle="Billable % and Productive % by month — click a month for detail"
          points={trend.map((t) => ({ key: t.month, label: periodLabel(t.month) }))}
          series={[
            {
              name: "Billable %",
              values: trend.map((t) => t.billablePercentage),
              color: SERIES[0],
            },
            {
              name: "Productive %",
              values: trend.map((t) => t.productivePercentage),
              color: SERIES[2],
            },
          ]}
          format="percent"
          onPointClick={(key) => goDetail("month", key)}
          emptyMessage={`One reporting period in scope${trend[0] ? ` (${periodLabel(trend[0].month)})` : ""}. Trends appear automatically when more months are loaded.`}
        />
      </div>
    </div>
  );
}

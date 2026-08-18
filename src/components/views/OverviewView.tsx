"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { donut, horizontalBars, trendLines } from "../charts/builders";
import { SERIES } from "../charts/theme";
import { KpiCards } from "../kpi/KpiCards";
import { HoursComposition } from "../kpi/HoursComposition";
import { MetricExplorer } from "../kpi/MetricExplorer";
import { goDetail } from "../navigation";
import { summarizeEmployees } from "@/core/metrics/engine";
import { monthlyTrend, summarizeCodes, groupHours } from "@/core/metrics/aggregate";
import { periodLabel } from "@/core/format";

/**
 * Executive overview — answers the 30-second questions: hours, billability,
 * productivity, IP/Accelerator split, top items, member utilization. Every
 * meaningful chart navigates into the underlying detail. Activity labels are
 * description-first (codes appear in tooltips), derived from configuration.
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
      name,
      value: v.total === 0 ? 0 : (v.billable / v.total) * 100,
    }));
  }, [filtered]);

  const memberBillability = employees
    .slice(0, 12)
    .map((e) => ({ name: e.employee, value: e.billablePercentage }))
    .sort((a, b) => b.value - a.value);

  const codeBars = (list: typeof codes) =>
    list.map((c) => ({
      name: c.description,
      value: c.hours,
      detail: `${c.code} · ${c.category}`,
    }));

  const openCode = (list: typeof codes) => (p: { name?: string }) => {
    const match = list.find((c) => c.description === p.name);
    if (match) goDetail("code", match.code);
  };

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
        <Card>
          <CardHeader
            title="Team billability"
            subtitle="Billable share of each team's hours — click a bar for the team detail"
          />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(teamBillability, { format: "percent" })}
              height={Math.max(140, teamBillability.length * 44 + 60)}
              onClick={(p) => p.name && goDetail("team", p.name)}
              ariaLabel="Billable percentage by team"
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="IP vs Accelerator"
            subtitle="Development hours split — click a segment for detail"
          />
          <div className="px-3 pb-3">
            <EChart
              option={donut([
                { name: "IP", value: ipHours },
                { name: "Accelerator", value: accHours },
              ])}
              height={240}
              onClick={(p) => p.name && goDetail("category", p.name)}
              ariaLabel="IP versus Accelerator hours"
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Where non-productive time goes"
            subtitle="Largest non-productive categories — click a bar for detail"
          />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                nonProductiveCategories.map((b) => ({ name: b.key, value: b.hours })),
              )}
              height={Math.max(140, nonProductiveCategories.length * 30 + 60)}
              onClick={(p) => p.name && goDetail("category", p.name)}
              ariaLabel="Hours in non-productive categories"
            />
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top IPs" subtitle="By development hours — click a bar to drill down" />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(codeBars(topIps), { labelWidth: 210 })}
              height={Math.max(140, topIps.length * 32 + 60)}
              onClick={openCode(topIps)}
              ariaLabel="Top IPs by hours"
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Top accelerators"
            subtitle="By development hours — click a bar to drill down"
          />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(codeBars(topAccelerators), {
                labelWidth: 210,
                color: SERIES[1],
              })}
              height={Math.max(140, topAccelerators.length * 32 + 60)}
              onClick={openCode(topAccelerators)}
              ariaLabel="Top accelerators by hours"
            />
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Member billable utilization"
            subtitle="Individual billable % — click a bar for the employee detail"
          />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(memberBillability, { format: "percent" })}
              height={Math.max(160, memberBillability.length * 28 + 60)}
              onClick={(p) => p.name && goDetail("employee", p.name)}
              ariaLabel="Billable percentage by employee"
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Monthly trend"
            subtitle="Billable % and Productive % by month — click a month for detail"
          />
          <div className="px-3 pb-3">
            {trend.length > 1 ? (
              <EChart
                option={trendLines(
                  trend.map((t) => periodLabel(t.month)),
                  [
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
                  ],
                  { format: "percent" },
                )}
                height={260}
                onClick={(p) => {
                  const match = trend.find((t) => periodLabel(t.month) === p.name);
                  if (match) goDetail("month", match.month);
                }}
                ariaLabel="Monthly billable and productive percentage trend"
              />
            ) : (
              <p className="px-2 pb-4 text-xs text-muted">
                One reporting period in scope
                {trend[0] ? ` (${periodLabel(trend[0].month)})` : ""}. Trends appear
                automatically when more months are loaded.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

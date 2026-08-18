"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { ENTITY_COLORS } from "../charts/theme";
import { DataTable } from "../tables/DataTable";
import { VizContainer } from "../viz/VizContainer";
import { TrendContainer } from "../viz/TrendContainer";
import { goDetail } from "../navigation";
import {
  summarizeCodes,
  groupHours,
  hoursByMonth,
  type CodeSummary,
} from "@/core/metrics/aggregate";
import { formatHours, formatPercent, periodLabel } from "@/core/format";

/**
 * IP & Accelerator analysis plus the activity/code analysis table. Labels
 * are description-first with the technical code as secondary information —
 * everything is derived from configuration-mapped categories. Charts and
 * table rows navigate to the routed activity detail.
 */

function SectionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-grid bg-page px-4 py-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function CategorySection({
  category,
  color,
}: {
  category: "IP" | "Accelerator";
  color: string;
}) {
  const { filtered } = useDashboard();

  const rows = React.useMemo(
    () => filtered.filter((r) => r.developmentCategory === category),
    [filtered, category],
  );
  const codes = React.useMemo(
    () => summarizeCodes(filtered).filter((c) => c.category === category),
    [filtered, category],
  );
  const byEmployee = React.useMemo(
    () => groupHours(rows, (r) => r.employee).slice(0, 10),
    [rows],
  );
  const byTeam = React.useMemo(() => groupHours(rows, (r) => r.team), [rows]);
  const months = React.useMemo(() => hoursByMonth(rows), [rows]);
  const total = rows.reduce((a, r) => a + r.hours, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SectionStat label={`Total ${category} hours`} value={formatHours(total)} />
        <SectionStat label={`${category} count`} value={String(codes.length)} />
        <SectionStat label="Employees involved" value={String(byEmployee.length)} />
        <SectionStat label="Transactions" value={String(rows.length)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <VizContainer
          blockId={`${category.toLowerCase()}-top-activities`}
          title={`Top ${category === "IP" ? "IPs" : "accelerators"}`}
          subtitle="Click to open the activity detail"
          items={codes.slice(0, 10).map((c) => ({
            key: c.code,
            label: c.description,
            value: c.hours,
            detail: `${c.code} · ${c.category}`,
          }))}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          labelWidth={220}
          color={color}
          onItemClick={(key) => goDetail("code", key)}
        />
        <VizContainer
          blockId={`${category.toLowerCase()}-by-employee`}
          title={`${category} hours by employee`}
          subtitle="Click for the employee detail"
          items={byEmployee.map((b) => ({ key: b.key, label: b.key, value: b.hours }))}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          color={color}
          onItemClick={(key) => goDetail("employee", key)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <VizContainer
          blockId={`${category.toLowerCase()}-by-team`}
          title={`${category} hours by team`}
          subtitle="Click for the team detail"
          items={byTeam.map((b) => ({ key: b.key, label: b.key, value: b.hours }))}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          color={color}
          onItemClick={(key) => goDetail("team", key)}
        />
        <TrendContainer
          blockId={`${category.toLowerCase()}-by-month`}
          title={`${category} hours by month`}
          points={months.map((m) => ({ key: m.key, label: periodLabel(m.key) }))}
          series={[
            { name: `${category} hours`, values: months.map((m) => m.hours), color },
          ]}
          onPointClick={(key) => goDetail("month", key)}
        />
      </div>
    </div>
  );
}

export function IpAccelView() {
  const { filtered } = useDashboard();
  const [tab, setTab] = React.useState<"IP" | "Accelerator" | "codes">("IP");
  const codes = React.useMemo(() => summarizeCodes(filtered), [filtered]);

  const columns = React.useMemo<ColumnDef<CodeSummary, any>[]>(
    () => [
      {
        id: "description",
        header: "Activity",
        accessorKey: "description",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      },
      {
        id: "code",
        header: "Code",
        accessorKey: "code",
        cell: (c) => <span className="font-mono text-xs text-ink-2">{c.getValue()}</span>,
      },
      { id: "category", header: "Category", accessorKey: "category" },
      {
        id: "hours",
        header: "Hours",
        accessorKey: "hours",
        meta: { numeric: true },
        cell: (c) => formatHours(c.getValue()),
      },
      {
        id: "shareOfDevelopment",
        header: "% of Development",
        accessorKey: "shareOfDevelopment",
        meta: { numeric: true },
        cell: (c) => formatPercent(c.getValue()),
      },
      {
        id: "employees",
        header: "Employees",
        accessorKey: "employees",
        meta: { numeric: true },
      },
    ],
    [],
  );

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "IP", label: "IP" },
    { id: "Accelerator", label: "Accelerators" },
    { id: "codes", label: "Activity analysis" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-grid" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.id
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "IP" ? <CategorySection category="IP" color={ENTITY_COLORS.IP} /> : null}
      {tab === "Accelerator" ? (
        <CategorySection category="Accelerator" color={ENTITY_COLORS.Accelerator} />
      ) : null}
      {tab === "codes" ? (
        <Card>
          <CardHeader
            title="Activity analysis"
            subtitle="All development activities in scope (searchable by description, code or category) — click a row for full detail"
          />
          <div className="px-5 pb-4">
            <DataTable
              data={codes}
              columns={columns}
              searchPlaceholder="Search description, code or category…"
              onRowClick={(row) => goDetail("code", row.code)}
              csvName="activity_analysis.csv"
              testId="code-table"
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

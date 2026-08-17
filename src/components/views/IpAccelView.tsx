"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { horizontalBars, trendLines } from "../charts/builders";
import { ENTITY_COLORS } from "../charts/theme";
import { DataTable } from "../tables/DataTable";
import { CodeDrilldown } from "../drill/Drilldowns";
import { summarizeCodes, groupHours, hoursByMonth, type CodeSummary } from "@/core/metrics/aggregate";
import { formatHours, formatPercent, periodLabel } from "@/core/format";

/**
 * IP & Accelerator analysis plus the four-character code analysis table.
 * Chart series come entirely from configuration-mapped categories.
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
  const [code, setCode] = React.useState<string | null>(null);

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
        <Card>
          <CardHeader
            title={`Top ${category === "IP" ? "IPs" : "accelerators"}`}
            subtitle="Click a bar to drill down"
          />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                codes.slice(0, 10).map((c) => ({
                  name: `${c.code} · ${c.description}`,
                  value: c.hours,
                })),
                { labelWidth: 220, color },
              )}
              height={Math.max(160, Math.min(codes.length, 10) * 32 + 60)}
              onClick={(p) => {
                const match = codes.find((c) => `${c.code} · ${c.description}` === p.name);
                if (match) setCode(match.code);
              }}
              ariaLabel={`Top ${category} codes by hours`}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title={`${category} hours by employee`} />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                byEmployee.map((b) => ({ name: b.key, value: b.hours })),
                { color },
              )}
              height={Math.max(160, byEmployee.length * 30 + 60)}
              ariaLabel={`${category} hours by employee`}
            />
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`${category} hours by team`} />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                byTeam.map((b) => ({ name: b.key, value: b.hours })),
                { color },
              )}
              height={Math.max(120, byTeam.length * 44 + 60)}
              ariaLabel={`${category} hours by team`}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title={`${category} hours by month`} />
          <div className="px-3 pb-3">
            {months.length > 1 ? (
              <EChart
                option={trendLines(
                  months.map((m) => periodLabel(m.key)),
                  [{ name: `${category} hours`, values: months.map((m) => m.hours), color }],
                )}
                height={220}
                ariaLabel={`${category} hours by month`}
              />
            ) : (
              <p className="px-2 pb-4 text-xs text-muted">
                One period in scope{months[0] ? ` (${periodLabel(months[0].key)})` : ""} —
                trend appears when more months are loaded.
              </p>
            )}
          </div>
        </Card>
      </div>
      <CodeDrilldown code={code} onClose={() => setCode(null)} />
    </div>
  );
}

export function IpAccelView() {
  const { filtered } = useDashboard();
  const [tab, setTab] = React.useState<"IP" | "Accelerator" | "codes">("IP");
  const [code, setCode] = React.useState<string | null>(null);
  const codes = React.useMemo(() => summarizeCodes(filtered), [filtered]);

  const columns = React.useMemo<ColumnDef<CodeSummary, any>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        accessorKey: "code",
        cell: (c) => <span className="font-mono font-medium">{c.getValue()}</span>,
      },
      { id: "description", header: "Description", accessorKey: "description" },
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
    { id: "codes", label: "Code analysis" },
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
            title="Four-character code analysis"
            subtitle="All development codes in scope — click a row for full detail"
          />
          <div className="px-5 pb-4">
            <DataTable
              data={codes}
              columns={columns}
              searchPlaceholder="Search code, description, category…"
              onRowClick={(row) => setCode(row.code)}
              csvName="code_analysis.csv"
              testId="code-table"
            />
          </div>
        </Card>
      ) : null}
      <CodeDrilldown code={code} onClose={() => setCode(null)} />
    </div>
  );
}

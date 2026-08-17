"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Badge, Button, Card, CardHeader } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { horizontalBars, trendLines } from "../charts/builders";
import { SERIES } from "../charts/theme";
import { TransactionsTable } from "../tables/TransactionsTable";
import { formatHours, formatPercent, periodLabel } from "@/core/format";
import { billableHours, sumHours } from "@/core/metrics/engine";
import { groupHours, hoursByMonth, summarizeCodes } from "@/core/metrics/aggregate";
import { goBack, goDetail, type DetailRoute } from "../navigation";
import type { ClassifiedRow } from "@/core/types";

/**
 * Routed detail pages — the drill-down target for every chart, table row and
 * clickable KPI. Reached via #/detail/<kind>/<value>, so browser back/forward
 * work, and the ← Back button returns to the exact previous context with the
 * active filters untouched (details always derive from the filtered scope).
 * Every detail page shows the actual source records behind the metric.
 */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-grid bg-page px-3 py-2">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function DetailShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Button variant="secondary" onClick={() => goBack()} data-testid="detail-back">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-ink" data-testid="detail-title">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function CoreStats({ rows }: { rows: ClassifiedRow[] }) {
  const total = sumHours(rows);
  const billable = billableHours(rows);
  const productive = sumHours(rows.filter((r) => r.isProductive));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Total hours" value={formatHours(total)} />
      <Stat label="Billable hours" value={formatHours(billable)} />
      <Stat
        label="Billable %"
        value={formatPercent(total === 0 ? 0 : (billable / total) * 100)}
      />
      <Stat
        label="Productive %"
        value={formatPercent(total === 0 ? 0 : (productive / total) * 100)}
      />
    </div>
  );
}

function EmployeeBars({
  rows,
  color = SERIES[0],
}: {
  rows: ClassifiedRow[];
  color?: string;
}) {
  const byEmployee = groupHours(rows, (r) => r.employee).slice(0, 12);
  return (
    <Card>
      <CardHeader title="Hours by employee" subtitle="Click a bar for the employee detail" />
      <div className="px-3 pb-3">
        <EChart
          option={horizontalBars(
            byEmployee.map((b) => ({ name: b.key, value: b.hours })),
            { color },
          )}
          height={Math.max(150, byEmployee.length * 30 + 60)}
          onClick={(p) => p.name && goDetail("employee", p.name)}
          ariaLabel="Hours by employee"
        />
      </div>
    </Card>
  );
}

function Transactions({ rows, csvName }: { rows: ClassifiedRow[]; csvName: string }) {
  return (
    <Card>
      <CardHeader
        title="Underlying transactions"
        subtitle={`${rows.length.toLocaleString()} source records · ${formatHours(sumHours(rows))} hours`}
      />
      <div className="px-5 pb-4">
        <TransactionsTable rows={rows} csvName={csvName} testId="detail-transactions" />
      </div>
    </Card>
  );
}

/* ------------------------------ kinds ------------------------------ */

function EmployeeDetail({ value }: { value: string }) {
  const { filtered } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.employee === value),
    [filtered, value],
  );
  const byCategory = groupHours(rows, (r) => r.developmentCategory ?? r.classification);
  return (
    <DetailShell title={value} subtitle={rows[0] ? rows[0].team : "No records in scope"}>
      <CoreStats rows={rows} />
      <Card>
        <CardHeader title="Hours by category" subtitle="Click a bar for the category detail" />
        <div className="px-3 pb-3">
          <EChart
            option={horizontalBars(
              byCategory.slice(0, 10).map((b) => ({ name: b.key, value: b.hours })),
            )}
            height={Math.max(160, byCategory.slice(0, 10).length * 30 + 60)}
            onClick={(p) => p.name && goDetail("category", p.name)}
            ariaLabel={`Hours by category for ${value}`}
          />
        </div>
      </Card>
      <Transactions rows={rows} csvName={`employee_${value}.csv`} />
    </DetailShell>
  );
}

function CodeDetail({ value }: { value: string }) {
  const { filtered, config } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.developmentCode === value),
    [filtered, value],
  );
  const configured = config.codes.find(
    (c) => c.code.toUpperCase() === value.toUpperCase(),
  );
  const description =
    configured?.description ?? rows[0]?.developmentDescription ?? null;
  const category = configured?.category ?? rows[0]?.developmentCategory ?? "Unknown";
  const employees = groupHours(rows, (r) => r.employee);
  const byWbs = groupHours(rows, (r) => r.wbs);
  const months = hoursByMonth(rows);

  return (
    <DetailShell
      title={description ?? `Unknown code (${value})`}
      subtitle={`${value} · ${category}`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total hours" value={formatHours(sumHours(rows))} />
        <Stat label="Employees" value={String(employees.length)} />
        <Stat label="WBS elements" value={String(byWbs.length)} />
        <Stat label="Transactions" value={String(rows.length)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <EmployeeBars rows={rows} />
        <Card>
          <CardHeader title="Monthly trend" />
          <div className="px-3 pb-3">
            {months.length > 1 ? (
              <EChart
                option={trendLines(
                  months.map((m) => periodLabel(m.key)),
                  [{ name: "Hours", values: months.map((m) => m.hours), color: SERIES[0] }],
                )}
                height={220}
                ariaLabel={`Monthly hours trend for ${description ?? value}`}
              />
            ) : (
              <p className="px-2 pb-4 text-xs text-muted">
                Single period in scope — {months[0] ? periodLabel(months[0].key) : "—"},{" "}
                {formatHours(sumHours(rows))} hours. Trend appears once multiple months
                are loaded.
              </p>
            )}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="WBS breakdown" />
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {byWbs.map((b) => (
            <Badge key={b.key} tone="neutral" className="font-mono">
              {b.key} · {formatHours(b.hours)}h
            </Badge>
          ))}
        </div>
      </Card>
      <Transactions rows={rows} csvName={`activity_${value}.csv`} />
    </DetailShell>
  );
}

function CategoryDetail({ value }: { value: string }) {
  const { filtered } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.developmentCategory === value),
    [filtered, value],
  );
  const codes = summarizeCodes(rows);
  return (
    <DetailShell title={value} subtitle="Activity category">
      <CoreStats rows={rows} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Activities in this category" subtitle="Click a bar for the activity detail" />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                codes.slice(0, 10).map((c) => ({
                  name: c.description,
                  value: c.hours,
                  detail: `${c.code} · ${c.category}`,
                })),
                { labelWidth: 220 },
              )}
              height={Math.max(150, Math.min(codes.length, 10) * 32 + 60)}
              onClick={(p) => {
                const match = codes.find((c) => c.description === p.name);
                if (match) goDetail("code", match.code);
              }}
              ariaLabel={`Activities in category ${value}`}
            />
          </div>
        </Card>
        <EmployeeBars rows={rows} />
      </div>
      <Transactions rows={rows} csvName={`category_${value}.csv`} />
    </DetailShell>
  );
}

function MonthDetail({ value }: { value: string }) {
  const { filtered } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.month === value),
    [filtered, value],
  );
  return (
    <DetailShell title={periodLabel(value)} subtitle="Reporting period">
      <CoreStats rows={rows} />
      <EmployeeBars rows={rows} />
      <Transactions rows={rows} csvName={`period_${value}.csv`} />
    </DetailShell>
  );
}

function TeamDetail({ value }: { value: string }) {
  const { filtered } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.team === value),
    [filtered, value],
  );
  const byCategory = groupHours(rows, (r) => r.developmentCategory ?? r.classification);
  return (
    <DetailShell title={`${value} hours`} subtitle="All source transactions logged by this team's members">
      <CoreStats rows={rows} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EmployeeBars rows={rows} />
        <Card>
          <CardHeader title="Hours by category" subtitle="Click a bar for the category detail" />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                byCategory.slice(0, 10).map((b) => ({ name: b.key, value: b.hours })),
              )}
              height={Math.max(160, byCategory.slice(0, 10).length * 30 + 60)}
              onClick={(p) => p.name && goDetail("category", p.name)}
              ariaLabel={`Hours by category for ${value}`}
            />
          </div>
        </Card>
      </div>
      <Transactions rows={rows} csvName={`team_${value}.csv`} />
    </DetailShell>
  );
}

const CLASSIFICATION_FILTERS: Record<
  string,
  { title: string; subtitle: string; predicate: (r: ClassifiedRow) => boolean }
> = {
  Total: {
    title: "Total hours",
    subtitle: "All source transactions contributing to Total Hours",
    predicate: () => true,
  },
  Billable: {
    title: "Billable hours",
    subtitle: "Rows classified billable by the configured WBS rules",
    predicate: (r) => r.isBillable,
  },
  Productive: {
    title: "Productive hours",
    subtitle: "Billable rows plus development rows in productive categories",
    predicate: (r) => r.isProductive,
  },
  Development: {
    title: "Development hours",
    subtitle: "Rows matching the configured development WBS rules",
    predicate: (r) => r.isDevelopment,
  },
};

function ClassificationDetail({ value }: { value: string }) {
  const { filtered } = useDashboard();
  const def = React.useMemo(
    () =>
      CLASSIFICATION_FILTERS[value] ?? {
        title: `${value} rows`,
        subtitle: "Classification",
        predicate: (r: ClassifiedRow) => r.classification === value,
      },
    [value],
  );
  const rows = React.useMemo(
    () => filtered.filter(def.predicate),
    [filtered, def],
  );
  return (
    <DetailShell title={def.title} subtitle={def.subtitle}>
      <CoreStats rows={rows} />
      <EmployeeBars rows={rows} />
      <Transactions rows={rows} csvName={`classification_${value}.csv`} />
    </DetailShell>
  );
}

export function DetailPage({ route }: { route: DetailRoute }) {
  switch (route.kind) {
    case "employee":
      return <EmployeeDetail value={route.value} />;
    case "code":
      return <CodeDetail value={route.value} />;
    case "category":
      return <CategoryDetail value={route.value} />;
    case "team":
      return <TeamDetail value={route.value} />;
    case "month":
      return <MonthDetail value={route.value} />;
    case "classification":
      return <ClassificationDetail value={route.value} />;
  }
}

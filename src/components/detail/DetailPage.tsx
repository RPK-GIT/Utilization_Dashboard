"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { BackButton } from "./BackButton";
import { VizContainer } from "../viz/VizContainer";
import { TrendContainer } from "../viz/TrendContainer";
import { Badge, Card, CardHeader } from "../ui/primitives";
import { SERIES } from "../charts/theme";
import { TransactionsTable } from "../tables/TransactionsTable";
import { formatHours, formatPercent, periodLabel } from "@/core/format";
import { billableHours, sumHours } from "@/core/metrics/engine";
import { groupHours, hoursByMonth, summarizeCodes } from "@/core/metrics/aggregate";
import { goDetail, type DetailRoute } from "../navigation";
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
  // BackButton is a direct child of the full-height column so its sticky
  // positioning tracks the whole page, floating below the header on scroll.
  return (
    <div className="flex flex-col gap-3">
      <BackButton />
      <div>
        <h2 className="text-lg font-semibold text-ink" data-testid="detail-title">
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
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
    <VizContainer
      blockId="detail-by-employee"
      title="Hours by employee"
      subtitle="Click for the employee detail"
      items={byEmployee.map((b) => ({ key: b.key, label: b.key, value: b.hours }))}
      kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
      defaultKind="horizontalBar"
      color={color}
      onItemClick={(key) => goDetail("employee", key)}
    />
  );
}

function CategoryBars({ rows, blockId }: { rows: ClassifiedRow[]; blockId: string }) {
  const byCategory = groupHours(rows, (r) => r.developmentCategory ?? r.classification);
  return (
    <VizContainer
      blockId={blockId}
      title="Hours by category"
      subtitle="Click for the category detail"
      items={byCategory
        .slice(0, 10)
        .map((b) => ({ key: b.key, label: b.key, value: b.hours }))}
      kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
      defaultKind="horizontalBar"
      onItemClick={(key) => goDetail("category", key)}
    />
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
  return (
    <DetailShell title={value} subtitle={rows[0] ? rows[0].team : "No records in scope"}>
      <CoreStats rows={rows} />
      <CategoryBars rows={rows} blockId="detail-employee-categories" />
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
        <TrendContainer
          blockId="detail-code-trend"
          title="Monthly trend"
          points={months.map((m) => ({ key: m.key, label: periodLabel(m.key) }))}
          series={[
            { name: "Hours", values: months.map((m) => m.hours), color: SERIES[0] },
          ]}
          onPointClick={(key) => goDetail("month", key)}
          emptyMessage={`Single period in scope — ${months[0] ? periodLabel(months[0].key) : "—"}, ${formatHours(sumHours(rows))} hours. Trend appears once multiple months are loaded.`}
        />
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
        <VizContainer
          blockId="detail-category-activities"
          title="Activities in this category"
          subtitle="Click for the activity detail"
          items={codes.slice(0, 10).map((c) => ({
            key: c.code,
            label: c.description,
            value: c.hours,
            detail: `${c.code} · ${c.category}`,
          }))}
          kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
          defaultKind="horizontalBar"
          labelWidth={220}
          onItemClick={(key) => goDetail("code", key)}
        />
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
  return (
    <DetailShell title={`${value} hours`} subtitle="All source transactions logged by this team's members">
      <CoreStats rows={rows} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EmployeeBars rows={rows} />
        <CategoryBars rows={rows} blockId="detail-team-categories" />
      </div>
      <Transactions rows={rows} csvName={`team_${value}.csv`} />
    </DetailShell>
  );
}

/**
 * Other Hours — the residual of the hours composition: everything not
 * classified as Billable or as a productive category under the CURRENT
 * configuration. The category breakdown reconciles exactly to Other Hours;
 * rows without an activity category (excluded, not billable, unclassified
 * WBS) appear under their classification so nothing is unexplained.
 */
function OtherDetail() {
  const { filtered, config } = useDashboard();
  const productive = React.useMemo(
    () =>
      new Set(
        config.categories.filter((c) => c.active && c.productive).map((c) => c.name),
      ),
    [config.categories],
  );
  const rows = React.useMemo(
    () =>
      filtered.filter(
        (r) =>
          !r.isBillable &&
          (!r.developmentCategory || !productive.has(r.developmentCategory)),
      ),
    [filtered, productive],
  );
  const totalOther = sumHours(rows);
  const scopeTotal = sumHours(filtered);
  const breakdown = groupHours(rows, (r) => r.developmentCategory ?? r.classification);
  const breakdownTotal = breakdown.reduce((a, b) => a + b.hours, 0);
  const configCategories = React.useMemo(
    () => new Set(config.categories.map((c) => c.name)),
    [config.categories],
  );

  return (
    <DetailShell
      title="Other hours"
      subtitle="Hours not classified as Billable, IP or Accelerator under the current dashboard configuration"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Other hours" value={formatHours(totalOther)} />
        <Stat
          label="Share of Total Hours"
          value={formatPercent(scopeTotal === 0 ? 0 : (totalOther / scopeTotal) * 100)}
        />
        <Stat label="Categories" value={String(breakdown.length)} />
        <Stat label="Transactions" value={String(rows.length)} />
      </div>
      <VizContainer
        blockId="other-breakdown-viz"
        title="Category breakdown"
        subtitle={`These categories sum exactly to Other Hours (${formatHours(breakdownTotal)} = ${formatHours(totalOther)}) — click for the category detail`}
        items={breakdown.map((b) => ({ key: b.key, label: b.key, value: b.hours }))}
        kinds={["table", "donut", "pie", "horizontalBar", "verticalBar"]}
        defaultKind="table"
        includeTotal
        tableTestId="other-breakdown"
        onItemClick={(key) =>
          configCategories.has(key)
            ? goDetail("category", key)
            : goDetail("classification", key)
        }
      />
      <EmployeeBars rows={rows} />
      <Transactions rows={rows} csvName="other_hours.csv" />
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
      return route.value === "Other" ? (
        <OtherDetail />
      ) : (
        <ClassificationDetail value={route.value} />
      );
  }
}

"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Badge, Card, CardHeader, Dialog } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { horizontalBars, trendLines } from "../charts/builders";
import { SERIES } from "../charts/theme";
import { TransactionsTable } from "../tables/TransactionsTable";
import { formatHours, formatPercent, periodLabel } from "@/core/format";
import { billableHours, sumHours } from "@/core/metrics/engine";
import { groupHours, hoursByMonth } from "@/core/metrics/aggregate";

/**
 * Drilldown dialogs shared by interactive and snapshot modes. They derive
 * everything from the filtered rows in context — no separate data path.
 */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-grid bg-page px-3 py-2">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

export function EmployeeDrilldown({
  employee,
  onClose,
}: {
  employee: string | null;
  onClose: () => void;
}) {
  const { filtered } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.employee === employee),
    [filtered, employee],
  );
  if (!employee) return null;

  const total = sumHours(rows);
  const billable = billableHours(rows);
  const productive = sumHours(rows.filter((r) => r.isProductive));
  const byCategory = groupHours(rows, (r) => r.developmentCategory ?? r.classification);

  return (
    <Dialog
      open={employee !== null}
      onClose={onClose}
      title={employee}
      subtitle={rows[0] ? rows[0].team : undefined}
      wide
    >
      <div className="flex flex-col gap-4">
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
        <Card>
          <CardHeader title="Hours by category" />
          <div className="px-3 pb-3">
            <EChart
              option={horizontalBars(
                byCategory.slice(0, 10).map((b) => ({ name: b.key, value: b.hours })),
              )}
              height={Math.max(180, byCategory.slice(0, 10).length * 32 + 60)}
              ariaLabel={`Hours by category for ${employee}`}
            />
          </div>
        </Card>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Transactions</h4>
          <TransactionsTable rows={rows} pageSize={10} />
        </div>
      </div>
    </Dialog>
  );
}

export function CodeDrilldown({
  code,
  onClose,
}: {
  code: string | null;
  onClose: () => void;
}) {
  const { filtered } = useDashboard();
  const rows = React.useMemo(
    () => filtered.filter((r) => r.developmentCode === code),
    [filtered, code],
  );
  if (!code) return null;

  const total = sumHours(rows);
  const description = rows[0]?.developmentDescription ?? "Unknown code";
  const category = rows[0]?.developmentCategory ?? "Unknown";
  const employees = groupHours(rows, (r) => r.employee);
  const byWbs = groupHours(rows, (r) => r.wbs);
  const months = hoursByMonth(rows);

  return (
    <Dialog
      open={code !== null}
      onClose={onClose}
      title={`${code} — ${description}`}
      subtitle={`Category: ${category}`}
      wide
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total hours" value={formatHours(total)} />
          <Stat label="Employees" value={String(employees.length)} />
          <Stat label="WBS elements" value={String(byWbs.length)} />
          <Stat label="Transactions" value={String(rows.length)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Hours by employee" />
            <div className="px-3 pb-3">
              <EChart
                option={horizontalBars(
                  employees.slice(0, 10).map((b) => ({ name: b.key, value: b.hours })),
                )}
                height={Math.max(160, employees.slice(0, 10).length * 32 + 60)}
                ariaLabel={`Hours by employee for code ${code}`}
              />
            </div>
          </Card>
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
                  ariaLabel={`Monthly hours trend for code ${code}`}
                />
              ) : (
                <p className="px-2 pb-4 text-xs text-muted">
                  Single period in scope — {months[0] ? periodLabel(months[0].key) : "—"},{" "}
                  {formatHours(total)} hours. Trend appears once multiple months are loaded.
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
        <div>
          <h4 className="mb-2 text-sm font-semibold text-ink">Raw transactions</h4>
          <TransactionsTable rows={rows} pageSize={10} />
        </div>
      </div>
    </Dialog>
  );
}

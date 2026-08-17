"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { horizontalBars } from "../charts/builders";
import { TransactionsTable } from "../tables/TransactionsTable";
import { groupHours } from "@/core/metrics/aggregate";
import { formatHours } from "@/core/format";

/**
 * Activity analysis — where non-billable capacity goes (Learning, Leave,
 * meetings, idle, …). Clicking a category drills into its transactions.
 */
export function ActivitiesView() {
  const { filtered, config } = useDashboard();
  const [selected, setSelected] = React.useState<string | null>(null);

  const productive = React.useMemo(
    () => new Set(config.categories.filter((c) => c.productive).map((c) => c.name)),
    [config.categories],
  );
  const buckets = React.useMemo(
    () =>
      groupHours(filtered, (r) =>
        r.developmentCategory && !productive.has(r.developmentCategory)
          ? r.developmentCategory
          : null,
      ),
    [filtered, productive],
  );
  const selectedRows = React.useMemo(
    () => filtered.filter((r) => r.developmentCategory === selected),
    [filtered, selected],
  );
  const total = buckets.reduce((a, b) => a + b.hours, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Non-productive activity distribution"
          subtitle={`${formatHours(total)} hours outside billable, IP and accelerator work — click a bar for the underlying records`}
        />
        <div className="px-3 pb-3">
          <EChart
            option={horizontalBars(
              buckets.map((b) => ({ name: b.key, value: b.hours })),
            )}
            height={Math.max(200, buckets.length * 30 + 60)}
            onClick={(p) => p.name && setSelected(p.name)}
            ariaLabel="Hours by non-productive activity category"
          />
        </div>
      </Card>
      {selected ? (
        <Card>
          <CardHeader
            title={`${selected} — transactions`}
            subtitle={`${formatHours(
              selectedRows.reduce((a, r) => a + r.hours, 0),
            )} hours across ${selectedRows.length} records`}
          />
          <div className="px-5 pb-4">
            <TransactionsTable rows={selectedRows} csvName={`${selected}_activity.csv`} />
          </div>
        </Card>
      ) : (
        <p className="text-xs text-muted">
          Select a category above to inspect its underlying records.
        </p>
      )}
    </div>
  );
}

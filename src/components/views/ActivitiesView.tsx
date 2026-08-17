"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { horizontalBars } from "../charts/builders";
import { goDetail } from "../navigation";
import { groupHours, summarizeCodes } from "@/core/metrics/aggregate";
import { formatHours } from "@/core/format";

/**
 * Activity analysis — where non-billable capacity goes (Learning, Leave,
 * meetings, idle, …). Clicking a category opens the routed category detail
 * with the actual underlying records.
 */
export function ActivitiesView() {
  const { filtered, config } = useDashboard();

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
  const nonProductiveCodes = React.useMemo(
    () =>
      summarizeCodes(filtered)
        .filter((c) => !productive.has(c.category))
        .slice(0, 12),
    [filtered, productive],
  );
  const total = buckets.reduce((a, b) => a + b.hours, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Non-productive activity distribution"
          subtitle={`${formatHours(total)} hours outside billable, IP and accelerator work — click a bar for the category detail and its records`}
        />
        <div className="px-3 pb-3">
          <EChart
            option={horizontalBars(
              buckets.map((b) => ({ name: b.key, value: b.hours })),
            )}
            height={Math.max(200, buckets.length * 30 + 60)}
            onClick={(p) => p.name && goDetail("category", p.name)}
            ariaLabel="Hours by non-productive activity category"
          />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Largest non-productive activities"
          subtitle="Description-first; click a bar for the activity detail"
        />
        <div className="px-3 pb-3">
          <EChart
            option={horizontalBars(
              nonProductiveCodes.map((c) => ({
                name: c.description,
                value: c.hours,
                detail: `${c.code} · ${c.category}`,
              })),
              { labelWidth: 220 },
            )}
            height={Math.max(180, nonProductiveCodes.length * 30 + 60)}
            onClick={(p) => {
              const match = nonProductiveCodes.find((c) => c.description === p.name);
              if (match) goDetail("code", match.code);
            }}
            ariaLabel="Hours by non-productive activity"
          />
        </div>
      </Card>
    </div>
  );
}

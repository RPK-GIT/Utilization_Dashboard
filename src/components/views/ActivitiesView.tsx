"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { VizContainer } from "../viz/VizContainer";
import { goDetail } from "../navigation";
import { groupHours, summarizeCodes } from "@/core/metrics/aggregate";
import { formatHours } from "@/core/format";

/**
 * Activity analysis — where non-billable capacity goes (Learning, Leave,
 * meetings, idle, …). Both blocks render through the global visualization
 * framework and drill into the routed category/activity details.
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
      <VizContainer
        blockId="activities-categories"
        title="Non-productive activity distribution"
        subtitle={`${formatHours(total)} hours outside billable, IP and accelerator work — click for the category detail and its records`}
        items={buckets.map((b) => ({ key: b.key, label: b.key, value: b.hours }))}
        kinds={["horizontalBar", "verticalBar", "donut", "pie", "table"]}
        defaultKind="horizontalBar"
        onItemClick={(key) => goDetail("category", key)}
      />
      <VizContainer
        blockId="activities-top"
        title="Largest non-productive activities"
        subtitle="Description-first; click for the activity detail"
        items={nonProductiveCodes.map((c) => ({
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
    </div>
  );
}

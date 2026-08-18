"use client";

import * as React from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { compositionBar } from "../charts/builders";
import { ENTITY_COLORS, SERIES, AXIS } from "../charts/theme";
import { computeComposition } from "@/core/metrics/engine";
import { formatHours, formatPercent } from "@/core/format";
import { goDetail } from "../navigation";

/**
 * Hours Composition — demonstrates that 100% of Total Hours is accounted
 * for without a KPI tile per activity category. Segments (Billable, each
 * configured productive category, Other) always sum to Total Hours; every
 * segment drills into its detail. All values derive from the central
 * classification/metric engines over the filtered scope, so filters and
 * configuration changes flow through automatically.
 */

const OTHER_COLOR = AXIS; // recessive neutral — Other is residual, not a series
const OTHER_HINT = "Click to see category breakdown";
const OTHER_DEFINITION =
  "Other Hours represents hours not classified as Billable, IP or Accelerator under the current dashboard configuration.";

function segmentColor(key: string, kind: string, index: number): string {
  if (kind === "billable") return SERIES[2]; // aqua — validated with blue/orange
  if (kind === "other") return OTHER_COLOR;
  return ENTITY_COLORS[key] ?? SERIES[(index + 3) % SERIES.length];
}

export function HoursComposition() {
  const { filtered, config } = useDashboard();
  const composition = React.useMemo(
    () => computeComposition(filtered, config.categories),
    [filtered, config.categories],
  );

  if (composition.totalHours === 0) return null;

  const colored = composition.segments.map((seg, i) => ({
    ...seg,
    color: segmentColor(seg.key, seg.kind, i),
    hint: seg.kind === "other" ? OTHER_HINT : undefined,
  }));

  const navigateSegment = (key: string, kind: string) => {
    if (kind === "billable") goDetail("classification", "Billable");
    else if (kind === "other") goDetail("classification", "Other");
    else goDetail("category", key);
  };

  const reconciliationText = `${formatHours(composition.totalHours)} = ${composition.segments
    .map((s) => `${formatHours(s.hours)} ${s.key}`)
    .join(" + ")}`;

  return (
    <Card data-testid="hours-composition">
      <CardHeader
        title="Hours composition"
        subtitle={`Total Hours: ${formatHours(composition.totalHours)} — every hour in scope belongs to exactly one segment. Click a segment for its underlying records.`}
      />
      <div className="flex flex-col gap-3 px-5 pb-4">
        <EChart
          option={compositionBar(colored)}
          height={40}
          onClick={(p) => {
            const seg = composition.segments.find((s) => s.key === p.seriesName);
            if (seg) navigateSegment(seg.key, seg.kind);
          }}
          ariaLabel="Hours composition: share of total hours by segment"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {colored.map((seg) => (
            <button
              key={seg.key}
              type="button"
              data-testid={`comp-${seg.key.replace(/\s+/g, "-")}`}
              onClick={() => navigateSegment(seg.key, seg.kind)}
              title={
                seg.kind === "other"
                  ? `${OTHER_DEFINITION} ${OTHER_HINT}.`
                  : `${seg.key} hours as a share of Total Hours — click for detail`
              }
              className="flex items-start gap-2 rounded-md border border-grid bg-page px-3 py-2 text-left transition-colors hover:bg-grid/40 cursor-pointer"
            >
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: seg.color }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-ink-2">
                  {seg.key}
                </span>
                <span className="block text-base font-semibold text-ink tnum">
                  {formatHours(seg.hours)} hrs
                </span>
                <span className="block text-[11px] text-muted">
                  {formatPercent(seg.shareOfTotal)} of Total Hours
                </span>
              </span>
            </button>
          ))}
        </div>
        {composition.reconciles ? (
          <p
            className="flex items-center gap-1.5 text-xs text-good-text"
            data-testid="reconciliation-ok"
            title={reconciliationText}
          >
            <CircleCheck className="h-3.5 w-3.5" />
            100% of total hours accounted for — {reconciliationText}
          </p>
        ) : (
          <p
            className="flex items-center gap-1.5 rounded-md border border-critical/30 bg-red-50 px-3 py-2 text-xs font-medium text-critical"
            data-testid="reconciliation-warning"
          >
            <TriangleAlert className="h-3.5 w-3.5" />
            Hours reconciliation issue — {formatHours(Math.abs(composition.difference))}{" "}
            hours are not assigned to any segment. Total: {formatHours(composition.totalHours)}.
          </p>
        )}
      </div>
    </Card>
  );
}

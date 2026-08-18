"use client";

import * as React from "react";
import { Card, CardHeader, Select } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { groupedVerticalBars, trendLines } from "../charts/builders";
import { formatHours, formatPercent } from "@/core/format";
import { useVizPreference } from "./useVizPreference";

/**
 * Time-series counterpart of VizContainer: ordered categories (months/dates)
 * with one or more series. Semantically appropriate alternatives only —
 * line, vertical bars or a table; never pie/donut for a time series. Same
 * persistence/snapshot behavior as every other switchable block.
 */

export type TrendVizKind = "line" | "verticalBar" | "table";

const KIND_LABELS: Record<TrendVizKind, string> = {
  line: "Line",
  verticalBar: "Vertical Bar",
  table: "Table",
};

export interface TrendPoint {
  /** Navigation key (e.g. "2026-07"). */
  key: string;
  /** Display label (e.g. "July 2026"). */
  label: string;
}

export function TrendContainer({
  blockId,
  title,
  subtitle,
  points,
  series,
  defaultKind = "line",
  format = "hours",
  onPointClick,
  emptyMessage,
}: {
  blockId: string;
  title: string;
  subtitle?: string;
  points: TrendPoint[];
  series: { name: string; values: number[]; color: string }[];
  defaultKind?: TrendVizKind;
  format?: "hours" | "percent";
  onPointClick?: (key: string) => void;
  /** Shown instead of a chart when fewer than two points exist. */
  emptyMessage?: string;
}) {
  const [selection, setSelection] = useVizPreference(blockId, {
    metric: blockId,
    viz: defaultKind,
    dimension: "-",
  });
  const kinds: TrendVizKind[] = ["line", "verticalBar", "table"];
  const kind: TrendVizKind = kinds.includes(selection.viz as TrendVizKind)
    ? (selection.viz as TrendVizKind)
    : defaultKind;

  const navigate = (label: string) => {
    const point = points.find((p) => p.label === label);
    if (point) onPointClick?.(point.key);
  };
  const fmt = (v: number) => (format === "percent" ? formatPercent(v) : formatHours(v));

  return (
    <Card data-testid={blockId}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          points.length > 1 ? (
            <Select
              aria-label={`View for ${title}`}
              title="Change visualization — same data, different view"
              data-testid={`${blockId}-viz`}
              value={kind}
              onChange={(e) => setSelection({ ...selection, viz: e.target.value })}
              className="h-7 text-xs"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      <div className="px-3 pb-3" data-testid={`${blockId}-body`}>
        {points.length <= 1 ? (
          <p className="px-2 pb-4 text-xs text-muted">
            {emptyMessage ??
              "One period in scope — the trend appears when more months are loaded."}
          </p>
        ) : kind === "line" ? (
          <EChart
            option={trendLines(
              points.map((p) => p.label),
              series,
              { format },
            )}
            height={260}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={title}
          />
        ) : kind === "verticalBar" ? (
          <EChart
            option={groupedVerticalBars(
              points.map((p) => p.label),
              series,
              { format },
            )}
            height={260}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={title}
          />
        ) : (
          <div className="mx-2 mb-1 overflow-x-auto rounded-md border border-grid">
            <table className="w-full text-sm" data-testid={`${blockId}-table`}>
              <thead className="bg-page">
                <tr className="text-left text-xs font-semibold text-ink-2">
                  <th className="px-3 py-2">Period</th>
                  {series.map((s) => (
                    <th key={s.name} className="px-3 py-2 text-right">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr
                    key={p.key}
                    className={`border-t border-grid ${onPointClick ? "cursor-pointer hover:bg-page" : ""}`}
                    onClick={() => onPointClick?.(p.key)}
                  >
                    <td className="px-3 py-1.5 font-medium text-ink">{p.label}</td>
                    {series.map((s) => (
                      <td key={s.name} className="px-3 py-1.5 text-right tnum">
                        {fmt(s.values[i] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

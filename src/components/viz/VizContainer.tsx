"use client";

import * as React from "react";
import { Card, CardHeader, Select } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { donut, horizontalBars, trendLines, verticalBars } from "../charts/builders";
import { SERIES } from "../charts/theme";
import { formatHours, formatPercent } from "@/core/format";
import { useVizPreference } from "./useVizPreference";

/**
 * Global reusable visualization container: ONE mechanism for every chart in
 * the dashboard (and the executive snapshot). The page supplies
 * pre-aggregated buckets from the filtered scope plus the context-aware list
 * of visualization kinds that make sense for that data; the user switches
 * the representation with a subtle "View" control. The underlying data,
 * calculations, filters and drilldowns never change — only the presentation.
 */

export type SimpleVizKind =
  | "horizontalBar"
  | "verticalBar"
  | "donut"
  | "pie"
  | "line"
  | "table";

const KIND_LABELS: Record<SimpleVizKind, string> = {
  horizontalBar: "Horizontal Bar",
  verticalBar: "Vertical Bar",
  donut: "Donut",
  pie: "Pie",
  line: "Line",
  table: "Table",
};

export interface VizItem {
  key: string;
  label: string;
  value: number;
  /** Secondary tooltip line (e.g. "DTEC · IP"). */
  detail?: string;
}

export function VizContainer({
  blockId,
  title,
  subtitle,
  items,
  kinds,
  defaultKind,
  format = "hours",
  color,
  colors,
  onItemClick,
  valueHeader = "Hours",
  includeTotal = false,
  tableTestId,
  labelWidth,
  maxBars = 12,
}: {
  /** Stable id for presentation persistence + snapshot embedding. */
  blockId: string;
  title: string;
  subtitle?: string;
  /** Pre-aggregated buckets from the filtered scope. */
  items: VizItem[];
  /** Context-aware kinds that make sense for THIS data. */
  kinds: SimpleVizKind[];
  defaultKind: SimpleVizKind;
  format?: "hours" | "percent";
  color?: string;
  /** Explicit label→color map (color follows entity, e.g. IP/Accelerator). */
  colors?: Record<string, string>;
  onItemClick?: (key: string) => void;
  valueHeader?: string;
  /** Show a Total row in the table view (reconciliation-style blocks). */
  includeTotal?: boolean;
  tableTestId?: string;
  labelWidth?: number;
  maxBars?: number;
}) {
  const [selection, setSelection] = useVizPreference(blockId, {
    metric: blockId,
    viz: defaultKind,
    dimension: "-",
  });
  const kind: SimpleVizKind = kinds.includes(selection.viz as SimpleVizKind)
    ? (selection.viz as SimpleVizKind)
    : defaultKind;

  const total = items.reduce((a, i) => a + i.value, 0);
  const navigate = (label: string) => {
    const item = items.find((i) => i.label === label);
    if (item) onItemClick?.(item.key);
  };

  const barItems = items
    .slice(0, maxBars)
    .map((i) => ({ name: i.label, value: i.value, detail: i.detail }));
  const donutTop = items.slice(0, 5);
  const donutRest = items.slice(5);
  const donutItems = [
    ...donutTop.map((i) => ({ name: i.label, value: i.value })),
    ...(donutRest.length > 0
      ? [
          {
            name: `Other (${donutRest.length})`,
            value: donutRest.reduce((a, i) => a + i.value, 0),
          },
        ]
      : []),
  ];
  const donutColors =
    colors ??
    Object.fromEntries(
      donutItems.map((i, idx) => [i.name, SERIES[idx % SERIES.length]]),
    );

  return (
    <Card data-testid={blockId}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          kinds.length > 1 ? (
            <Select
              aria-label={`View for ${title}`}
              title="Change visualization — same data, different view"
              data-testid={`${blockId}-viz`}
              value={kind}
              onChange={(e) =>
                setSelection({ ...selection, viz: e.target.value })
              }
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
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No data in the current scope.
          </p>
        ) : null}
        {items.length > 0 && kind === "horizontalBar" ? (
          <EChart
            option={horizontalBars(barItems, { format, color, labelWidth })}
            height={Math.max(140, barItems.length * 30 + 60)}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={title}
          />
        ) : null}
        {items.length > 0 && kind === "verticalBar" ? (
          <EChart
            option={verticalBars(barItems.slice(0, 8), { format, color })}
            height={280}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={title}
          />
        ) : null}
        {items.length > 0 && (kind === "donut" || kind === "pie") ? (
          <EChart
            option={donut(donutItems, { pie: kind === "pie", colors: donutColors })}
            height={280}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={title}
          />
        ) : null}
        {items.length > 0 && kind === "line" ? (
          <EChart
            option={trendLines(
              items.map((i) => i.label),
              [
                {
                  name: valueHeader,
                  values: items.map((i) => i.value),
                  color: color ?? SERIES[0],
                },
              ],
              { format },
            )}
            height={260}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={title}
          />
        ) : null}
        {items.length > 0 && kind === "table" ? (
          <div className="overflow-x-auto rounded-md border border-grid mx-2 mb-1">
            <table className="w-full text-sm" data-testid={tableTestId ?? `${blockId}-table`}>
              <thead className="bg-page">
                <tr className="text-left text-xs font-semibold text-ink-2">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">{valueHeader}</th>
                  {format === "hours" ? (
                    <th className="px-3 py-2 text-right">Share</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr
                    key={i.key}
                    className={`border-t border-grid ${onItemClick ? "cursor-pointer hover:bg-page" : ""}`}
                    onClick={() => onItemClick?.(i.key)}
                  >
                    <td className="px-3 py-1.5 font-medium text-ink">
                      {i.label}
                      {i.detail && i.detail !== i.label ? (
                        <span className="ml-2 text-[11px] text-muted">{i.detail}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tnum">
                      {format === "percent" ? formatPercent(i.value) : formatHours(i.value)}
                    </td>
                    {format === "hours" ? (
                      <td className="px-3 py-1.5 text-right tnum">
                        {formatPercent(total === 0 ? 0 : (i.value / total) * 100)}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {includeTotal && format === "hours" ? (
                  <tr className="border-t border-grid bg-page text-xs font-semibold">
                    <td className="px-3 py-1.5">Total</td>
                    <td className="px-3 py-1.5 text-right tnum">{formatHours(total)}</td>
                    <td className="px-3 py-1.5 text-right tnum">
                      {formatPercent(total === 0 ? 0 : 100)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

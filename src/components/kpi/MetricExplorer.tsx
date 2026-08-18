"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader, Select } from "../ui/primitives";
import { EChart } from "../charts/EChart";
import { donut, horizontalBars, trendLines, verticalBars } from "../charts/builders";
import { ENTITY_COLORS, SERIES, AXIS } from "../charts/theme";
import {
  allowedVisualizations,
  computeExplorer,
  DIMENSION_LABELS,
  EXPLORER_METRICS,
  explorerMetric,
  VIZ_LABELS,
  type DimensionId,
  type ExplorerBucket,
  type VisualizationType,
  type VizSelection,
} from "@/core/metrics/explorer";
import { formatHours, formatPercent } from "@/core/format";
import { goDetail } from "../navigation";
import { loadPresentation, savePresentation } from "../filterPersistence";

/**
 * Metric analysis explorer — one reusable block where the user picks the
 * metric, the visualization and the breakdown dimension. Data always comes
 * from the same filtered scope and metric registry; only the presentation
 * changes. Supported chart types are context-aware (no pie for Total Hours,
 * line only over months). Selections are session presentation preferences —
 * never business configuration — and are preserved across navigation,
 * refresh and into generated executive snapshots. Every visualization keeps
 * its drilldown into the routed detail pages.
 */

const BLOCK_ID = "metric-explorer";

function bucketColor(bucket: ExplorerBucket, index: number): string {
  if (bucket.key === "Billable") return SERIES[2];
  if (bucket.key === "Non-Billable" || bucket.key === "Other") return AXIS;
  return ENTITY_COLORS[bucket.key] ?? SERIES[index % SERIES.length];
}

function useVizSelection(): [VizSelection, (next: VizSelection) => void] {
  const { presentationKey, initialPresentation } = useDashboard();
  const defaults = React.useMemo<VizSelection>(() => {
    const def = explorerMetric("ip_hours");
    return {
      metric: def.id,
      viz: def.defaultVisualization,
      dimension: def.defaultDimension,
    };
  }, []);
  const [selection, setSelection] = React.useState<VizSelection>(() => {
    const stored = loadPresentation(presentationKey)[BLOCK_ID];
    const seeded = initialPresentation?.[BLOCK_ID];
    return (stored ?? seeded ?? defaults) as VizSelection;
  });
  const update = React.useCallback(
    (next: VizSelection) => {
      setSelection(next);
      const all = loadPresentation(presentationKey);
      all[BLOCK_ID] = next;
      savePresentation(presentationKey, all);
    },
    [presentationKey],
  );
  return [selection, update];
}

export function MetricExplorer() {
  const { filtered, config } = useDashboard();
  const [selection, setSelection] = useVizSelection();

  const def = explorerMetric(selection.metric);
  // Sanitize stale stored state against the registry.
  const dimension: DimensionId = def.dimensions.includes(selection.dimension)
    ? selection.dimension
    : def.defaultDimension;
  const allowedViz = allowedVisualizations(def, dimension);
  const viz: VisualizationType = allowedViz.includes(selection.viz)
    ? selection.viz
    : def.defaultVisualization;

  const result = computeExplorer(filtered, def.id, dimension, config);

  const changeMetric = (metricId: string) => {
    const next = explorerMetric(metricId);
    setSelection({
      metric: next.id,
      viz: next.defaultVisualization,
      dimension: next.defaultDimension,
    });
  };
  const changeViz = (nextViz: VisualizationType) => {
    // Line charts need the Month dimension — switch it along.
    const nextDimension =
      nextViz === "line" && dimension !== "month" ? ("month" as const) : dimension;
    setSelection({ metric: def.id, viz: nextViz, dimension: nextDimension });
  };
  const changeDimension = (nextDimension: DimensionId) => {
    const stillAllowed = allowedVisualizations(def, nextDimension).includes(viz);
    setSelection({
      metric: def.id,
      viz: stillAllowed ? viz : def.defaultVisualization,
      dimension: nextDimension,
    });
  };

  const navigate = (label: string) => {
    const bucket = result.buckets.find((b) => b.label === label);
    if (bucket?.nav) goDetail(bucket.nav.kind, bucket.nav.value);
  };

  // Chart-friendly shapes. Donut/pie fold the tail past 5 segments.
  const barItems = result.buckets.slice(0, 12).map((b) => ({
    name: b.label,
    value: b.hours,
    detail: b.detail,
  }));
  const donutTop = result.buckets.slice(0, 5);
  const donutRest = result.buckets.slice(5);
  const donutItems = [
    ...donutTop.map((b) => ({ name: b.label, value: b.hours })),
    ...(donutRest.length > 0
      ? [
          {
            name: `Other (${donutRest.length})`,
            value: donutRest.reduce((a, b) => a + b.hours, 0),
          },
        ]
      : []),
  ];

  return (
    <Card data-testid="metric-explorer">
      <CardHeader
        title="Metric analysis"
        subtitle="Same data and calculations — choose the metric, the view and the breakdown"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Metric"
              data-testid="viz-metric"
              value={def.id}
              onChange={(e) => changeMetric(e.target.value)}
            >
              {EXPLORER_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Visualization"
              data-testid="viz-type"
              value={viz}
              onChange={(e) => changeViz(e.target.value as VisualizationType)}
            >
              {/* Selecting Line automatically switches the breakdown to Month
                  (a line chart needs an ordered axis), so every supported
                  visualization stays selectable. */}
              {def.visualizations.map((v) => (
                <option key={v} value={v}>
                  {VIZ_LABELS[v]}
                </option>
              ))}
            </Select>
            {viz !== "kpi" ? (
              <Select
                aria-label="Breakdown by"
                data-testid="viz-dimension"
                value={dimension}
                onChange={(e) => changeDimension(e.target.value as DimensionId)}
              >
                {def.dimensions.map((d) => (
                  <option key={d} value={d}>
                    By {DIMENSION_LABELS[d]}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        }
      />
      <div className="px-5 pb-4" data-testid="viz-body">
        {viz === "kpi" ? (
          <div className="py-4">
            <p className="text-3xl font-semibold text-ink">
              {formatHours(result.metricHours)}
              <span className="ml-1 text-base font-normal text-ink-2">hrs</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {formatPercent(
                result.scopeHours === 0
                  ? 0
                  : (result.metricHours / result.scopeHours) * 100,
              )}{" "}
              of Total Hours in the current scope
            </p>
          </div>
        ) : null}
        {viz === "horizontalBar" ? (
          <EChart
            option={horizontalBars(barItems, { labelWidth: 200 })}
            height={Math.max(160, barItems.length * 30 + 60)}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={`${def.name} by ${DIMENSION_LABELS[dimension]}`}
          />
        ) : null}
        {viz === "verticalBar" ? (
          <EChart
            option={verticalBars(barItems.slice(0, 8))}
            height={280}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={`${def.name} by ${DIMENSION_LABELS[dimension]}`}
          />
        ) : null}
        {viz === "donut" || viz === "pie" ? (
          <EChart
            option={donut(donutItems, {
              pie: viz === "pie",
              colors: Object.fromEntries(
                result.buckets.map((b, i) => [b.label, bucketColor(b, i)]),
              ),
            })}
            height={280}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={`${def.name} composition by ${DIMENSION_LABELS[dimension]}`}
          />
        ) : null}
        {viz === "line" ? (
          <EChart
            option={trendLines(
              result.buckets.map((b) => b.label),
              [
                {
                  name: def.name,
                  values: result.buckets.map((b) => b.hours),
                  color: SERIES[0],
                },
              ],
            )}
            height={260}
            onClick={(p) => p.name && navigate(p.name)}
            ariaLabel={`${def.name} trend by month`}
          />
        ) : null}
        {viz === "table" ? (
          <div className="overflow-x-auto rounded-md border border-grid">
            <table className="w-full text-sm" data-testid="viz-table">
              <thead className="bg-page">
                <tr className="text-left text-xs font-semibold text-ink-2">
                  <th className="px-3 py-2">{DIMENSION_LABELS[dimension]}</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2 text-right">% of {def.name}</th>
                </tr>
              </thead>
              <tbody>
                {result.buckets.map((b) => (
                  <tr
                    key={b.key}
                    className={`border-t border-grid ${b.nav ? "cursor-pointer hover:bg-page" : ""}`}
                    onClick={() => b.nav && goDetail(b.nav.kind, b.nav.value)}
                  >
                    <td className="px-3 py-1.5 font-medium text-ink">
                      {b.label}
                      {b.detail && b.detail !== b.label ? (
                        <span className="ml-2 text-[11px] text-muted">{b.detail}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tnum">{formatHours(b.hours)}</td>
                    <td className="px-3 py-1.5 text-right tnum">
                      {formatPercent(b.share)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-grid bg-page text-xs font-semibold">
                  <td className="px-3 py-1.5">Total</td>
                  <td className="px-3 py-1.5 text-right tnum">
                    {formatHours(result.metricHours)}
                  </td>
                  <td className="px-3 py-1.5 text-right tnum">
                    {formatPercent(result.metricHours === 0 ? 0 : 100)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
        {viz !== "kpi" && result.buckets.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No {def.name} in the current scope.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

import type { EChartsCoreOption } from "echarts/core";
import { formatHours, formatPercent } from "@/core/format";
import {
  AXIS_LABEL,
  AXIS_LINE,
  ENTITY_COLORS,
  FONT,
  INK,
  INK_2,
  SERIES,
  SPLIT_LINE,
  SURFACE,
  TOOLTIP_STYLE,
} from "./theme";

/**
 * Chart option builders. Charts consume pre-aggregated data only — no
 * business rules live here. Marks follow the reference specs: thin bars with
 * 4px rounded data-ends, 2px lines with ringed markers, hairline solid grids,
 * values in ink (never series-colored text).
 */

type ValueFormat = "hours" | "percent";

function fmt(value: number, format: ValueFormat): string {
  return format === "percent" ? formatPercent(value) : formatHours(value);
}

export interface NamedValue {
  name: string;
  value: number;
  /** Secondary line for the tooltip (e.g. the technical code + category). */
  detail?: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Horizontal bar chart — one measure over nominal categories, single hue. */
export function horizontalBars(
  items: NamedValue[],
  options: { format?: ValueFormat; color?: string; labelWidth?: number } = {},
): EChartsCoreOption {
  const format = options.format ?? "hours";
  const reversed = [...items].reverse(); // largest on top
  return {
    tooltip: {
      trigger: "item",
      ...TOOLTIP_STYLE,
      formatter: (p: { name: string; value: number; dataIndex: number }) => {
        const item = reversed[p.dataIndex];
        const detail = item?.detail
          ? `<br/><span style="color:${INK_2};font-size:11px">${escapeHtml(item.detail)}</span>`
          : "";
        return `<strong>${fmt(p.value, format)}</strong>&nbsp;&nbsp;<span style="color:${INK_2}">${escapeHtml(p.name)}</span>${detail}`;
      },
    },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (v: number) => (format === "percent" ? `${v}%` : formatHours(v)),
      },
      splitLine: SPLIT_LINE,
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: reversed.map((i) => i.name),
      axisLabel: {
        ...AXIS_LABEL,
        color: INK_2,
        width: options.labelWidth ?? 150,
        overflow: "truncate" as const,
      },
      axisLine: AXIS_LINE,
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: reversed.map((i) => i.value),
        barMaxWidth: 18,
        barCategoryGap: "40%",
        itemStyle: {
          color: options.color ?? SERIES[0],
          borderRadius: [0, 4, 4, 0],
        },
        emphasis: { itemStyle: { color: options.color ?? SERIES[0], opacity: 0.85 } },
        label: {
          show: true,
          position: "right" as const,
          color: INK,
          fontFamily: FONT,
          fontSize: 11,
          formatter: (p: { value: number }) => fmt(p.value, format),
        },
      },
    ],
  };
}

/** Donut for a small part-to-whole split (≤ 6 segments). Color follows entity. */
export function donut(
  items: NamedValue[],
  options: { colors?: Record<string, string> } = {},
): EChartsCoreOption {
  const colors = options.colors ?? ENTITY_COLORS;
  return {
    tooltip: {
      trigger: "item",
      ...TOOLTIP_STYLE,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `<strong>${formatHours(p.value)}</strong> (${p.percent.toFixed(1)}%)&nbsp;&nbsp;<span style="color:${INK_2}">${p.name}</span>`,
    },
    legend: {
      bottom: 0,
      icon: "rect",
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: INK_2, fontFamily: FONT, fontSize: 12 },
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "70%"],
        center: ["50%", "47%"],
        avoidLabelOverlap: true,
        // 2px surface gap between segments via a surface-colored border.
        itemStyle: { borderColor: SURFACE, borderWidth: 2, borderRadius: 3 },
        label: {
          show: true,
          color: INK_2,
          fontFamily: FONT,
          fontSize: 11,
          formatter: (p: { name: string; percent: number }) =>
            `${p.name}  ${p.percent.toFixed(0)}%`,
        },
        labelLine: { lineStyle: { color: "#c3c2b7" } },
        data: items.map((i, idx) => ({
          name: i.name,
          value: i.value,
          itemStyle: { color: colors[i.name] ?? SERIES[idx % SERIES.length] },
        })),
      },
    ],
  };
}

export interface CompositionBarSegment {
  key: string;
  hours: number;
  shareOfTotal: number;
  color: string;
  /** Extra tooltip line (e.g. "Click to see category breakdown"). */
  hint?: string;
}

/**
 * Single-row 100% stacked horizontal bar for the hours composition.
 * Segments are separated by a 2px surface gap; tooltips lead with the value
 * and its share of Total Hours.
 */
export function compositionBar(
  segments: CompositionBarSegment[],
): EChartsCoreOption {
  const visible = segments.filter((s) => s.hours > 0);
  return {
    tooltip: {
      trigger: "item",
      ...TOOLTIP_STYLE,
      formatter: (p: { seriesName: string }) => {
        const seg = segments.find((s) => s.key === p.seriesName);
        if (!seg) return "";
        const hint = seg.hint
          ? `<br/><span style="color:${INK_2};font-size:11px">${escapeHtml(seg.hint)}</span>`
          : "";
        return `<strong>${escapeHtml(seg.key)} Hours</strong><br/>${formatHours(seg.hours)} hrs<br/><span style="color:${INK_2}">${formatPercent(seg.shareOfTotal)} of Total Hours</span>${hint}`;
      },
    },
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: "value", max: 100, show: false },
    yAxis: { type: "category", data: [""], show: false },
    series: visible.map((seg, i) => ({
      name: seg.key,
      type: "bar" as const,
      stack: "total",
      barWidth: 22,
      data: [seg.shareOfTotal],
      itemStyle: {
        color: seg.color,
        // 2px surface gap between stacked segments; rounded data-ends on the
        // outermost segments only.
        borderColor: SURFACE,
        borderWidth: 1,
        borderRadius:
          i === 0
            ? ([4, 0, 0, 4] as [number, number, number, number])
            : i === visible.length - 1
              ? ([0, 4, 4, 0] as [number, number, number, number])
              : 0,
      },
      emphasis: { itemStyle: { opacity: 0.85 } },
    })),
  };
}

export interface TrendSeries {
  name: string;
  values: number[];
  color: string;
}

/** Multi-series line chart over months — 2px lines, ringed ≥8px markers, one axis. */
export function trendLines(
  months: string[],
  series: TrendSeries[],
  options: { format?: ValueFormat } = {},
): EChartsCoreOption {
  const format = options.format ?? "hours";
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: "#c3c2b7", width: 1 } },
      ...TOOLTIP_STYLE,
      valueFormatter: (v: number) => fmt(v, format),
    },
    legend:
      series.length > 1
        ? {
            top: 0,
            icon: "path://M0,6 L20,6 L20,8 L0,8 Z", // short line key
            itemWidth: 18,
            itemHeight: 8,
            textStyle: { color: INK_2, fontFamily: FONT, fontSize: 12 },
          }
        : undefined,
    grid: { left: 8, right: 24, top: series.length > 1 ? 36 : 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: months,
      boundaryGap: false,
      axisLabel: AXIS_LABEL,
      axisLine: AXIS_LINE,
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      max: format === "percent" ? 100 : undefined,
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (v: number) => (format === "percent" ? `${v}%` : formatHours(v)),
      },
      splitLine: SPLIT_LINE,
      axisLine: { show: false },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line" as const,
      data: s.values,
      lineStyle: { width: 2, color: s.color },
      itemStyle: {
        color: s.color,
        borderColor: SURFACE, // 2px surface ring on markers
        borderWidth: 2,
      },
      symbol: "circle",
      symbolSize: 9,
      emphasis: { scale: 1.3 },
    })),
  };
}

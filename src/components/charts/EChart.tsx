"use client";

import * as React from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption, ECharts } from "echarts/core";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

/** Thin React wrapper around ECharts with resize handling and click events. */
export function EChart({
  option,
  height = 280,
  onClick,
  ariaLabel,
}: {
  option: EChartsCoreOption;
  height?: number;
  onClick?: (params: { seriesName?: string; name?: string; value?: unknown }) => void;
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<ECharts | null>(null);
  const clickRef = React.useRef(onClick);
  React.useEffect(() => {
    clickRef.current = onClick;
  });

  React.useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    chart.on("click", (params) =>
      clickRef.current?.(params as { seriesName?: string; name?: string; value?: unknown }),
    );
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      style={{ height, width: "100%" }}
    />
  );
}

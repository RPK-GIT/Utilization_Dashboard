import { describe, expect, it } from "vitest";
import { classifyRows } from "@/core/classify/engine";
import {
  allowedVisualizations,
  computeExplorer,
  explorerMetric,
  EXPLORER_METRICS,
} from "@/core/metrics/explorer";
import { applyFilters } from "@/core/filters/engine";
import { EMPTY_FILTERS } from "@/core/types";
import { scenarioRows, testConfig, IP_TEAM_MEMBER } from "./fixtures/rows";

const PERIOD = "2026-07";

function setup() {
  const config = testConfig();
  const rows = classifyRows(scenarioRows(), config, PERIOD);
  return { config, rows };
}

describe("visualization registry (context-aware)", () => {
  it("Total Hours never offers pie or donut", () => {
    const def = explorerMetric("total_hours");
    expect(def.visualizations).not.toContain("pie");
    expect(def.visualizations).not.toContain("donut");
    expect(def.visualizations).toEqual(
      expect.arrayContaining(["kpi", "horizontalBar", "verticalBar", "line", "table"]),
    );
  });

  it("IP Hours supports the full set where meaningful", () => {
    const def = explorerMetric("ip_hours");
    for (const v of ["kpi", "donut", "pie", "horizontalBar", "verticalBar", "line", "table"]) {
      expect(def.visualizations).toContain(v);
    }
  });

  it("line charts are only allowed on the Month dimension", () => {
    const def = explorerMetric("ip_hours");
    expect(allowedVisualizations(def, "employee")).not.toContain("line");
    expect(allowedVisualizations(def, "month")).toContain("line");
  });

  it("every metric's defaults are self-consistent", () => {
    for (const def of EXPLORER_METRICS) {
      expect(def.dimensions).toContain(def.defaultDimension);
      expect(def.visualizations).toContain(def.defaultVisualization);
    }
  });
});

describe("explorer bucket computation", () => {
  it("IP Hours by employee buckets match the metric engine", () => {
    const { config, rows } = setup();
    const result = computeExplorer(rows, "ip_hours", "employee", config);
    // IP rows: DTEC 5 (Ivy) + 2PC 2.5 (Devon).
    expect(result.metricHours).toBeCloseTo(7.5);
    expect(result.buckets.map((b) => [b.label, b.hours])).toEqual([
      [IP_TEAM_MEMBER, 5],
      ["Devon Developer", 2.5],
    ]);
    expect(result.buckets[0].nav).toEqual({ kind: "employee", value: IP_TEAM_MEMBER });
    const shareSum = result.buckets.reduce((a, b) => a + b.share, 0);
    expect(shareSum).toBeCloseTo(100);
  });

  it("activity dimension is description-first with a code drilldown", () => {
    const { config, rows } = setup();
    const result = computeExplorer(rows, "ip_hours", "activity", config);
    const dtec = result.buckets.find((b) => b.key === "DTEC")!;
    expect(dtec.label).toBe("Digital Time entry Cockpit Simplified");
    expect(dtec.nav).toEqual({ kind: "code", value: "DTEC" });
  });

  it("billable split contrasts Billable with Non-Billable = Total − Billable", () => {
    const { config, rows } = setup();
    const result = computeExplorer(rows, "billable_hours", "billableSplit", config);
    const billable = result.buckets.find((b) => b.key === "Billable")!;
    const nonBillable = result.buckets.find((b) => b.key === "Non-Billable")!;
    expect(billable.hours).toBeCloseTo(7);
    expect(nonBillable.hours).toBeCloseTo(36 - 7);
    expect(billable.share + nonBillable.share).toBeCloseTo(100);
  });

  it("productive composition splits into Billable + productive categories", () => {
    const { config, rows } = setup();
    const result = computeExplorer(rows, "productive_hours", "productiveComposition", config);
    const byKey = Object.fromEntries(result.buckets.map((b) => [b.key, b.hours]));
    expect(byKey.Billable).toBeCloseTo(7);
    expect(byKey.IP).toBeCloseTo(7.5);
    expect(byKey.Accelerator).toBeCloseTo(6);
    const sum = result.buckets.reduce((a, b) => a + b.hours, 0);
    expect(sum).toBeCloseTo(result.metricHours);
  });

  it("month dimension sorts chronologically with period labels", () => {
    const { config, rows } = setup();
    const result = computeExplorer(rows, "total_hours", "month", config);
    expect(result.buckets[0].label).toBe("July 2026");
    expect(result.buckets[0].nav).toEqual({ kind: "month", value: "2026-07" });
  });

  it("uses the same filtered scope as everything else", () => {
    const { config, rows } = setup();
    const scoped = applyFilters(rows, {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team"],
    });
    const result = computeExplorer(scoped, "ip_hours", "employee", config);
    expect(result.metricHours).toBeCloseTo(5); // only Ivy's DTEC row
    expect(result.buckets).toHaveLength(1);
    expect(result.scopeHours).toBeCloseTo(10.5);
  });

  it("visualization choice never changes the numbers — buckets are viz-agnostic", () => {
    const { config, rows } = setup();
    // The same (metric, dimension) resolution feeds every chart type.
    const a = computeExplorer(rows, "ip_hours", "employee", config);
    const b = computeExplorer(rows, "ip_hours", "employee", config);
    expect(a).toEqual(b);
  });
});

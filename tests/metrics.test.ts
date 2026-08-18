import { describe, expect, it } from "vitest";
import { classifyRows } from "@/core/classify/engine";
import {
  computeComposition,
  computeKpis,
  kpiValue,
  summarizeEmployees,
} from "@/core/metrics/engine";
import { applyFilters } from "@/core/filters/engine";
import { EMPTY_FILTERS } from "@/core/types";
import { monthlyTrend, summarizeCodes } from "@/core/metrics/aggregate";
import { row, scenarioRows, testConfig, IP_TEAM_MEMBER, DEV_TEAM_MEMBER } from "./fixtures/rows";

const PERIOD = "2026-07";

function classifiedScenario() {
  const config = testConfig();
  return { config, rows: classifyRows(scenarioRows(), config, PERIOD) };
}

describe("KPI engine", () => {
  it("computes hour KPIs from classified rows", () => {
    const { config, rows } = classifiedScenario();
    const kpis = computeKpis(rows, config);
    // Scenario: billable 4+3; dev IP 5 (DTEC) + 2.5 (2PC); accel 6 (MSLM);
    // learning 1.5; unknown 7; excluded 2; C9 1; unclassified 4.
    expect(kpiValue(kpis, "total_hours")).toBeCloseTo(36);
    expect(kpiValue(kpis, "billable_hours")).toBeCloseTo(7);
    expect(kpiValue(kpis, "ip_hours")).toBeCloseTo(7.5);
    expect(kpiValue(kpis, "accelerator_hours")).toBeCloseTo(6);
    expect(kpiValue(kpis, "development_hours")).toBeCloseTo(22);
    expect(kpiValue(kpis, "productive_hours")).toBeCloseTo(7 + 7.5 + 6);
  });

  it("computes percentages as ratios of sums, never averages of percentages", () => {
    const config = testConfig();
    // Employee A: 1h billable of 1h (100%); Employee B: 1h billable of 9h (11.1%).
    // Correct overall: 2/10 = 20%. Naive average would be 55.6%.
    const rows = classifyRows(
      [
        row({ employee: "A", wbs: "0004A11111-001.01-001", hours: 1 }),
        row({ employee: "B", wbs: "0004A11111-001.01-001", hours: 1 }),
        row({ employee: "B", wbs: "0004I00021-002.01-001", hours: 8, shortText: "LEAR x" }),
      ],
      config,
      PERIOD,
    );
    const kpis = computeKpis(rows, config);
    expect(kpiValue(kpis, "billable_percentage")).toBeCloseTo(20);
  });

  it("productive hours never double-count a row", () => {
    const { config, rows } = classifiedScenario();
    const kpis = computeKpis(rows, config);
    const productive = kpiValue(kpis, "productive_hours");
    const manual = rows.filter((r) => r.isProductive).reduce((a, r) => a + r.hours, 0);
    expect(productive).toBeCloseTo(manual);
    expect(productive).toBeLessThanOrEqual(kpiValue(kpis, "total_hours"));
  });

  it("team hour KPIs respond to team configuration changes", () => {
    const config = testConfig();
    const rows = classifyRows(scenarioRows(), config, PERIOD);
    const before = computeKpis(rows, config);
    // IP team member logged 4 + 5 + 1.5 = 10.5 in the scenario.
    expect(kpiValue(before, "ip_delivery_hours")).toBeCloseTo(10.5);

    const changed = testConfig();
    changed.teams[0].members = [DEV_TEAM_MEMBER];
    const reclassified = classifyRows(scenarioRows(), changed, PERIOD);
    const after = computeKpis(reclassified, changed);
    expect(kpiValue(after, "ip_delivery_hours")).toBeCloseTo(36 - 10.5);
  });

  it("disabled KPIs are omitted", () => {
    const { config, rows } = classifiedScenario();
    config.kpis = config.kpis.map((k) =>
      k.id === "accelerator_hours" ? { ...k, enabled: false } : k,
    );
    const kpis = computeKpis(rows, config);
    expect(kpis.find((k) => k.id === "accelerator_hours")).toBeUndefined();
  });

  it("returns zero percentages for empty scopes instead of NaN", () => {
    const { config } = classifiedScenario();
    const kpis = computeKpis([], config);
    expect(kpiValue(kpis, "billable_percentage")).toBe(0);
    expect(kpiValue(kpis, "productive_percentage")).toBe(0);
  });
});

describe("hours composition", () => {
  it("segments always sum to Total Hours and 100%", () => {
    const { config, rows } = classifiedScenario();
    const comp = computeComposition(rows, config.categories);
    // Scenario: total 36; billable 7; IP 7.5; accelerator 6; other 15.5
    // (learning 1.5 + unknown 7 + excluded 2 + C9 1 + unclassified 4).
    expect(comp.totalHours).toBeCloseTo(36);
    const byKey = Object.fromEntries(comp.segments.map((s) => [s.key, s]));
    expect(byKey.Billable.hours).toBeCloseTo(7);
    expect(byKey.IP.hours).toBeCloseTo(7.5);
    expect(byKey.Accelerator.hours).toBeCloseTo(6);
    expect(byKey.Other.hours).toBeCloseTo(15.5);
    expect(comp.otherHours).toBeCloseTo(
      comp.totalHours - 7 - 7.5 - 6, // Other = Total − Billable − IP − Accelerator
    );
    const shareSum = comp.segments.reduce((a, s) => a + s.shareOfTotal, 0);
    expect(shareSum).toBeCloseTo(100);
    const hourSum = comp.segments.reduce((a, s) => a + s.hours, 0);
    expect(hourSum).toBeCloseTo(comp.totalHours);
    expect(comp.reconciles).toBe(true);
    expect(comp.difference).toBeCloseTo(0);
  });

  it("Productive Hours equals Billable + productive-category segments", () => {
    const { config, rows } = classifiedScenario();
    const comp = computeComposition(rows, config.categories);
    const kpis = computeKpis(rows, config);
    const productiveFromSegments = comp.segments
      .filter((s) => s.kind !== "other")
      .reduce((a, s) => a + s.hours, 0);
    expect(productiveFromSegments).toBeCloseTo(kpiValue(kpis, "productive_hours"));
  });

  it("responds to filters — composition is never hardcoded", () => {
    const { config, rows } = classifiedScenario();
    const scoped = applyFilters(rows, {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team"],
    });
    const comp = computeComposition(scoped, config.categories);
    // IP team: billable 4, IP 5 (DTEC), learning 1.5 → other 1.5.
    expect(comp.totalHours).toBeCloseTo(10.5);
    expect(comp.segments.find((s) => s.key === "Billable")!.hours).toBeCloseTo(4);
    expect(comp.otherHours).toBeCloseTo(1.5);
    expect(comp.reconciles).toBe(true);
  });

  it("a newly configured productive category flows through automatically", () => {
    const config = testConfig();
    // Admin marks Learning productive: its hours leave Other with no code change.
    config.categories = config.categories.map((c) =>
      c.name === "Learning" ? { ...c, productive: true } : c,
    );
    const rows = classifyRows(scenarioRows(), config, PERIOD);
    const comp = computeComposition(rows, config.categories);
    const learning = comp.segments.find((s) => s.key === "Learning");
    expect(learning?.hours).toBeCloseTo(1.5);
    expect(comp.otherHours).toBeCloseTo(15.5 - 1.5);
    expect(comp.reconciles).toBe(true);
  });

  it("returns zeros for an empty scope without NaN", () => {
    const { config } = classifiedScenario();
    const comp = computeComposition([], config.categories);
    expect(comp.totalHours).toBe(0);
    expect(comp.segments.every((s) => s.shareOfTotal === 0)).toBe(true);
    expect(comp.reconciles).toBe(true);
  });
});

describe("employee summaries", () => {
  it("computes per-employee utilization with individual percentages", () => {
    const { config, rows } = classifiedScenario();
    void config;
    const summaries = summarizeEmployees(rows);
    const ip = summaries.find((s) => s.employee === IP_TEAM_MEMBER)!;
    expect(ip.totalHours).toBeCloseTo(10.5);
    expect(ip.billableHours).toBeCloseTo(4);
    expect(ip.billablePercentage).toBeCloseTo((4 / 10.5) * 100);
    expect(ip.team).toBe("IP Delivery Team");
  });
});

describe("code and trend aggregations", () => {
  it("summarizes codes including unknown candidates", () => {
    const { rows } = classifiedScenario();
    const codes = summarizeCodes(rows);
    const dtec = codes.find((c) => c.code === "DTEC")!;
    expect(dtec.hours).toBeCloseTo(5);
    expect(dtec.category).toBe("IP");
    const unknown = codes.find((c) => c.code === "AIUG")!;
    expect(unknown.category).toBe("Unknown");
    const shareSum = codes.reduce((a, c) => a + c.shareOfDevelopment, 0);
    expect(shareSum).toBeCloseTo(100);
  });

  it("builds monthly trend points from row months", () => {
    const config = testConfig();
    const rows = classifyRows(
      [
        row({ date: "2026-07-10", wbs: "0004A11111-001.01-001", hours: 2 }),
        row({ date: "2026-08-10", wbs: "0004I00021-002.01-001", hours: 3, shortText: "DTEC y" }),
      ],
      config,
      PERIOD,
    );
    const trend = monthlyTrend(rows);
    expect(trend.map((t) => t.month)).toEqual(["2026-07", "2026-08"]);
    expect(trend[0].billablePercentage).toBeCloseTo(100);
    expect(trend[1].ipHours).toBeCloseTo(3);
  });
});

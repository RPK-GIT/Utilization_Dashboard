import { describe, expect, it } from "vitest";
import { classifyRows } from "@/core/classify/engine";
import { applyFilters, filterChips, hasActiveFilters, removeChip } from "@/core/filters/engine";
import { computeKpis, kpiValue } from "@/core/metrics/engine";
import { EMPTY_FILTERS } from "@/core/types";
import { periodLabel } from "@/core/format";
import { scenarioRows, testConfig, IP_TEAM_MEMBER } from "./fixtures/rows";

const PERIOD = "2026-07";

function setup() {
  const config = testConfig();
  const rows = classifyRows(scenarioRows(), config, PERIOD);
  return { config, rows };
}

describe("filter engine", () => {
  it("team filter restricts every KPI consistently", () => {
    const { config, rows } = setup();
    const filtered = applyFilters(rows, {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team"],
    });
    expect(filtered.every((r) => r.team === "IP Delivery Team")).toBe(true);
    const kpis = computeKpis(filtered, config);
    expect(kpiValue(kpis, "total_hours")).toBeCloseTo(10.5);
    expect(kpiValue(kpis, "billable_hours")).toBeCloseTo(4);
  });

  it("employee filter works", () => {
    const { rows } = setup();
    const filtered = applyFilters(rows, {
      ...EMPTY_FILTERS,
      employees: [IP_TEAM_MEMBER],
    });
    expect(filtered.every((r) => r.employee === IP_TEAM_MEMBER)).toBe(true);
  });

  it("category filter selects rows by development category", () => {
    const { rows } = setup();
    const filtered = applyFilters(rows, { ...EMPTY_FILTERS, categories: ["IP"] });
    // DTEC (IP) and 2PC (IP) rows
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.developmentCode).sort()).toEqual(["2PC", "DTEC"]);
  });

  it("code filter recalculates KPIs using only matching rows", () => {
    const { config, rows } = setup();
    const filtered = applyFilters(rows, { ...EMPTY_FILTERS, codes: ["MSLM"] });
    const kpis = computeKpis(filtered, config);
    expect(kpiValue(kpis, "total_hours")).toBeCloseTo(6);
    expect(kpiValue(kpis, "accelerator_hours")).toBeCloseTo(6);
  });

  it("period and date-range filters work", () => {
    const { rows } = setup();
    expect(applyFilters(rows, { ...EMPTY_FILTERS, periods: ["2026-07"] })).toHaveLength(
      rows.length,
    );
    expect(applyFilters(rows, { ...EMPTY_FILTERS, periods: ["2026-08"] })).toHaveLength(0);
    const ranged = applyFilters(rows, {
      ...EMPTY_FILTERS,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });
    expect(ranged).toHaveLength(rows.length);
  });

  it("search matches WBS, employee and description case-insensitively", () => {
    const { rows } = setup();
    expect(applyFilters(rows, { ...EMPTY_FILTERS, search: "dtec" })).toHaveLength(1);
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, search: "0085I" }).length,
    ).toBeGreaterThan(0);
  });

  it("chips reflect active filters and can be removed", () => {
    const filters = {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team"],
      codes: ["DTEC"],
      periods: ["2026-07"],
    };
    expect(hasActiveFilters(filters)).toBe(true);
    const chips = filterChips(filters, periodLabel, (code) =>
      code === "DTEC" ? "Digital Time entry Cockpit Simplified (DTEC)" : code,
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Period: July 2026",
      "Team: IP Delivery Team",
      "Activity: Digital Time entry Cockpit Simplified (DTEC)",
    ]);
    const without = removeChip(filters, chips[1]);
    expect(without.teams).toEqual([]);
    expect(without.codes).toEqual(["DTEC"]);
  });
});

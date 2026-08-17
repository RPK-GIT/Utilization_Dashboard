import { describe, expect, it } from "vitest";
import { classifyRows } from "@/core/classify/engine";
import {
  applyFilters,
  filterChips,
  hasActiveFilters,
  removeChip,
  validateDateRange,
} from "@/core/filters/engine";
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

  it("multiple values within one dimension combine with OR", () => {
    const { rows } = setup();
    const both = applyFilters(rows, {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team", "Development Team"],
    });
    expect(both).toHaveLength(rows.length);

    const twoCodes = applyFilters(rows, {
      ...EMPTY_FILTERS,
      codes: ["DTEC", "MSLM"],
    });
    expect(twoCodes.map((r) => r.developmentCode).sort()).toEqual(["DTEC", "MSLM"]);
  });

  it("different dimensions combine with AND", () => {
    const { rows } = setup();
    // Team OR-list AND category OR-list: only development rows in IP or
    // Accelerator categories belonging to either team.
    const combined = applyFilters(rows, {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team", "Development Team"],
      categories: ["IP", "Accelerator"],
    });
    expect(combined).toHaveLength(3); // DTEC, MSLM, 2PC rows
    // Narrowing team to IP Delivery keeps only its IP row (DTEC).
    const narrowed = applyFilters(rows, {
      ...EMPTY_FILTERS,
      teams: ["IP Delivery Team"],
      categories: ["IP", "Accelerator"],
    });
    expect(narrowed.map((r) => r.developmentCode)).toEqual(["DTEC"]);
  });

  it("date range validation: To must not be earlier than From", () => {
    expect(validateDateRange("2026-08-01", "2026-08-31").ok).toBe(true);
    expect(validateDateRange("2026-08-01", "2026-08-01").ok).toBe(true); // same day
    const invalid = validateDateRange("2026-08-31", "2026-08-01");
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toMatch(/cannot be earlier than From Date/);
    // Open-ended and empty ranges are valid.
    expect(validateDateRange("2026-08-01", null).ok).toBe(true);
    expect(validateDateRange(null, "2026-08-31").ok).toBe(true);
    expect(validateDateRange(null, null).ok).toBe(true);
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

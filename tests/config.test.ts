import { describe, expect, it } from "vitest";
import { appConfigSchema, bumpVersion } from "@/core/config/schema";
import { DEFAULT_CONFIG } from "@/core/config/defaults";
import {
  buildSnapshotPayload,
  injectPayload,
  serializePayload,
  snapshotFileName,
  SNAPSHOT_PLACEHOLDER,
} from "@/core/snapshot/build";
import { classifyRows } from "@/core/classify/engine";
import { EMPTY_FILTERS, type Dataset } from "@/core/types";
import { scenarioRows, testConfig } from "./fixtures/rows";

describe("configuration schema", () => {
  it("accepts the default configuration", () => {
    expect(appConfigSchema.safeParse(DEFAULT_CONFIG).success).toBe(true);
  });

  it("uppercases codes on parse", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.codes[0].code = "dtec";
    const parsed = appConfigSchema.parse(config);
    expect(parsed.codes[0].code).toBe("DTEC");
  });

  it("requires exactly one active catch-all team", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.teams = config.teams.map((t) => ({ ...t, catchAll: false }));
    expect(appConfigSchema.safeParse(config).success).toBe(false);
  });

  it("bumps versions correctly", () => {
    expect(bumpVersion("v1.0")).toBe("v1.1");
    expect(bumpVersion("v1.9")).toBe("v1.10");
    expect(bumpVersion("garbage")).toBe("v1.0");
  });
});

describe("snapshot payload", () => {
  function makeDataset(): Dataset {
    const config = testConfig();
    const rows = scenarioRows();
    const classified = classifyRows(rows, config, "2026-07");
    return {
      id: "ds-1",
      period: "2026-07",
      periodLabel: "July 2026",
      fileName: "EXPORT.xlsx",
      sheetName: "Sheet1",
      uploadedAt: "2026-08-17T10:00:00.000Z",
      processedAt: "2026-08-17T10:00:00.000Z",
      configVersion: config.version,
      configSnapshot: config,
      rows,
      classified,
      validation: {
        fileName: "EXPORT.xlsx",
        sheetName: "Sheet1",
        recordCount: rows.length,
        dateRange: { from: "2026-07-01", to: "2026-07-31" },
        employeeCount: 2,
        totalHours: 36,
        billableCandidateRows: 2,
        developmentCandidateRows: 5,
        unknownDevelopmentCodes: [],
        missingWbs: 0,
        missingEmployee: 0,
        missingHours: 0,
        missingShortDescription: 0,
        zeroHourRows: 0,
        duplicateRows: 0,
        unclassifiedRows: 1,
      },
      status: "Validated",
    };
  }

  it("freezes rows and embeds only the config subset needed for display", () => {
    const dataset = makeDataset();
    const payload = buildSnapshotPayload({
      datasets: [dataset],
      config: testConfig(),
      filters: { ...EMPTY_FILTERS, teams: ["IP Delivery Team"] },
      scope: "current-view",
      generatedAt: "2026-08-17T12:00:00.000Z",
    });
    expect(payload.rows).toHaveLength(dataset.classified.length);
    expect(payload.initialFilters.teams).toEqual(["IP Delivery Team"]);
    expect(payload.periodLabel).toBe("July 2026");
    // Billable rules are interpretation logic already baked into rows; the
    // admin-facing rule model is not part of the payload.
    expect(
      (payload.config as unknown as Record<string, unknown>).billableRules,
    ).toBeUndefined();
    expect(payload.config.teams.length).toBeGreaterThan(0);
  });

  it("full scope clears the initial filters", () => {
    const payload = buildSnapshotPayload({
      datasets: [makeDataset()],
      config: testConfig(),
      filters: { ...EMPTY_FILTERS, codes: ["DTEC"] },
      scope: "full",
      generatedAt: "2026-08-17T12:00:00.000Z",
    });
    expect(payload.initialFilters).toEqual(EMPTY_FILTERS);
  });

  it("injects serialized payload into the template placeholder", () => {
    const payload = buildSnapshotPayload({
      datasets: [makeDataset()],
      config: testConfig(),
      filters: EMPTY_FILTERS,
      scope: "full",
      generatedAt: "2026-08-17T12:00:00.000Z",
    });
    const template = `<html><body>${SNAPSHOT_PLACEHOLDER}<div id="root"></div></body></html>`;
    const html = injectPayload(template, payload);
    expect(html).not.toContain(SNAPSHOT_PLACEHOLDER);
    expect(html).toContain('"periodLabel":"July 2026"');
    expect(() => injectPayload("<html></html>", payload)).toThrow(/placeholder/);
  });

  it("escapes closing script tags in serialized data", () => {
    const payload = buildSnapshotPayload({
      datasets: [makeDataset()],
      config: testConfig(),
      filters: EMPTY_FILTERS,
      scope: "full",
      generatedAt: "2026-08-17T12:00:00.000Z",
    });
    payload.rows[0].shortText = "bad </script> attempt";
    expect(serializePayload(payload)).not.toContain("</script>");
  });

  it("derives a clean snapshot file name", () => {
    const payload = buildSnapshotPayload({
      datasets: [makeDataset()],
      config: testConfig(),
      filters: EMPTY_FILTERS,
      scope: "full",
      generatedAt: "2026-08-17T12:00:00.000Z",
    });
    expect(snapshotFileName(payload)).toBe(
      "Utilization_Executive_Snapshot_July_2026.html",
    );
  });
});

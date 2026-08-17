import { describe, expect, it } from "vitest";
import {
  classifyRows,
  evaluateBillability,
  extractCode,
} from "@/core/classify/engine";
import { row, scenarioRows, testConfig, IP_TEAM_MEMBER, DEV_TEAM_MEMBER } from "./fixtures/rows";

const PERIOD = "2026-07";

describe("billable WBS rules (configuration-driven)", () => {
  it("classifies 0004A and 0004C prefixes as billable", () => {
    const config = testConfig();
    expect(evaluateBillability("0004A20078-011.02-005", config).isBillable).toBe(true);
    expect(evaluateBillability("0004C30001-001.01-001", config).isBillable).toBe(true);
  });

  it("rejects when the character after the prefix is a forbidden character (0004A9/0004C9)", () => {
    const config = testConfig();
    const a9 = evaluateBillability("0004A91234-001.01-001", config);
    expect(a9.isBillable).toBe(false);
    expect(a9.reason).toMatch(/secondary WBS validation failed/);
    expect(evaluateBillability("0004C91234-001.01-001", config).isBillable).toBe(false);
  });

  it("rejects explicitly excluded WBS elements", () => {
    const config = testConfig();
    config.billableRules.nextCharacterMustNotBe = []; // isolate the exclusion rule
    const result = evaluateBillability("0004A99999-008.02-900", config);
    expect(result.isBillable).toBe(false);
    expect(result.reason).toMatch(/explicitly excluded/);
  });

  it("changing allowed prefixes changes classification without code changes", () => {
    const config = testConfig();
    config.billableRules.allowedPrefixes = ["0009X"];
    expect(evaluateBillability("0004A20078-011.02-005", config).isBillable).toBe(false);
    expect(evaluateBillability("0009X12345-001.01-001", config).isBillable).toBe(true);
  });

  it("adding/removing exclusions affects billability", () => {
    const config = testConfig();
    const wbs = "0004A11111-001.01-001";
    expect(evaluateBillability(wbs, config).isBillable).toBe(true);
    config.billableRules.excludedWbs = [...config.billableRules.excludedWbs, wbs];
    expect(evaluateBillability(wbs, config).isBillable).toBe(false);
  });

  it("respects configured forbidden next characters", () => {
    const config = testConfig();
    config.billableRules.nextCharacterMustNotBe = ["8"];
    expect(evaluateBillability("0004A91234-001.01-001", config).isBillable).toBe(true);
    expect(evaluateBillability("0004A81234-001.01-001", config).isBillable).toBe(false);
  });
});

describe("development WBS rules", () => {
  it("classifies configured development prefixes", () => {
    const config = testConfig();
    const [classified] = classifyRows(
      [row({ wbs: "0004I00021-002.01-001", shortText: "DTEC work" })],
      config,
      PERIOD,
    );
    expect(classified.isDevelopment).toBe(true);
    expect(classified.classification).toBe("Development");
  });

  it("respects changed development prefixes", () => {
    const config = testConfig();
    config.developmentRules.allowedPrefixes = ["0085I"];
    const rows = classifyRows(
      [
        row({ wbs: "0004I00021-002.01-001", shortText: "DTEC work" }),
        row({ wbs: "0085I00001-001.01-001", shortText: "DTEC work" }),
      ],
      config,
      PERIOD,
    );
    expect(rows[0].isDevelopment).toBe(false);
    expect(rows[0].classification).toBe("Unclassified");
    expect(rows[1].isDevelopment).toBe(true);
  });
});

describe("development code extraction", () => {
  const config = testConfig();

  it("extracts trim → uppercase → first 4 characters", () => {
    expect(extractCode("  dtec development ", config.codes).definition?.code).toBe("DTEC");
  });

  it("normalizes case: mslm equals MSLM", () => {
    const lower = extractCode("mslm shelf life", config.codes);
    const upper = extractCode("MSLM SHELF LIFE", config.codes);
    expect(lower.definition?.code).toBe("MSLM");
    expect(upper.definition?.code).toBe("MSLM");
  });

  it("matches shorter configured codes followed by a delimiter (2PC:)", () => {
    const result = extractCode("2PC: Partner Co-Pilot", config.codes);
    expect(result.definition?.code).toBe("2PC");
  });

  it("does not match shorter codes embedded in longer tokens", () => {
    // "2PCX" must not resolve to "2PC"
    const result = extractCode("2PCX something", config.codes);
    expect(result.definition).toBeNull();
  });

  it("returns the candidate for unknown codes", () => {
    const result = extractCode("AIUG user group", config.codes);
    expect(result.definition).toBeNull();
    expect(result.candidate).toBe("AIUG");
  });

  it("ignores inactive codes", () => {
    const codes = config.codes.map((c) =>
      c.code === "DTEC" ? { ...c, active: false } : c,
    );
    expect(extractCode("DTEC work", codes).definition).toBeNull();
  });

  it("a newly added code is recognized without any component changes", () => {
    const codes = [
      ...config.codes,
      { code: "XYZ1", description: "New Thing", category: "IP", active: true },
    ];
    expect(extractCode("XYZ1 new thing build", codes).definition?.description).toBe(
      "New Thing",
    );
  });
});

describe("team assignment", () => {
  it("assigns configured members and catch-all correctly", () => {
    const config = testConfig();
    const rows = classifyRows(
      [row({ employee: IP_TEAM_MEMBER }), row({ employee: DEV_TEAM_MEMBER })],
      config,
      PERIOD,
    );
    expect(rows[0].team).toBe("IP Delivery Team");
    expect(rows[1].team).toBe("Development Team");
  });

  it("moving an employee between teams changes assignment", () => {
    const config = testConfig();
    config.teams[0].members = [];
    config.teams.push({
      id: "new-team",
      name: "Platform Team",
      members: [IP_TEAM_MEMBER],
      catchAll: false,
      active: true,
    });
    const [classified] = classifyRows([row({ employee: IP_TEAM_MEMBER })], config, PERIOD);
    expect(classified.team).toBe("Platform Team");
  });

  it("matches members case-insensitively with trimmed whitespace", () => {
    const config = testConfig();
    const [classified] = classifyRows(
      [row({ employee: `  ${IP_TEAM_MEMBER.toUpperCase()}  ` })],
      config,
      PERIOD,
    );
    expect(classified.team).toBe("IP Delivery Team");
  });
});

describe("classification reasons and derived fields", () => {
  it("produces human-readable traceability for every scenario", () => {
    const config = testConfig();
    const rows = classifyRows(scenarioRows(), config, PERIOD);
    const reasons = rows.map((r) => r.classificationReason);
    expect(reasons[0]).toBe("Billable - WBS matched 0004A rule");
    expect(reasons[1]).toBe("Billable - WBS matched 0004C rule");
    expect(reasons[2]).toMatch(/Excluded - WBS/);
    expect(reasons[3]).toMatch(/secondary WBS validation failed/);
    expect(reasons[4]).toMatch(/code DTEC mapped to IP/);
    expect(reasons[5]).toMatch(/code MSLM mapped to Accelerator/);
    expect(reasons[7]).toMatch(/unknown development code 'AIUG'/);
    expect(reasons[9]).toMatch(/Other \/ Unclassified/);
  });

  it("flags productivity: billable + productive categories only", () => {
    const config = testConfig();
    const rows = classifyRows(scenarioRows(), config, PERIOD);
    expect(rows[0].isProductive).toBe(true); // billable
    expect(rows[4].isProductive).toBe(true); // IP
    expect(rows[5].isProductive).toBe(true); // Accelerator
    expect(rows[8].isProductive).toBe(false); // Learning
    expect(rows[7].isProductive).toBe(false); // unknown code
    expect(rows[9].isProductive).toBe(false); // unclassified
  });

  it("uses the fallback reporting period when a row has no date", () => {
    const config = testConfig();
    const [classified] = classifyRows([row({ date: null })], config, "2026-08");
    expect(classified.month).toBe("2026-08");
  });
});

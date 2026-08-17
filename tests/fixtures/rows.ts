import type { AppConfig, SourceRow } from "@/core/types";
import { DEFAULT_CONFIG } from "@/core/config/defaults";

/**
 * Synthetic fixture rows modelled on record shapes observed in the real
 * monthly export (WBS patterns, code variants, exclusions), with fictional
 * employee names. No customer/team data is embedded here.
 */

let counter = 0;
export function row(partial: Partial<SourceRow>): SourceRow {
  counter += 1;
  return {
    rowIndex: counter,
    wbs: "0004A20078-011.02-005",
    employee: "Alex Example",
    hours: 8,
    shortText: "9004333638 - Customer Mapping Table Upda",
    date: "2026-07-15",
    ...partial,
  };
}

export const IP_TEAM_MEMBER = "Ivy IpDelivery";
export const DEV_TEAM_MEMBER = "Devon Developer";

/** Default config with a fictional IP Delivery member for team tests. */
export function testConfig(overrides?: Partial<AppConfig>): AppConfig {
  const base = structuredClone(DEFAULT_CONFIG);
  base.teams = [
    {
      id: "ip-delivery",
      name: "IP Delivery Team",
      members: [IP_TEAM_MEMBER],
      catchAll: false,
      active: true,
    },
    {
      id: "development",
      name: "Development Team",
      members: [],
      catchAll: true,
      active: true,
    },
  ];
  return { ...base, ...overrides };
}

/** Representative scenario rows mirroring patterns found in the sample export. */
export function scenarioRows(): SourceRow[] {
  return [
    // Valid billable 0004A
    row({ wbs: "0004A20078-011.02-005", employee: IP_TEAM_MEMBER, hours: 4 }),
    // Valid billable 0004C
    row({ wbs: "0004C30001-001.01-001", employee: DEV_TEAM_MEMBER, hours: 3 }),
    // Secondary validation failure: 0004A9... (also the explicit exclusion seen in real data)
    row({ wbs: "0004A99999-008.02-900", employee: DEV_TEAM_MEMBER, hours: 2 }),
    // Secondary validation failure: 0004C9...
    row({ wbs: "0004C91111-001.01-001", employee: DEV_TEAM_MEMBER, hours: 1 }),
    // Development, recognized IP code
    row({
      wbs: "0004I00021-002.01-001",
      employee: IP_TEAM_MEMBER,
      hours: 5,
      shortText: "DTEC development work",
    }),
    // Development, recognized Accelerator code, lower-case in source
    row({
      wbs: "0004I00021-002.01-002",
      employee: DEV_TEAM_MEMBER,
      hours: 6,
      shortText: "mslm shelf life fixes",
    }),
    // Development, short configured code with delimiter (real pattern "2PC:")
    row({
      wbs: "0004I00021-002.01-003",
      employee: DEV_TEAM_MEMBER,
      hours: 2.5,
      shortText: "2PC: Partner Co-Pilot backlog",
    }),
    // Development, unknown code (real pattern)
    row({
      wbs: "0004I00021-002.01-004",
      employee: DEV_TEAM_MEMBER,
      hours: 7,
      shortText: "AIUG user group session",
    }),
    // Non-productive development category
    row({
      wbs: "0004I00021-002.01-005",
      employee: IP_TEAM_MEMBER,
      hours: 1.5,
      shortText: "LEAR Learning block",
    }),
    // Unclassified WBS prefix (real pattern 0085I…)
    row({
      wbs: "0085I00001-001.01-001",
      employee: DEV_TEAM_MEMBER,
      hours: 4,
      shortText: "Cross-charge activity",
    }),
  ];
}

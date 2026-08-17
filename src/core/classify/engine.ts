import type {
  AppConfig,
  Classification,
  ClassifiedRow,
  CodeDefinition,
  SourceRow,
} from "../types";

/**
 * Configuration-driven classification engine.
 *
 * This is the single source of truth for row classification. The interactive
 * dashboard, drilldowns, validation reports and executive snapshots all
 * consume its output — business rules must never be re-implemented in UI
 * components.
 */

export interface CodeLookupResult {
  /** The candidate extracted from the short description (always set when a description exists). */
  candidate: string | null;
  /** The matched configured code, or null when the candidate is unknown. */
  definition: CodeDefinition | null;
}

/**
 * Extracts the development/activity code from a short description:
 * trim → uppercase → first 4 characters → configuration lookup.
 *
 * Configured codes may be shorter than 4 characters (e.g. "2PC"). Those match
 * when the description starts with the code followed by a non-alphanumeric
 * delimiter (e.g. "2PC: Partner Co-Pilot work"), so real-world entries like
 * "2PC:" resolve correctly without weakening the 4-character rule.
 */
export function extractCode(
  shortText: string | null | undefined,
  codes: CodeDefinition[],
): CodeLookupResult {
  const text = (shortText ?? "").trim().toUpperCase();
  if (!text) return { candidate: null, definition: null };

  const candidate = text.slice(0, 4);
  const active = codes.filter((c) => c.active);

  const exact = active.find((c) => c.code.toUpperCase() === candidate);
  if (exact) return { candidate, definition: exact };

  const short = active.find((c) => {
    const code = c.code.toUpperCase();
    if (code.length >= 4 || !text.startsWith(code)) return false;
    const next = text.charAt(code.length);
    return next === "" || !/[A-Z0-9]/.test(next);
  });
  if (short) return { candidate: short.code.toUpperCase(), definition: short };

  return { candidate, definition: null };
}

function normalizeWbs(wbs: string): string {
  return wbs.trim().toUpperCase();
}

interface BillabilityResult {
  isBillable: boolean;
  matchedPrefix: string | null;
  reason: string | null;
}

/** Applies the configured billable WBS rules to a single WBS element. */
export function evaluateBillability(
  rawWbs: string,
  config: AppConfig,
): BillabilityResult {
  const wbs = normalizeWbs(rawWbs);
  const { allowedPrefixes, nextCharacterMustNotBe, excludedWbs } =
    config.billableRules;

  const prefix = allowedPrefixes.find((p) => wbs.startsWith(p.toUpperCase()));
  if (!prefix) return { isBillable: false, matchedPrefix: null, reason: null };

  if (excludedWbs.some((e) => normalizeWbs(e) === wbs)) {
    return {
      isBillable: false,
      matchedPrefix: prefix,
      reason: `Excluded - WBS ${wbs} explicitly excluded`,
    };
  }

  const nextChar = wbs.charAt(prefix.length);
  if (nextCharacterMustNotBe.includes(nextChar)) {
    return {
      isBillable: false,
      matchedPrefix: prefix,
      reason: `Not Billable - secondary WBS validation failed (character after ${prefix} is '${nextChar}')`,
    };
  }

  return {
    isBillable: true,
    matchedPrefix: prefix,
    reason: `Billable - WBS matched ${prefix} rule`,
  };
}

/** Returns the matched development prefix, or null. */
export function evaluateDevelopment(
  rawWbs: string,
  config: AppConfig,
): string | null {
  const wbs = normalizeWbs(rawWbs);
  return (
    config.developmentRules.allowedPrefixes.find((p) =>
      wbs.startsWith(p.toUpperCase()),
    ) ?? null
  );
}

/** Builds a lookup from employee name (normalized) to team name. */
export function buildTeamResolver(config: AppConfig): (employee: string) => string {
  const map = new Map<string, string>();
  const activeTeams = config.teams.filter((t) => t.active);
  for (const team of activeTeams) {
    for (const member of team.members) {
      map.set(member.trim().toUpperCase(), team.name);
    }
  }
  const catchAll = activeTeams.find((t) => t.catchAll);
  const fallback = catchAll ? catchAll.name : "Unassigned";
  return (employee: string) => map.get(employee.trim().toUpperCase()) ?? fallback;
}

function monthOf(date: string | null, fallback: string): string {
  return date ? date.slice(0, 7) : fallback;
}

/**
 * Classifies every source row using the supplied configuration.
 *
 * @param fallbackMonth reporting period (yyyy-mm) used when a row has no date.
 */
export function classifyRows(
  rows: SourceRow[],
  config: AppConfig,
  fallbackMonth: string,
): ClassifiedRow[] {
  const resolveTeam = buildTeamResolver(config);
  const productiveCategories = new Set(
    config.categories.filter((c) => c.active && c.productive).map((c) => c.name),
  );

  return rows.map((row) => {
    const team = resolveTeam(row.employee);
    const month = monthOf(row.date, fallbackMonth);

    const billability = evaluateBillability(row.wbs, config);
    const devPrefix = evaluateDevelopment(row.wbs, config);

    let classification: Classification;
    let reason: string;
    let developmentCode: string | null = null;
    let developmentDescription: string | null = null;
    let developmentCategory: string | null = null;

    if (billability.isBillable) {
      classification = "Billable";
      reason = billability.reason!;
    } else if (billability.reason) {
      // Matched a billable prefix but failed exclusion / secondary validation.
      classification = billability.reason.startsWith("Excluded")
        ? "Excluded"
        : "Not Billable";
      reason = billability.reason;
    } else if (devPrefix) {
      classification = "Development";
      const lookup = extractCode(row.shortText, config.codes);
      developmentCode = lookup.candidate;
      if (lookup.definition) {
        developmentDescription = lookup.definition.description;
        developmentCategory = lookup.definition.category;
        reason = `Development - WBS matched ${devPrefix} rule; code ${lookup.definition.code} mapped to ${lookup.definition.category}`;
      } else {
        developmentCategory = "Unknown";
        reason = lookup.candidate
          ? `Development - WBS matched ${devPrefix} rule; unknown development code '${lookup.candidate}'`
          : `Development - WBS matched ${devPrefix} rule; missing short description`;
      }
    } else {
      classification = "Unclassified";
      reason = "Other / Unclassified - WBS matched no configured rule";
    }

    const isProductive =
      billability.isBillable ||
      (developmentCategory !== null && productiveCategories.has(developmentCategory));

    return {
      ...row,
      team,
      classification,
      isBillable: billability.isBillable,
      isDevelopment: devPrefix !== null,
      isProductive,
      developmentCode,
      developmentDescription,
      developmentCategory,
      classificationReason: reason,
      month,
    };
  });
}

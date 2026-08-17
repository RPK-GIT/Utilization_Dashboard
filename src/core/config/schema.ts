import { z } from "zod";

/** Zod schemas validating the configuration model at every persistence boundary. */

export const billableRulesSchema = z.object({
  allowedPrefixes: z.array(z.string().trim().min(1)),
  nextCharacterMustNotBe: z.array(z.string().length(1)),
  excludedWbs: z.array(z.string().trim().min(1)),
});

export const developmentRulesSchema = z.object({
  allowedPrefixes: z.array(z.string().trim().min(1)),
});

export const codeDefinitionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(4)
    .transform((s) => s.toUpperCase()),
  description: z.string().trim().min(1),
  category: z.string().trim().min(1),
  active: z.boolean(),
});

export const categoryDefinitionSchema = z.object({
  name: z.string().trim().min(1),
  productive: z.boolean(),
  active: z.boolean(),
});

export const teamDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  members: z.array(z.string().trim().min(1)),
  catchAll: z.boolean(),
  active: z.boolean(),
});

export const kpiDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  formula: z.string(),
  format: z.enum(["hours", "percent", "count"]),
  category: z.enum(["primary", "secondary"]),
  enabled: z.boolean(),
});

export const columnMappingSchema = z.object({
  wbs: z.string().min(1),
  employee: z.string().min(1),
  hours: z.string().min(1),
  shortText: z.string().min(1),
  date: z.string().min(1).nullable(),
});

export const appConfigSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+$/),
  updatedAt: z.string(),
  billableRules: billableRulesSchema,
  developmentRules: developmentRulesSchema,
  codes: z.array(codeDefinitionSchema),
  categories: z.array(categoryDefinitionSchema),
  teams: z.array(teamDefinitionSchema).refine(
    (teams) => teams.filter((t) => t.catchAll && t.active).length === 1,
    { message: "Exactly one active catch-all team is required" },
  ),
  kpis: z.array(kpiDefinitionSchema),
  columnMapping: columnMappingSchema.nullable(),
});

export type AppConfigInput = z.input<typeof appConfigSchema>;

/** Bumps the minor configuration version: v1.4 -> v1.5. */
export function bumpVersion(version: string): string {
  const m = version.match(/^v(\d+)\.(\d+)$/);
  if (!m) return "v1.0";
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

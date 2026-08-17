"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Badge, Button, Card, CardHeader, Input, Label, Select, Switch } from "../ui/primitives";
import { appConfigSchema } from "@/core/config/schema";
import type { AppConfig } from "@/core/types";

/**
 * Admin / configuration management. All business rules are maintained here:
 * WBS rules and exclusions, the four-character code master, categories,
 * teams and KPI metadata. Saving bumps the configuration version; datasets
 * keep the version they were processed with.
 */

type AdminTab = "wbs" | "codes" | "categories" | "teams" | "kpis";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "wbs", label: "WBS Rules" },
  { id: "codes", label: "Code Master" },
  { id: "categories", label: "Categories" },
  { id: "teams", label: "Teams" },
  { id: "kpis", label: "KPI Definitions" },
];

/* ------------------------- small list editor ------------------------- */

function StringListEditor({
  label,
  hint,
  values,
  onChange,
  mono = true,
  placeholder,
  testId,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  mono?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1 rounded-md border border-grid bg-page px-2 py-0.5 text-xs ${mono ? "font-mono" : ""}`}
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              className="text-muted hover:text-critical cursor-pointer"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
        {values.length === 0 ? (
          <span className="text-xs text-muted">None configured</span>
        ) : null}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          data-testid={testId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className={`w-56 ${mono ? "font-mono" : ""}`}
        />
        <Button onClick={add} aria-label={`Add ${label}`}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ editors ------------------------------ */

function WbsRulesEditor({
  draft,
  update,
}: {
  draft: AppConfig;
  update: (fn: (c: AppConfig) => AppConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Billable WBS rules"
          subtitle="A row is billable when its WBS starts with an allowed prefix, the character immediately after the prefix is not forbidden, and the WBS is not explicitly excluded"
        />
        <div className="flex flex-col gap-5 px-5 pb-5">
          <StringListEditor
            label="Allowed prefixes"
            values={draft.billableRules.allowedPrefixes}
            onChange={(v) =>
              update((c) => ({
                ...c,
                billableRules: { ...c.billableRules, allowedPrefixes: v },
              }))
            }
            placeholder="e.g. 0004A"
            testId="billable-prefix-input"
          />
          <StringListEditor
            label="Forbidden next characters"
            hint="The character immediately following an allowed prefix must not be any of these"
            values={draft.billableRules.nextCharacterMustNotBe}
            onChange={(v) =>
              update((c) => ({
                ...c,
                billableRules: { ...c.billableRules, nextCharacterMustNotBe: v },
              }))
            }
            placeholder="e.g. 9"
          />
          <StringListEditor
            label="Excluded WBS elements"
            hint="Exact WBS elements never treated as billable"
            values={draft.billableRules.excludedWbs}
            onChange={(v) =>
              update((c) => ({
                ...c,
                billableRules: { ...c.billableRules, excludedWbs: v },
              }))
            }
            placeholder="e.g. 0004A99999-008.02-900"
            testId="excluded-wbs-input"
          />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Development WBS rules"
          subtitle="Rows whose WBS starts with any of these prefixes are Development"
        />
        <div className="px-5 pb-5">
          <StringListEditor
            label="Development prefixes"
            values={draft.developmentRules.allowedPrefixes}
            onChange={(v) =>
              update((c) => ({ ...c, developmentRules: { allowedPrefixes: v } }))
            }
            placeholder="e.g. 0004I"
          />
        </div>
      </Card>
    </div>
  );
}

function CodeMasterEditor({
  draft,
  update,
}: {
  draft: AppConfig;
  update: (fn: (c: AppConfig) => AppConfig) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [newCode, setNewCode] = React.useState({ code: "", description: "", category: "IP" });
  const categories = draft.categories.filter((c) => c.active).map((c) => c.name);

  const filtered = draft.codes.filter((c) => {
    const q = search.trim().toUpperCase();
    return (
      !q ||
      c.code.includes(q) ||
      c.description.toUpperCase().includes(q) ||
      c.category.toUpperCase().includes(q)
    );
  });

  const addCode = () => {
    const code = newCode.code.trim().toUpperCase();
    if (!code || !newCode.description.trim()) return;
    // Codes are case-insensitive: "mslm" and "MSLM" are the same code.
    if (draft.codes.some((c) => c.code.toUpperCase() === code)) return;
    update((c) => ({
      ...c,
      codes: [
        { code, description: newCode.description.trim(), category: newCode.category, active: true },
        ...c.codes,
      ],
    }));
    setNewCode({ code: "", description: "", category: "IP" });
  };

  return (
    <Card>
      <CardHeader
        title="Development code master"
        subtitle="Codes are matched against the first four characters of the short description (trim → uppercase). Shorter codes match when followed by a delimiter."
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-grid bg-page p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-code">Code</Label>
            <Input
              id="new-code"
              data-testid="new-code-input"
              value={newCode.code}
              onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
              maxLength={4}
              className="w-24 font-mono"
              placeholder="XYZ1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-desc">Description</Label>
            <Input
              id="new-desc"
              data-testid="new-desc-input"
              value={newCode.description}
              onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
              className="w-72"
              placeholder="Description"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-cat">Category</Label>
            <Select
              id="new-cat"
              value={newCode.category}
              onChange={(e) => setNewCode({ ...newCode, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <Button onClick={addCode} data-testid="add-code">
            <Plus className="h-3.5 w-3.5" />
            Add code
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search codes…"
          className="w-64"
          aria-label="Search codes"
        />
        <div className="overflow-x-auto rounded-md border border-grid">
          <table className="w-full text-sm">
            <thead className="bg-page">
              <tr className="text-left text-xs font-semibold text-ink-2">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2 text-right">Remove</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((code) => (
                <tr key={code.code} className="border-t border-grid">
                  <td className="px-3 py-1.5 font-mono font-medium">{code.code}</td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={code.description}
                      aria-label={`Description for ${code.code}`}
                      onChange={(e) =>
                        update((c) => ({
                          ...c,
                          codes: c.codes.map((x) =>
                            x.code === code.code ? { ...x, description: e.target.value } : x,
                          ),
                        }))
                      }
                      className="w-full min-w-56"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={code.category}
                      aria-label={`Category for ${code.code}`}
                      onChange={(e) =>
                        update((c) => ({
                          ...c,
                          codes: c.codes.map((x) =>
                            x.code === code.code ? { ...x, category: e.target.value } : x,
                          ),
                        }))
                      }
                    >
                      {[...new Set([...categories, code.category])].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Switch
                      checked={code.active}
                      label={`${code.code} active`}
                      onChange={(v) =>
                        update((c) => ({
                          ...c,
                          codes: c.codes.map((x) =>
                            x.code === code.code ? { ...x, active: v } : x,
                          ),
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button
                      variant="danger"
                      aria-label={`Delete ${code.code}`}
                      onClick={() =>
                        update((c) => ({
                          ...c,
                          codes: c.codes.filter((x) => x.code !== code.code),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">
          {draft.codes.length} codes configured · {filtered.length} shown
        </p>
      </div>
    </Card>
  );
}

function CategoriesEditor({
  draft,
  update,
}: {
  draft: AppConfig;
  update: (fn: (c: AppConfig) => AppConfig) => void;
}) {
  const [name, setName] = React.useState("");
  return (
    <Card>
      <CardHeader
        title="Categories"
        subtitle="Categories flagged productive contribute to Productive Hours (initially IP and Accelerator)"
      />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
            className="w-64"
            aria-label="New category name"
          />
          <Button
            onClick={() => {
              const v = name.trim();
              if (!v || draft.categories.some((c) => c.name === v)) return;
              update((c) => ({
                ...c,
                categories: [...c.categories, { name: v, productive: false, active: true }],
              }));
              setName("");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add category
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-grid">
          <table className="w-full text-sm">
            <thead className="bg-page">
              <tr className="text-left text-xs font-semibold text-ink-2">
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Counts as productive</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2 text-right">Remove</th>
              </tr>
            </thead>
            <tbody>
              {draft.categories.map((cat) => (
                <tr key={cat.name} className="border-t border-grid">
                  <td className="px-3 py-1.5 font-medium">{cat.name}</td>
                  <td className="px-3 py-1.5">
                    <Switch
                      checked={cat.productive}
                      label={`${cat.name} productive`}
                      onChange={(v) =>
                        update((c) => ({
                          ...c,
                          categories: c.categories.map((x) =>
                            x.name === cat.name ? { ...x, productive: v } : x,
                          ),
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Switch
                      checked={cat.active}
                      label={`${cat.name} active`}
                      onChange={(v) =>
                        update((c) => ({
                          ...c,
                          categories: c.categories.map((x) =>
                            x.name === cat.name ? { ...x, active: v } : x,
                          ),
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button
                      variant="danger"
                      aria-label={`Delete category ${cat.name}`}
                      onClick={() =>
                        update((c) => ({
                          ...c,
                          categories: c.categories.filter((x) => x.name !== cat.name),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function TeamsEditor({
  draft,
  update,
}: {
  draft: AppConfig;
  update: (fn: (c: AppConfig) => AppConfig) => void;
}) {
  const [newTeam, setNewTeam] = React.useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        <Input
          value={newTeam}
          onChange={(e) => setNewTeam(e.target.value)}
          placeholder="New team name"
          className="w-64"
          aria-label="New team name"
        />
        <Button
          onClick={() => {
            const v = newTeam.trim();
            if (!v || draft.teams.some((t) => t.name === v)) return;
            update((c) => ({
              ...c,
              teams: [
                ...c.teams,
                {
                  id: v.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                  name: v,
                  members: [],
                  catchAll: false,
                  active: true,
                },
              ],
            }));
            setNewTeam("");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create team
        </Button>
      </div>
      {draft.teams.map((team) => (
        <Card key={team.id}>
          <CardHeader
            title={team.name}
            subtitle={
              team.catchAll
                ? "Catch-all team — automatically receives every employee not configured in another team"
                : `${team.members.length} configured member${team.members.length === 1 ? "" : "s"}`
            }
            actions={
              <div className="flex items-center gap-3">
                {team.catchAll ? <Badge tone="accent">Catch-all</Badge> : null}
                <span className="flex items-center gap-1.5 text-xs text-ink-2">
                  Active
                  <Switch
                    checked={team.active}
                    label={`${team.name} active`}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        teams: c.teams.map((t) =>
                          t.id === team.id ? { ...t, active: v } : t,
                        ),
                      }))
                    }
                  />
                </span>
                {!team.catchAll ? (
                  <Button
                    variant="danger"
                    aria-label={`Delete team ${team.name}`}
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        teams: c.teams.filter((t) => t.id !== team.id),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            }
          />
          <div className="flex flex-col gap-3 px-5 pb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor={`rename-${team.id}`}>Name</Label>
              <Input
                id={`rename-${team.id}`}
                value={team.name}
                onChange={(e) =>
                  update((c) => ({
                    ...c,
                    teams: c.teams.map((t) =>
                      t.id === team.id ? { ...t, name: e.target.value } : t,
                    ),
                  }))
                }
                className="w-64"
              />
            </div>
            {!team.catchAll ? (
              <StringListEditor
                label="Members"
                hint="Employee names exactly as they appear in the source (matching is case-insensitive)"
                values={team.members}
                mono={false}
                onChange={(v) =>
                  update((c) => ({
                    ...c,
                    teams: c.teams.map((t) => (t.id === team.id ? { ...t, members: v } : t)),
                  }))
                }
                placeholder="Employee name"
                testId={`member-input-${team.id}`}
              />
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function KpiEditor({
  draft,
  update,
}: {
  draft: AppConfig;
  update: (fn: (c: AppConfig) => AppConfig) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="KPI definitions"
        subtitle="KPI metadata is centralized here; formulas are implemented once in the metric engine"
      />
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grid text-left text-xs font-semibold text-ink-2">
              <th className="px-2 py-2">KPI</th>
              <th className="px-2 py-2">Formula</th>
              <th className="px-2 py-2">Format</th>
              <th className="px-2 py-2">Tier</th>
              <th className="px-2 py-2">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {draft.kpis.map((kpi) => (
              <tr key={kpi.id} className="border-b border-grid last:border-b-0 align-top">
                <td className="px-2 py-2">
                  <p className="font-medium text-ink">{kpi.name}</p>
                  <p className="text-[11px] text-muted">{kpi.description}</p>
                </td>
                <td className="px-2 py-2 font-mono text-xs text-ink-2">{kpi.formula}</td>
                <td className="px-2 py-2 text-xs">{kpi.format}</td>
                <td className="px-2 py-2 text-xs">{kpi.category}</td>
                <td className="px-2 py-2">
                  <Switch
                    checked={kpi.enabled}
                    label={`${kpi.name} enabled`}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        kpis: c.kpis.map((k) => (k.id === kpi.id ? { ...k, enabled: v } : k)),
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------- shell ------------------------------- */

export function AdminView() {
  const { config, saveConfig } = useAppStore();
  const [tab, setTab] = React.useState<AdminTab>("wbs");
  const [draft, setDraft] = React.useState<AppConfig>(config);
  const [message, setMessage] = React.useState<string | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Re-seed the draft when a new configuration version arrives (state
  // adjustment during render, per React guidance).
  const [seenConfig, setSeenConfig] = React.useState(config);
  if (seenConfig !== config) {
    setSeenConfig(config);
    setDraft(config);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const update = (fn: (c: AppConfig) => AppConfig) => {
    setMessage(null);
    setDraft(fn);
  };

  const save = async () => {
    const parsed = appConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 3)
          .join(" · "),
      );
      return;
    }
    setValidationError(null);
    const saved = await saveConfig(parsed.data as AppConfig);
    setMessage(`Configuration saved as ${saved.version}. Existing datasets keep the version they were processed with — use Reprocess on the Datasets page to apply the new rules.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-grid" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              data-testid={`admin-tab-${t.id}`}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                tab === t.id
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">Current: {config.version}</Badge>
          {dirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(config)}>
            Reset
          </Button>
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => void save()}
            data-testid="save-config"
          >
            Save configuration
          </Button>
        </div>
      </div>
      {validationError ? (
        <p className="rounded-md border border-critical/30 bg-red-50 px-3 py-2 text-xs text-critical">
          {validationError}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-md border border-good/30 bg-green-50 px-3 py-2 text-xs text-good-text"
          data-testid="save-message"
        >
          {message}
        </p>
      ) : null}
      {tab === "wbs" ? <WbsRulesEditor draft={draft} update={update} /> : null}
      {tab === "codes" ? <CodeMasterEditor draft={draft} update={update} /> : null}
      {tab === "categories" ? <CategoriesEditor draft={draft} update={update} /> : null}
      {tab === "teams" ? <TeamsEditor draft={draft} update={update} /> : null}
      {tab === "kpis" ? <KpiEditor draft={draft} update={update} /> : null}
    </div>
  );
}

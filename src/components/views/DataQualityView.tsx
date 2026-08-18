"use client";

import * as React from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { TransactionsTable } from "../tables/TransactionsTable";
import { computeComposition } from "@/core/metrics/engine";
import { formatHours } from "@/core/format";
import type { ClassifiedRow } from "@/core/types";

/**
 * Data quality — every exception class with drill-through to the underlying
 * records. Exceptions are derived from classified rows, so they always match
 * the active configuration.
 */

interface ExceptionGroup {
  id: string;
  label: string;
  description: string;
  rows: ClassifiedRow[];
  severity: "warning" | "critical" | "neutral";
}

export function DataQualityView() {
  const { filtered, config } = useDashboard();
  const [selected, setSelected] = React.useState<string | null>(null);

  // Hours reconciliation: Total = Billable + productive categories + Other.
  const composition = React.useMemo(
    () => computeComposition(filtered, config.categories),
    [filtered, config.categories],
  );

  const groups = React.useMemo<ExceptionGroup[]>(() => {
    const missingEmployee = filtered.filter((r) => !r.employee);
    const missingHours = filtered.filter((r) => r.hours === 0);
    const invalidHours = filtered.filter((r) => r.hours < 0);
    const missingWbs = filtered.filter((r) => !r.wbs);
    const missingDesc = filtered.filter((r) => r.isDevelopment && !r.shortText);
    const unclassified = filtered.filter((r) => r.classification === "Unclassified");
    const excluded = filtered.filter(
      (r) => r.classification === "Excluded" || r.classification === "Not Billable",
    );

    const seen = new Map<string, ClassifiedRow[]>();
    for (const r of filtered) {
      const key = `${r.wbs}|${r.employee}|${r.hours}|${r.shortText}|${r.date}`;
      const list = seen.get(key);
      if (list) list.push(r);
      else seen.set(key, [r]);
    }
    const duplicates = [...seen.values()]
      .filter((list) => list.length > 1)
      .flat();

    const unknownByCode = new Map<string, ClassifiedRow[]>();
    for (const r of filtered) {
      if (r.isDevelopment && r.developmentCategory === "Unknown" && r.developmentCode) {
        const list = unknownByCode.get(r.developmentCode);
        if (list) list.push(r);
        else unknownByCode.set(r.developmentCode, [r]);
      }
    }

    const base: ExceptionGroup[] = [
      {
        id: "unclassified",
        label: "Unclassified WBS",
        description: "Rows whose WBS matches no configured billable or development rule",
        rows: unclassified,
        severity: "critical",
      },
      {
        id: "excluded",
        label: "Excluded / failed WBS validation",
        description: "Rows excluded explicitly or failing secondary WBS validation",
        rows: excluded,
        severity: "neutral",
      },
      {
        id: "duplicates",
        label: "Possible duplicate records",
        description: "Identical WBS + employee + hours + description + date",
        rows: duplicates,
        severity: "warning",
      },
      {
        id: "missing-employee",
        label: "Missing employee",
        description: "Rows without an employee name",
        rows: missingEmployee,
        severity: "critical",
      },
      {
        id: "missing-hours",
        label: "Missing / zero hours",
        description: "Rows with no hours recorded",
        rows: missingHours,
        severity: "warning",
      },
      {
        id: "invalid-hours",
        label: "Invalid (negative) hours",
        description: "Rows with negative hours",
        rows: invalidHours,
        severity: "critical",
      },
      {
        id: "missing-wbs",
        label: "Missing WBS",
        description: "Rows without a WBS element",
        rows: missingWbs,
        severity: "critical",
      },
      {
        id: "missing-desc",
        label: "Missing short description",
        description: "Development rows without a short description",
        rows: missingDesc,
        severity: "warning",
      },
    ];

    const unknownGroups: ExceptionGroup[] = [...unknownByCode.entries()]
      .sort((a, b) => b[1].reduce((x, r) => x + r.hours, 0) - a[1].reduce((x, r) => x + r.hours, 0))
      .map(([code, rows]) => ({
        id: `unknown-${code}`,
        label: `Unknown code: ${code}`,
        description: "Development rows whose extracted code is not in the code master",
        rows,
        severity: "warning" as const,
      }));

    return [...base, ...unknownGroups];
  }, [filtered]);

  const selectedGroup = groups.find((g) => g.id === selected);
  const severityDot = {
    critical: "bg-critical",
    warning: "bg-warning",
    neutral: "bg-axis",
  };

  return (
    <div className="flex flex-col gap-4">
      {composition.reconciles ? (
        <p
          className="flex items-center gap-1.5 rounded-md border border-good/30 bg-green-50 px-3 py-2 text-xs font-medium text-good-text"
          data-testid="dq-reconciliation-ok"
        >
          <CircleCheck className="h-3.5 w-3.5" />
          Hours reconciliation: {formatHours(composition.totalHours)} total hours ={" "}
          {composition.segments
            .map((s) => `${formatHours(s.hours)} ${s.key}`)
            .join(" + ")}{" "}
          — 100% accounted for.
        </p>
      ) : (
        <p
          className="flex items-center gap-1.5 rounded-md border border-critical/30 bg-red-50 px-3 py-2 text-xs font-medium text-critical"
          data-testid="dq-reconciliation-warning"
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          Hours reconciliation issue — Total {formatHours(composition.totalHours)},
          unassigned difference {formatHours(Math.abs(composition.difference))} hours.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((g) => {
          const hours = g.rows.reduce((a, r) => a + r.hours, 0);
          const clean = g.rows.length === 0;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => !clean && setSelected(g.id)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                clean
                  ? "border-grid bg-surface opacity-60"
                  : selected === g.id
                    ? "border-accent bg-accent-soft/40 cursor-pointer"
                    : "border-hairline bg-surface hover:bg-page cursor-pointer"
              }`}
              data-testid={`dq-${g.id}`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${clean ? "bg-good" : severityDot[g.severity]}`}
                  aria-hidden
                />
                <span className="text-xs font-medium text-ink">{g.label}</span>
              </span>
              <span className="mt-1 block text-lg font-semibold text-ink tnum">
                {g.rows.length.toLocaleString()}
                <span className="ml-2 text-xs font-normal text-muted">
                  rows · {formatHours(hours)} h
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                {g.description}
              </span>
            </button>
          );
        })}
      </div>
      {selectedGroup ? (
        <Card>
          <CardHeader
            title={`${selectedGroup.label} — underlying records`}
            subtitle={`${selectedGroup.rows.length} rows · ${formatHours(
              selectedGroup.rows.reduce((a, r) => a + r.hours, 0),
            )} hours`}
          />
          <div className="px-5 pb-4">
            <TransactionsTable
              rows={selectedGroup.rows}
              csvName={`data_quality_${selectedGroup.id}.csv`}
            />
          </div>
        </Card>
      ) : (
        <p className="text-xs text-muted">
          Select an exception card to inspect the underlying records.
        </p>
      )}
    </div>
  );
}

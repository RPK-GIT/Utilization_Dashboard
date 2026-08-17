"use client";

import * as React from "react";
import { Check, FileDown, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button, Dialog } from "../ui/primitives";
import {
  buildSnapshotPayload,
  injectPayload,
  snapshotFileName,
  validateSnapshotHtml,
} from "@/core/snapshot/build";
import { hasActiveFilters } from "@/core/filters/engine";
import { activityLabel, periodLabel } from "@/core/format";

/**
 * Executive snapshot generation — one clear action in a centered modal.
 * The snapshot always represents the current reporting scope with the
 * currently APPLIED filters (draft selections that were never applied do not
 * affect it). The artifact is a fully standalone HTML file, validated before
 * download; the modal shows generation progress and offers Open/Close.
 */

type Phase = "confirm" | "working" | "done" | "error";

const STEPS = [
  "Preparing data",
  "Applying filters",
  "Preparing charts",
  "Packaging standalone HTML",
  "Validating artifact",
] as const;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SnapshotButton() {
  const { datasets, config, filters } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("confirm");
  const [stepsDone, setStepsDone] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ url: string; name: string } | null>(null);

  const close = () => {
    if (result) URL.revokeObjectURL(result.url);
    setOpen(false);
    setPhase("confirm");
    setStepsDone(0);
    setResult(null);
    setError(null);
  };

  // Human-readable summary of the APPLIED filter state.
  const filterSummary = React.useMemo(() => {
    const lines: string[] = [];
    if (filters.periods.length) {
      lines.push(`Period: ${filters.periods.map(periodLabel).join(", ")}`);
    }
    if (filters.teams.length) lines.push(`Team: ${filters.teams.join(", ")}`);
    if (filters.employees.length) {
      lines.push(
        filters.employees.length <= 3
          ? `Employees: ${filters.employees.join(", ")}`
          : `Employees: ${filters.employees.length} selected`,
      );
    }
    if (filters.categories.length)
      lines.push(`Category: ${filters.categories.join(", ")}`);
    if (filters.codes.length) {
      lines.push(
        filters.codes.length <= 3
          ? `Activity: ${filters.codes
              .map((code) =>
                activityLabel(
                  config.codes.find((c) => c.code.toUpperCase() === code.toUpperCase())
                    ?.description,
                  code,
                ),
              )
              .join(", ")}`
          : `Activity: ${filters.codes.length} selected`,
      );
    }
    if (filters.dateFrom) lines.push(`From Date: ${filters.dateFrom}`);
    if (filters.dateTo) lines.push(`To Date: ${filters.dateTo}`);
    return lines;
  }, [filters, config.codes]);

  const reportingPeriod = React.useMemo(() => {
    const periods = filters.periods.length
      ? filters.periods
      : [...new Set(datasets.map((d) => d.period))].sort();
    return periods.map(periodLabel).join(", ") || "—";
  }, [filters.periods, datasets]);

  const generate = async () => {
    setPhase("working");
    setError(null);
    setStepsDone(0);
    try {
      // 1. Preparing data — load the prebuilt standalone viewer template.
      const response = await fetch("/snapshot/index.html");
      if (!response.ok) throw new Error("template");
      const template = await response.text();
      setStepsDone(1);
      await delay(150);

      // 2. Applying filters — freeze the APPLIED filter state into the payload.
      const payload = buildSnapshotPayload({
        datasets,
        config,
        filters,
        scope: "current-view",
        generatedAt: new Date().toISOString(),
      });
      setStepsDone(2);
      await delay(150);

      // 3. Charts render from the same embedded payload — nothing extra to bundle.
      setStepsDone(3);
      await delay(150);

      // 4. Packaging — inject the frozen payload into the single-file template.
      const html = injectPayload(template, payload);
      setStepsDone(4);
      await delay(150);

      // 5. Validate BEFORE offering the artifact: data/CSS/JS embedded, no
      // backend, localhost or external runtime references.
      const validation = validateSnapshotHtml(html);
      if (!validation.ok) {
        throw new Error(
          `The snapshot failed validation and was not generated: ${validation.problems.join(" ")}`,
        );
      }
      setStepsDone(5);

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const name = snapshotFileName(payload);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setResult({ url, name });
      setPhase("done");
    } catch (e) {
      setError(
        e instanceof Error && e.message !== "template"
          ? e.message
          : "The snapshot template is not available. Run `npm run build:snapshot` and reload, then try again.",
      );
      setPhase("error");
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setOpen(true)}
        disabled={datasets.length === 0}
        data-testid="generate-snapshot"
      >
        <FileDown className="h-4 w-4" />
        Generate Executive Snapshot
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Generate Executive Snapshot"
        subtitle="A single self-contained HTML file for senior management"
      >
        {phase === "confirm" ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Reporting period
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink">{reportingPeriod}</p>
            </div>
            <div data-testid="snapshot-filter-summary">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Applied filters
              </p>
              {filterSummary.length === 0 ? (
                <p className="mt-0.5 text-sm font-medium text-ink">All data</p>
              ) : (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {filterSummary.map((line) => (
                    <li key={line} className="text-sm text-ink">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              {hasActiveFilters(filters) ? (
                <p className="mt-1 text-[11px] text-muted">
                  Draft filter selections that were not applied are not included.
                </p>
              ) : null}
            </div>
            <p className="text-sm text-ink-2">
              The snapshot will contain the dashboard using these currently applied
              filters, frozen at generation time. Senior management can open the
              generated HTML file directly — no source Excel, server or dashboard
              application required. Admin and configuration screens are not included.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => void generate()}
                data-testid="generate-snapshot-confirm"
              >
                <FileDown className="h-4 w-4" />
                Generate Executive Snapshot
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "working" || phase === "done" ? (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1.5">
              {STEPS.map((step, i) => {
                const done = stepsDone > i;
                const active = stepsDone === i && phase === "working";
                return (
                  <li key={step} className="flex items-center gap-2 text-sm">
                    {done ? (
                      <Check className="h-4 w-4 text-good" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-axis" />
                    )}
                    <span className={done ? "text-ink" : "text-ink-2"}>{step}</span>
                  </li>
                );
              })}
            </ul>
            {phase === "done" && result ? (
              <>
                <p
                  className="rounded-md border border-good/30 bg-green-50 px-3 py-2 text-sm text-good-text"
                  data-testid="snapshot-success"
                >
                  Snapshot generated successfully: <strong>{result.name}</strong> (saved
                  to your downloads).
                </p>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => window.open(result.url, "_blank")}>
                    Open Snapshot
                  </Button>
                  <Button variant="primary" onClick={close} data-testid="snapshot-close">
                    Close
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-md border border-critical/30 bg-red-50 px-3 py-2 text-sm text-critical">
              {error}
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={close}>Close</Button>
              <Button variant="primary" onClick={() => void generate()}>
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

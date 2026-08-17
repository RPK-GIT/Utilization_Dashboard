"use client";

import * as React from "react";
import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Badge, Button, Card, CardHeader, Label, Select } from "../ui/primitives";
import {
  detectMapping,
  FIELD_LABELS,
  REQUIRED_FIELDS,
  toPersistedMapping,
  validateMapping,
  type HeaderInfo,
  type MappableField,
} from "@/core/ingest/columnMapping";
import {
  detectPeriod,
  normalizeRows,
  parseWorkbook,
  type ParsedWorkbook,
} from "@/core/ingest/parseWorkbook";
import { buildValidationReport } from "@/core/ingest/validation";
import { classifyRows } from "@/core/classify/engine";
import { formatHours, periodLabel } from "@/core/format";
import type { Dataset, SourceRow, ValidationReport } from "@/core/types";

/**
 * Monthly import workflow: upload → inspect structure → validate/map columns
 * → preview + validation summary → confirm. Bad data is never imported
 * silently — the validation report is shown before confirmation.
 */

type Step = 1 | 2 | 3 | 4;

const STEPS = ["Upload", "Structure & mapping", "Validate & preview", "Done"];

export function ImportWizard({ onDone }: { onDone: () => void }) {
  const { config, datasets, addDataset, saveConfig } = useAppStore();
  const [step, setStep] = React.useState<Step>(1);
  const [error, setError] = React.useState<string | null>(null);
  const [workbook, setWorkbook] = React.useState<ParsedWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = React.useState(0);
  const [mapping, setMapping] = React.useState<Partial<Record<MappableField, HeaderInfo>>>({});
  const [rows, setRows] = React.useState<SourceRow[]>([]);
  const [period, setPeriod] = React.useState("");
  const [report, setReport] = React.useState<ValidationReport | null>(null);
  const [replaceExisting, setReplaceExisting] = React.useState(false);
  const [importedPeriod, setImportedPeriod] = React.useState("");

  const sheet = workbook?.sheets[sheetIndex] ?? null;

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer, file.name);
      if (parsed.sheets.length === 0) {
        setError(
          "No readable worksheet was found in this file. Please check that it is a valid Excel export with a header row.",
        );
        return;
      }
      setWorkbook(parsed);
      setSheetIndex(0);
      setMapping(detectMapping(parsed.sheets[0].headers, config.columnMapping));
      setStep(2);
    } catch {
      setError(
        "This file could not be read as an Excel workbook. Please upload the monthly .xlsx export.",
      );
    }
  };

  const applySheet = (index: number) => {
    if (!workbook) return;
    setSheetIndex(index);
    setMapping(detectMapping(workbook.sheets[index].headers, config.columnMapping));
  };

  const mappingState = validateMapping(mapping);

  const runValidation = () => {
    if (!workbook || !sheet) return;
    const { rows: normalized } = normalizeRows(sheet, mapping);
    if (normalized.length === 0) {
      setError("The selected sheet contains no data rows below the header.");
      return;
    }
    setError(null);
    const detected = detectPeriod(normalized);
    const chosenPeriod = detected ?? new Date().toISOString().slice(0, 7);
    const classified = classifyRows(normalized, config, chosenPeriod);
    setRows(normalized);
    setPeriod(chosenPeriod);
    setReport(
      buildValidationReport({
        fileName: workbook.fileName,
        sheetName: sheet.sheetName,
        sourceRows: normalized,
        classifiedRows: classified,
        config,
      }),
    );
    setStep(3);
  };

  const existing = datasets.find((d) => d.period === period);

  const confirmImport = async () => {
    if (!workbook || !sheet || !report) return;
    const classified = classifyRows(rows, config, period);
    const now = new Date().toISOString();
    const dataset: Dataset = {
      id: `${period}-${now}`,
      period,
      periodLabel: periodLabel(period),
      fileName: workbook.fileName,
      sheetName: sheet.sheetName,
      uploadedAt: now,
      processedAt: now,
      configVersion: config.version,
      configSnapshot: config,
      rows,
      classified,
      validation: buildValidationReport({
        fileName: workbook.fileName,
        sheetName: sheet.sheetName,
        sourceRows: rows,
        classifiedRows: classified,
        config,
      }),
      status: "Validated",
    };
    await addDataset(dataset, replaceExisting ? existing?.id : undefined);

    // Persist the confirmed column mapping when it changed.
    const persisted = toPersistedMapping(mapping);
    if (persisted && JSON.stringify(persisted) !== JSON.stringify(config.columnMapping)) {
      await saveConfig({ ...config, columnMapping: persisted });
    }
    setImportedPeriod(period);
    setStep(4);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <ol className="flex items-center gap-2 text-xs" aria-label="Import steps">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const activeStep = step === n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  done
                    ? "bg-good text-white"
                    : activeStep
                      ? "bg-accent text-white"
                      : "bg-grid text-ink-2"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={activeStep ? "font-medium text-ink" : "text-muted"}>
                {label}
              </span>
              {i < STEPS.length - 1 ? <span className="h-px w-6 bg-axis" /> : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-critical/30 bg-red-50 px-4 py-3 text-sm text-critical">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <Card>
          <label className="flex cursor-pointer flex-col items-center gap-3 px-6 py-16 text-center">
            <Upload className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium text-ink">
              Upload the monthly Excel export
            </span>
            <span className="text-xs text-muted">
              .xlsx — the file becomes a new reporting-period dataset. Nothing is
              imported until you confirm the validation summary.
            </span>
            <span className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white">
              Choose file
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              data-testid="upload-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        </Card>
      ) : null}

      {step === 2 && workbook && sheet ? (
        <Card>
          <CardHeader
            title="Structure & column mapping"
            subtitle={`${workbook.fileName} — columns are matched by header name; adjust if this month's export differs`}
          />
          <div className="flex flex-col gap-4 px-5 pb-5">
            {workbook.sheets.length > 1 ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="sheet-select">Worksheet</Label>
                <Select
                  id="sheet-select"
                  value={sheetIndex}
                  onChange={(e) => applySheet(Number(e.target.value))}
                >
                  {workbook.sheets.map((s, i) => (
                    <option key={s.sheetName} value={i}>
                      {s.sheetName}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-xs text-muted">
                Worksheet: <span className="font-medium text-ink-2">{sheet.sheetName}</span> ·{" "}
                {sheet.rows.length.toLocaleString()} data rows ·{" "}
                {sheet.headers.length} columns
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {([...REQUIRED_FIELDS, "date"] as MappableField[]).map((field) => (
                <div key={field} className="flex flex-col gap-1">
                  <Label htmlFor={`map-${field}`}>
                    {FIELD_LABELS[field]}
                    {field !== "date" ? <span className="text-critical"> *</span> : " (optional)"}
                  </Label>
                  <Select
                    id={`map-${field}`}
                    data-testid={`map-${field}`}
                    value={mapping[field]?.index ?? ""}
                    onChange={(e) => {
                      const index = e.target.value === "" ? null : Number(e.target.value);
                      setMapping((m) => ({
                        ...m,
                        [field]:
                          index === null
                            ? undefined
                            : sheet.headers.find((h) => h.index === index),
                      }));
                    }}
                  >
                    <option value="">— not mapped —</option>
                    {sheet.headers.map((h) => (
                      <option key={h.index} value={h.index}>
                        {h.letter} — {h.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            {!mappingState.ok ? (
              <p className="text-xs text-critical">
                Missing required column{mappingState.missing.length > 1 ? "s" : ""}:{" "}
                {mappingState.missing.map((f) => FIELD_LABELS[f]).join(", ")}. Map them
                above to continue.
              </p>
            ) : null}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!mappingState.ok}
                onClick={runValidation}
                data-testid="to-validation"
              >
                Validate & preview
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === 3 && report ? (
        <>
          <Card>
            <CardHeader
              title="Validation summary"
              subtitle={`${report.fileName} · sheet ${report.sheetName}`}
            />
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-5 pb-4 text-sm sm:grid-cols-3">
              {(
                [
                  ["Records", report.recordCount.toLocaleString()],
                  [
                    "Date range",
                    report.dateRange
                      ? `${report.dateRange.from} → ${report.dateRange.to}`
                      : "No dates found",
                  ],
                  ["Employees", String(report.employeeCount)],
                  ["Total hours", formatHours(report.totalHours)],
                  ["Billable candidate rows", report.billableCandidateRows.toLocaleString()],
                  ["Development candidate rows", report.developmentCandidateRows.toLocaleString()],
                  ["Unknown development codes", String(report.unknownDevelopmentCodes.length)],
                  ["Missing WBS", String(report.missingWbs)],
                  ["Missing employee", String(report.missingEmployee)],
                  ["Missing/zero hours", String(report.missingHours)],
                  ["Missing short description", String(report.missingShortDescription)],
                  ["Possible duplicates", String(report.duplicateRows)],
                  ["Unclassified rows", String(report.unclassifiedRows)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <React.Fragment key={label}>
                  <div className="flex justify-between gap-2 border-b border-grid py-1">
                    <span className="text-xs text-ink-2">{label}</span>
                    <span className="text-xs font-semibold text-ink tnum">{value}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {report.unknownDevelopmentCodes.length > 0 ? (
              <div className="px-5 pb-4">
                <p className="mb-1.5 text-xs font-medium text-ink-2">
                  Unknown development codes (add them in Admin → Code Master, or import
                  now and resolve later on the Data Quality page):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {report.unknownDevelopmentCodes.slice(0, 30).map((u) => (
                    <Badge key={u.code} tone="warning" className="font-mono">
                      {u.code} · {u.rows} rows · {formatHours(u.hours)}h
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader
              title="Reporting period"
              subtitle="Detected from the dominant month in the data — confirm or adjust"
            />
            <div className="flex items-center gap-3 px-5 pb-4">
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-8 rounded-md border border-hairline bg-surface px-2.5 text-sm"
                aria-label="Reporting period"
                data-testid="period-input"
              />
              <span className="text-sm font-medium text-ink">{periodLabel(period)}</span>
              {existing ? (
                <label className="ml-4 flex items-center gap-2 text-xs text-critical">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  A dataset for {periodLabel(period)} already exists — replace it
                </label>
              ) : null}
            </div>
          </Card>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back to mapping
            </Button>
            <Button
              variant="primary"
              disabled={!period || (!!existing && !replaceExisting)}
              onClick={() => void confirmImport()}
              data-testid="confirm-import"
            >
              Confirm import
            </Button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-good" />
            <p className="text-base font-semibold text-ink">
              {periodLabel(importedPeriod)} imported and classified
            </p>
            <p className="max-w-md text-xs text-muted">
              The dataset was processed with configuration {config.version} and is now
              available on the dashboard. The validation report is kept with the
              dataset.
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={onDone} data-testid="go-dashboard">
                <FileSpreadsheet className="h-4 w-4" />
                Open dashboard
              </Button>
              <Button
                onClick={() => {
                  setStep(1);
                  setWorkbook(null);
                  setReport(null);
                  setReplaceExisting(false);
                }}
              >
                Import another file
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { RefreshCcw, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Badge, Button, Card, CardHeader, Dialog } from "../ui/primitives";
import { formatDate, formatHours } from "@/core/format";
import type { Dataset } from "@/core/types";

/**
 * Dataset / history management: one row per reporting period, with the frozen
 * configuration version each was processed under. Reprocessing with the
 * current configuration is an explicit, warned action — never automatic.
 */
export function DatasetsView() {
  const { datasets, config, deleteDataset, reprocessDataset } = useAppStore();
  const [confirmDelete, setConfirmDelete] = React.useState<Dataset | null>(null);
  const [confirmReprocess, setConfirmReprocess] = React.useState<Dataset | null>(null);
  const [inspect, setInspect] = React.useState<Dataset | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Reporting periods"
          subtitle="Previously loaded months are preserved; uploading the same period again requires an explicit replace"
        />
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grid text-left text-xs font-semibold text-ink-2">
                <th className="px-2 py-2">Period</th>
                <th className="px-2 py-2">Uploaded on</th>
                <th className="px-2 py-2 text-right">Records</th>
                <th className="px-2 py-2 text-right">Total hours</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Config version</th>
                <th className="px-2 py-2">Source file</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-xs text-muted">
                    No datasets yet — use Import to load the first monthly Excel file.
                  </td>
                </tr>
              ) : (
                [...datasets]
                  .sort((a, b) => b.period.localeCompare(a.period))
                  .map((d) => (
                    <tr key={d.id} className="border-b border-grid last:border-b-0">
                      <td className="px-2 py-2 font-medium text-ink">{d.periodLabel}</td>
                      <td className="px-2 py-2 text-ink-2">
                        {formatDate(d.uploadedAt.slice(0, 10))}
                      </td>
                      <td className="px-2 py-2 text-right tnum">
                        {d.validation.recordCount.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-right tnum">
                        {formatHours(d.validation.totalHours)}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone="good">{d.status}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={d.configVersion === config.version ? "accent" : "neutral"}>
                          {d.configVersion}
                        </Badge>
                      </td>
                      <td className="max-w-40 truncate px-2 py-2 text-xs text-muted" title={d.fileName}>
                        {d.fileName}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" onClick={() => setInspect(d)}>
                            Validation
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setConfirmReprocess(d)}
                            title="Reprocess with current configuration"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => setConfirmDelete(d)}
                            title="Delete dataset"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={confirmReprocess !== null}
        onClose={() => setConfirmReprocess(null)}
        title="Reprocess dataset?"
        subtitle={confirmReprocess?.periodLabel}
      >
        <p className="text-sm text-ink-2">
          This re-classifies {confirmReprocess?.periodLabel} with the{" "}
          <strong>current configuration ({config.version})</strong>, replacing results
          produced with configuration {confirmReprocess?.configVersion}. Previously
          generated snapshots are not affected, but the live dashboard numbers for this
          period may change. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setConfirmReprocess(null)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (confirmReprocess) await reprocessDataset(confirmReprocess.id);
              setConfirmReprocess(null);
            }}
          >
            Reprocess with {config.version}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete dataset?"
        subtitle={confirmDelete?.periodLabel}
      >
        <p className="text-sm text-ink-2">
          This permanently removes the {confirmDelete?.periodLabel} dataset (
          {confirmDelete?.validation.recordCount.toLocaleString()} records) from the
          application. Snapshots already generated from it remain valid files.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (confirmDelete) await deleteDataset(confirmDelete.id);
              setConfirmDelete(null);
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={inspect !== null}
        onClose={() => setInspect(null)}
        title={`Validation report — ${inspect?.periodLabel ?? ""}`}
        subtitle={`${inspect?.fileName ?? ""} · processed ${
          inspect ? formatDate(inspect.processedAt.slice(0, 10)) : ""
        } with configuration ${inspect?.configVersion ?? ""}`}
      >
        {inspect ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {(
              [
                ["Records", inspect.validation.recordCount.toLocaleString()],
                [
                  "Date range",
                  inspect.validation.dateRange
                    ? `${inspect.validation.dateRange.from} → ${inspect.validation.dateRange.to}`
                    : "—",
                ],
                ["Employees", String(inspect.validation.employeeCount)],
                ["Total hours", formatHours(inspect.validation.totalHours)],
                ["Billable rows", inspect.validation.billableCandidateRows.toLocaleString()],
                ["Development rows", inspect.validation.developmentCandidateRows.toLocaleString()],
                ["Unknown codes", String(inspect.validation.unknownDevelopmentCodes.length)],
                ["Missing WBS", String(inspect.validation.missingWbs)],
                ["Missing employee", String(inspect.validation.missingEmployee)],
                ["Missing/zero hours", String(inspect.validation.missingHours)],
                ["Missing description", String(inspect.validation.missingShortDescription)],
                ["Possible duplicates", String(inspect.validation.duplicateRows)],
                ["Unclassified rows", String(inspect.validation.unclassifiedRows)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-grid py-1">
                <span className="text-xs text-ink-2">{label}</span>
                <span className="text-xs font-semibold text-ink tnum">{value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

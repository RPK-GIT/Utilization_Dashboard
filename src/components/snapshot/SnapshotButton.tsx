"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button, Dialog } from "../ui/primitives";
import {
  buildSnapshotPayload,
  injectPayload,
  snapshotFileName,
} from "@/core/snapshot/build";
import { hasActiveFilters } from "@/core/filters/engine";

/**
 * Generates the self-contained executive HTML snapshot: fetches the prebuilt
 * single-file viewer template, injects the frozen payload (classified rows +
 * display configuration + filter state) and downloads it. The result opens
 * from disk with no backend, upload or network access, and contains no admin
 * surface.
 */
export function SnapshotButton() {
  const { datasets, config, filters } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const generate = async (scope: "current-view" | "full") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/snapshot/index.html");
      if (!response.ok) throw new Error("template");
      const template = await response.text();
      const payload = buildSnapshotPayload({
        datasets,
        config,
        filters,
        scope,
        generatedAt: new Date().toISOString(),
      });
      const html = injectPayload(template, payload);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = snapshotFileName(payload);
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError(
        "The snapshot template is not available. Run `npm run build:snapshot` and reload, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const filtered = hasActiveFilters(filters);

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
        onClose={() => setOpen(false)}
        title="Generate Executive Snapshot"
        subtitle="A single self-contained HTML file — senior management opens it directly, with no upload, configuration or server"
      >
        <div className="flex flex-col gap-3">
          {error ? (
            <p className="rounded-md border border-critical/30 bg-red-50 px-3 py-2 text-xs text-critical">
              {error}
            </p>
          ) : null}
          <p className="text-sm text-ink-2">
            The snapshot freezes the data as it is now: later changes to datasets or
            configuration will not alter the generated file. Admin and configuration
            screens are not included.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void generate("current-view")}
              data-testid="snapshot-current-view"
            >
              Generate: Current view
              {filtered ? " (keeps the active filters)" : ""}
            </Button>
            <Button
              disabled={busy}
              onClick={() => void generate("full")}
              data-testid="snapshot-full"
            >
              Generate: Entire dashboard
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

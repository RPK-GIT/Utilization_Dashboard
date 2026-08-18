"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { goBack } from "../navigation";

/**
 * Reusable floating Back button for every detail/drill-down page. It sticks
 * just below the app header while the page scrolls, so the user never has to
 * scroll back to the top of a long table to leave a detail view. One single
 * element (position: sticky) — no duplicates appear on scroll. Clicking it
 * uses the shared history-based goBack(), so the exact previous context
 * (page, filters, dates, tab/sort state) is restored; the same component and
 * behavior ship inside the standalone executive snapshot.
 *
 * --app-header-h is measured by the dashboard shell, so the button always
 * clears the sticky header regardless of how many filter chips are shown.
 */
export function BackButton() {
  return (
    <div
      className="sticky z-30 self-start"
      style={{ top: "calc(var(--app-header-h, 110px) + 8px)" }}
    >
      <button
        type="button"
        onClick={() => goBack()}
        data-testid="detail-back"
        aria-label="Go back"
        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface/95 px-3 py-1.5 text-sm font-medium text-ink shadow-[0_2px_8px_rgba(11,11,11,0.14)] backdrop-blur transition-colors hover:bg-page cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
    </div>
  );
}

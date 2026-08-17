"use client";

import * as React from "react";
import { Input, Label } from "../ui/primitives";
import { validateDateRange } from "@/core/filters/engine";

/**
 * Explicitly-labeled date range filter. Validation runs immediately on every
 * change: To Date can never be earlier than From Date, and Apply stays
 * disabled while the range is invalid. Either side may be left empty
 * (open-ended); both empty means no date filter.
 */
export function DateRangeFilter({
  from,
  to,
  onApply,
}: {
  from: string | null;
  to: string | null;
  onApply: (from: string | null, to: string | null) => void;
}) {
  const [draftFrom, setDraftFrom] = React.useState(from ?? "");
  const [draftTo, setDraftTo] = React.useState(to ?? "");

  // Re-sync drafts when the applied filters change externally (Clear filters,
  // chip removal) — state adjustment during render, per React guidance.
  const [seen, setSeen] = React.useState({ from, to });
  if (seen.from !== from || seen.to !== to) {
    setSeen({ from, to });
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
  }

  const validation = validateDateRange(draftFrom || null, draftTo || null);
  const dirty = (draftFrom || null) !== from || (draftTo || null) !== to;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Label htmlFor="filter-from-date">From Date</Label>
          <Input
            id="filter-from-date"
            type="date"
            data-testid="from-date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            aria-invalid={!validation.ok}
          />
        </span>
        <span className="flex items-center gap-1.5">
          <Label htmlFor="filter-to-date">To Date</Label>
          <Input
            id="filter-to-date"
            type="date"
            data-testid="to-date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            aria-invalid={!validation.ok}
          />
        </span>
        <button
          type="button"
          data-testid="apply-dates"
          disabled={!validation.ok || !dirty}
          onClick={() => onApply(draftFrom || null, draftTo || null)}
          className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-white hover:bg-accent-deep disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
        >
          Apply
        </button>
      </div>
      {!validation.ok ? (
        <p className="text-xs font-medium text-critical" data-testid="date-error" role="alert">
          {validation.error}
        </p>
      ) : null}
    </div>
  );
}

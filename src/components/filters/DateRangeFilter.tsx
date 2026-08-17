"use client";

import * as React from "react";
import { Input, Label } from "../ui/primitives";
import { validateDateRange } from "@/core/filters/engine";

/**
 * Explicitly-labeled date range inputs editing the shared DRAFT filter state.
 * Validation runs immediately on every change (To Date can never be earlier
 * than From Date); the filter bar disables the global "Apply Filters" action
 * while the range is invalid. Either side may be left empty (open-ended);
 * both empty means no date filter.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}) {
  const validation = validateDateRange(from, to);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Label htmlFor="filter-from-date">From Date</Label>
          <Input
            id="filter-from-date"
            type="date"
            data-testid="from-date"
            value={from ?? ""}
            onChange={(e) => onChange(e.target.value || null, to)}
            aria-invalid={!validation.ok}
          />
        </span>
        <span className="flex items-center gap-1.5">
          <Label htmlFor="filter-to-date">To Date</Label>
          <Input
            id="filter-to-date"
            type="date"
            data-testid="to-date"
            value={to ?? ""}
            onChange={(e) => onChange(from, e.target.value || null)}
            aria-invalid={!validation.ok}
          />
        </span>
      </div>
      {!validation.ok ? (
        <p className="text-xs font-medium text-critical" data-testid="date-error" role="alert">
          {validation.error}
        </p>
      ) : null}
    </div>
  );
}

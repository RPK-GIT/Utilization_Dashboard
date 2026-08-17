"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "../ui/primitives";

/**
 * Checkbox multi-select popover used by every categorical filter (Period,
 * Team, Employee, Category, Activity). Selections edit the shared DRAFT
 * filter state owned by the filter bar — nothing recalculates until the
 * single global "Apply Filters" action commits all dimensions together.
 * Values within one filter combine with OR, different filters with AND
 * (enforced centrally by the core filter engine). Search is
 * case-insensitive over label, sublabel and keywords.
 */

export interface MultiSelectOption {
  value: string;
  /** Primary label (for activities: the business description). */
  label: string;
  /** Secondary line (for activities: "CODE · Category"). */
  sublabel?: string;
  /** Extra search terms (e.g. the code and category). */
  keywords?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = "Search…",
  testId,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  testId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.sublabel ?? ""} ${o.keywords ?? ""}`.toUpperCase().includes(q),
    );
  }, [options, search]);

  const toggle = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );

  const plural = label.toLowerCase().endsWith("y")
    ? `${label.toLowerCase().slice(0, -1)}ies`
    : `${label.toLowerCase()}s`;
  const buttonLabel =
    selected.length === 0
      ? `All ${plural}`
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${label}: ${selected.length} selected`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setSearch("");
          setOpen((v) => !v);
        }}
        className={`flex h-8 max-w-64 items-center gap-1.5 rounded-md border px-2.5 text-sm cursor-pointer focus:outline-2 focus:outline-accent/50 ${
          selected.length > 0
            ? "border-accent/50 bg-accent-soft/40 text-accent-deep font-medium"
            : "border-hairline bg-surface text-ink"
        }`}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-30 w-80 rounded-lg border border-hairline bg-surface p-2 shadow-xl">
          {searchable ? (
            <Input
              autoFocus
              value={search}
              data-testid={`${testId}-search`}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="mb-2 w-full"
              aria-label={`Search ${label.toLowerCase()}`}
            />
          ) : null}
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={`${label} options`}
            className="max-h-72 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-muted">No matches</li>
            ) : (
              filtered.map((o) => {
                const isSelected = selected.includes(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer ${
                        isSelected ? "bg-accent-soft/50" : "hover:bg-page"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-accent bg-accent text-white"
                            : "border-axis bg-surface"
                        }`}
                        aria-hidden
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">{o.label}</span>
                        {o.sublabel ? (
                          <span className="block text-[11px] text-muted">{o.sublabel}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-grid pt-1.5">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() =>
                  onChange([...new Set([...selected, ...filtered.map((o) => o.value)])])
                }
                className="rounded px-2 py-1 text-xs font-medium text-ink-2 hover:bg-page cursor-pointer"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded px-2 py-1 text-xs font-medium text-ink-2 hover:bg-page cursor-pointer"
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid={`${testId}-done`}
              className="rounded-md bg-page px-3 py-1 text-xs font-medium text-ink border border-hairline hover:bg-grid/50 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

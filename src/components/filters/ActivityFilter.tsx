"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input, Select } from "../ui/primitives";

/**
 * Description-first multi-select for development activities. Options display
 * "Description (CODE)" and search matches description, code AND category, so
 * typing either "Digital Time" or "DTEC" finds the same item. Labels are
 * derived from configuration + data — never hardcoded.
 */

export interface ActivityOption {
  code: string;
  description: string;
  category: string;
  label: string;
}

export function ActivityFilter({
  options,
  selected,
  onChange,
}: {
  options: ActivityOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
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

  const categories = React.useMemo(
    () => [...new Set(options.map((o) => o.category))].sort(),
    [options],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toUpperCase();
    return options.filter((o) => {
      if (category && o.category !== category) return false;
      if (!q) return true;
      return (
        o.description.toUpperCase().includes(q) ||
        o.code.toUpperCase().includes(q) ||
        o.category.toUpperCase().includes(q)
      );
    });
  }, [options, search, category]);

  const toggle = (code: string) => {
    onChange(
      selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code],
    );
  };

  const buttonLabel =
    selected.length === 0
      ? "All activities"
      : selected.length === 1
        ? (options.find((o) => o.code === selected[0])?.label ?? selected[0])
        : `${selected.length} activities`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid="activity-filter"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Activity"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 max-w-64 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-sm text-ink cursor-pointer focus:outline-2 focus:outline-accent/50"
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-30 w-96 rounded-lg border border-hairline bg-surface p-2 shadow-xl">
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={search}
              data-testid="activity-search"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, code or category…"
              className="flex-1"
              aria-label="Search activities"
            />
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="w-32"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="mt-2 max-h-72 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-muted">
                No matching activities
              </li>
            ) : (
              filtered.map((o) => {
                const isSelected = selected.includes(o.code);
                return (
                  <li key={o.code} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => toggle(o.code)}
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
                        <span className="block text-[11px] text-muted">{o.category}</span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {selected.length > 0 ? (
            <div className="mt-1 border-t border-grid pt-1.5 text-right">
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded px-2 py-1 text-xs font-medium text-accent-deep hover:bg-page cursor-pointer"
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

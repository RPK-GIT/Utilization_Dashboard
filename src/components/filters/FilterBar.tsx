"use client";

import * as React from "react";
import { FilterX, SlidersHorizontal } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Chip } from "../ui/primitives";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import {
  clearFilters,
  hasActiveFilters,
  validateDateRange,
} from "@/core/filters/engine";
import { activityLabel, periodLabel } from "@/core/format";
import type { FilterState } from "@/core/types";

/**
 * Executive filter bar with a strict DRAFT vs APPLIED separation:
 * checkboxes and date inputs edit the draft; the single "Apply Filters"
 * action validates and commits every dimension together to the central
 * applied state (which drives all KPIs, charts, tables, drilldowns and
 * snapshots). "Clear All" resets the applied state. Values within one
 * filter OR together; different filters AND together.
 */

interface ChipGroup {
  key: "periods" | "teams" | "employees" | "categories" | "codes";
  label: string;
  values: string[];
  display: (value: string) => string;
}

export function FilterBar() {
  const { rows, filters, setFilters, availablePeriods, config } = useDashboard();

  // Draft state, re-seeded whenever the applied state changes externally
  // (chip removal, Clear All) — state adjustment during render.
  const [draft, setDraft] = React.useState<FilterState>(filters);
  const [seenApplied, setSeenApplied] = React.useState(filters);
  if (seenApplied !== filters) {
    setSeenApplied(filters);
    setDraft(filters);
  }

  const employees = React.useMemo(
    () => [...new Set(rows.map((r) => r.employee).filter(Boolean))].sort(),
    [rows],
  );
  const teams = React.useMemo(
    () => config.teams.filter((t) => t.active).map((t) => t.name),
    [config.teams],
  );
  const categories = React.useMemo(() => {
    const inData = new Set(
      rows.map((r) => r.developmentCategory).filter((c): c is string => !!c),
    );
    return [...inData].sort();
  }, [rows]);

  // Activity options: codes present in the data, described from configuration
  // (description first, code secondary — search matches either, any case).
  const activityOptions = React.useMemo<MultiSelectOption[]>(() => {
    const codesInData = [
      ...new Set(rows.map((r) => r.developmentCode).filter((c): c is string => !!c)),
    ];
    return codesInData
      .map((code) => {
        const configured = config.codes.find(
          (c) => c.code.toUpperCase() === code.toUpperCase(),
        );
        const description = configured?.description ?? "Unknown code";
        const category = configured?.category ?? "Unknown";
        return {
          value: code,
          label: description === "Unknown code" ? `Unknown code (${code})` : description,
          sublabel: `${code} · ${category}`,
          keywords: `${code} ${category}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, config.codes]);

  const codeLabel = React.useCallback(
    (code: string) =>
      activityLabel(
        config.codes.find((c) => c.code.toUpperCase() === code.toUpperCase())
          ?.description,
        code,
      ),
    [config.codes],
  );

  const dateValidation = validateDateRange(draft.dateFrom, draft.dateTo);
  const dirty = JSON.stringify(draft) !== JSON.stringify(filters);
  const appliedActive = hasActiveFilters(filters);

  const setList =
    (key: ChipGroup["key"]) =>
    (values: string[]) =>
      setDraft((d) => ({ ...d, [key]: values }));

  const appliedCount =
    (filters.periods.length ? 1 : 0) +
    (filters.teams.length ? 1 : 0) +
    (filters.employees.length ? 1 : 0) +
    (filters.categories.length ? 1 : 0) +
    (filters.codes.length ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  const chipGroups: ChipGroup[] = [
    { key: "periods", label: "Period", values: filters.periods, display: periodLabel },
    { key: "teams", label: "Team", values: filters.teams, display: (v) => v },
    { key: "employees", label: "Employee", values: filters.employees, display: (v) => v },
    { key: "categories", label: "Category", values: filters.categories, display: (v) => v },
    { key: "codes", label: "Activity", values: filters.codes, display: codeLabel },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Period"
          testId="filter-period"
          options={availablePeriods.map((p) => ({ value: p.period, label: p.label }))}
          selected={draft.periods}
          onChange={setList("periods")}
        />
        <MultiSelectFilter
          label="Team"
          testId="filter-team"
          options={teams.map((t) => ({ value: t, label: t }))}
          selected={draft.teams}
          onChange={setList("teams")}
        />
        <MultiSelectFilter
          label="Employee"
          testId="filter-employee"
          searchable
          searchPlaceholder="Search employees…"
          options={employees.map((e) => ({ value: e, label: e }))}
          selected={draft.employees}
          onChange={setList("employees")}
        />
        <MultiSelectFilter
          label="Category"
          testId="filter-category"
          options={categories.map((c) => ({ value: c, label: c }))}
          selected={draft.categories}
          onChange={setList("categories")}
        />
        <MultiSelectFilter
          label="Activity"
          testId="filter-activity"
          searchable
          searchPlaceholder="Search description, code or category…"
          options={activityOptions}
          selected={draft.codes}
          onChange={setList("codes")}
        />
        <DateRangeFilter
          from={draft.dateFrom}
          to={draft.dateTo}
          onChange={(dateFrom, dateTo) => setDraft((d) => ({ ...d, dateFrom, dateTo }))}
        />
        <button
          type="button"
          data-testid="apply-filters"
          disabled={!dateValidation.ok || !dirty}
          onClick={() => setFilters(draft)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-deep disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Apply Filters
        </button>
        {appliedActive || dirty ? (
          <button
            type="button"
            data-testid="clear-filters"
            onClick={() => setFilters(clearFilters())}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-2 hover:bg-page cursor-pointer"
          >
            <FilterX className="h-3.5 w-3.5" />
            Clear All
          </button>
        ) : null}
        {dirty && dateValidation.ok ? (
          <span className="text-xs font-medium text-accent-deep" data-testid="unapplied-hint">
            Unapplied changes — click Apply Filters
          </span>
        ) : null}
      </div>
      {appliedActive ? (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
          <span className="text-xs font-medium text-muted">
            {appliedCount} filter{appliedCount === 1 ? "" : "s"} applied:
          </span>
          {chipGroups.map((group) => {
            if (group.values.length === 0) return null;
            // Few values: individual removable chips. Many: one summary chip.
            if (group.values.length <= 3) {
              return group.values.map((value) => (
                <Chip
                  key={`${group.key}:${value}`}
                  label={`${group.label}: ${group.display(value)}`}
                  onRemove={() =>
                    setFilters({
                      ...filters,
                      [group.key]: group.values.filter((v) => v !== value),
                    })
                  }
                />
              ));
            }
            return (
              <span key={group.key} title={group.values.map(group.display).join(", ")}>
                <Chip
                  label={`${group.label}: ${group.values.length} selected`}
                  onRemove={() => setFilters({ ...filters, [group.key]: [] })}
                />
              </span>
            );
          })}
          {filters.dateFrom ? (
            <Chip
              label={`From Date: ${filters.dateFrom}`}
              onRemove={() => setFilters({ ...filters, dateFrom: null })}
            />
          ) : null}
          {filters.dateTo ? (
            <Chip
              label={`To Date: ${filters.dateTo}`}
              onRemove={() => setFilters({ ...filters, dateTo: null })}
            />
          ) : null}
          {filters.search.trim() ? (
            <Chip
              label={`Search: ${filters.search.trim()}`}
              onRemove={() => setFilters({ ...filters, search: "" })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

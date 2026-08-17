"use client";

import * as React from "react";
import { FilterX } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Button, Chip } from "../ui/primitives";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { clearFilters, hasActiveFilters } from "@/core/filters/engine";
import { activityLabel, periodLabel } from "@/core/format";
import type { FilterState } from "@/core/types";

/**
 * Executive filter bar — one row above everything it scopes. Every filter is
 * a checkbox multi-select (values within one filter OR together; different
 * filters AND together); the date range is explicitly labeled and validated.
 * Active selections render as chips, summarized when a dimension has many
 * values.
 */

interface ChipGroup {
  key: keyof FilterState;
  label: string;
  values: string[];
  display: (value: string) => string;
}

export function FilterBar() {
  const { rows, filters, setFilters, availablePeriods, config } = useDashboard();

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
  // (description first, code secondary — searchable by either).
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

  const active = hasActiveFilters(filters);
  const setList =
    (key: "periods" | "teams" | "employees" | "categories" | "codes") =>
    (values: string[]) =>
      setFilters({ ...filters, [key]: values });

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
          selected={filters.periods}
          onApply={setList("periods")}
        />
        <MultiSelectFilter
          label="Team"
          testId="filter-team"
          options={teams.map((t) => ({ value: t, label: t }))}
          selected={filters.teams}
          onApply={setList("teams")}
        />
        <MultiSelectFilter
          label="Employee"
          testId="filter-employee"
          searchable
          searchPlaceholder="Search employees…"
          options={employees.map((e) => ({ value: e, label: e }))}
          selected={filters.employees}
          onApply={setList("employees")}
        />
        <MultiSelectFilter
          label="Category"
          testId="filter-category"
          options={categories.map((c) => ({ value: c, label: c }))}
          selected={filters.categories}
          onApply={setList("categories")}
        />
        <MultiSelectFilter
          label="Activity"
          testId="filter-activity"
          searchable
          searchPlaceholder="Search description, code or category…"
          options={activityOptions}
          selected={filters.codes}
          onApply={setList("codes")}
        />
        <DateRangeFilter
          from={filters.dateFrom}
          to={filters.dateTo}
          onApply={(dateFrom, dateTo) => setFilters({ ...filters, dateFrom, dateTo })}
        />
        {active ? (
          <Button variant="ghost" onClick={() => setFilters(clearFilters())}>
            <FilterX className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>
      {active ? (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
          <span className="text-xs font-medium text-muted">Filtered:</span>
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
              <span
                key={group.key}
                title={group.values.map(group.display).join(", ")}
              >
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

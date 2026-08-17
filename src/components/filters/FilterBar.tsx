"use client";

import * as React from "react";
import { FilterX } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Button, Chip, Input, Select } from "../ui/primitives";
import { ActivityFilter, type ActivityOption } from "./ActivityFilter";
import {
  clearFilters,
  filterChips,
  hasActiveFilters,
  removeChip,
} from "@/core/filters/engine";
import { activityLabel, periodLabel } from "@/core/format";

/**
 * Executive filter bar — one row above everything it scopes. Every KPI,
 * chart, table and drilldown below re-renders against the same slice.
 * Active filters render as removable chips; activity chips are
 * description-first.
 */
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

  // Activity options: codes present in the data, described from configuration.
  const activityOptions = React.useMemo<ActivityOption[]>(() => {
    const codesInData = [
      ...new Set(rows.map((r) => r.developmentCode).filter((c): c is string => !!c)),
    ];
    return codesInData
      .map((code) => {
        const configured = config.codes.find(
          (c) => c.code.toUpperCase() === code.toUpperCase(),
        );
        const description = configured?.description ?? null;
        return {
          code,
          description: description ?? "Unknown code",
          category: configured?.category ?? "Unknown",
          label: activityLabel(description, code),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, config.codes]);

  const codeLabel = React.useCallback(
    (code: string) =>
      activityOptions.find((o) => o.code === code)?.label ??
      activityLabel(
        config.codes.find((c) => c.code.toUpperCase() === code.toUpperCase())
          ?.description,
        code,
      ),
    [activityOptions, config.codes],
  );

  const chips = filterChips(filters, periodLabel, codeLabel);
  const active = hasActiveFilters(filters);

  const single = (values: string[]) => (values.length === 1 ? values[0] : "");
  const setList = (key: "periods" | "teams" | "employees" | "categories") =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setFilters({ ...filters, [key]: e.target.value ? [e.target.value] : [] });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Period"
          value={single(filters.periods)}
          onChange={setList("periods")}
        >
          <option value="">All periods</option>
          {availablePeriods.map((p) => (
            <option key={p.period} value={p.period}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Team" value={single(filters.teams)} onChange={setList("teams")}>
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Employee"
          value={single(filters.employees)}
          onChange={setList("employees")}
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Category"
          value={single(filters.categories)}
          onChange={setList("categories")}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <ActivityFilter
          options={activityOptions}
          selected={filters.codes}
          onChange={(codes) => setFilters({ ...filters, codes })}
        />
        <Input
          type="date"
          aria-label="From date"
          value={filters.dateFrom ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, dateFrom: e.target.value || null })
          }
        />
        <Input
          type="date"
          aria-label="To date"
          value={filters.dateTo ?? ""}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || null })}
        />
        {active ? (
          <Button variant="ghost" onClick={() => setFilters(clearFilters())}>
            <FilterX className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
          <span className="text-xs font-medium text-muted">Filtered:</span>
          {chips.map((chip) => (
            <Chip
              key={`${chip.kind}:${chip.value}`}
              label={chip.label}
              onRemove={() => setFilters(removeChip(filters, chip))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

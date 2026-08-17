"use client";

import * as React from "react";
import { FilterX } from "lucide-react";
import { useDashboard } from "../DashboardContext";
import { Button, Chip, Input, Select } from "../ui/primitives";
import { clearFilters, filterChips, hasActiveFilters, removeChip } from "@/core/filters/engine";
import { periodLabel } from "@/core/format";

/**
 * Executive filter bar — one row above everything it scopes. Every KPI,
 * chart, table and drilldown below re-renders against the same slice.
 * Active filters render as removable chips.
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
  const codes = React.useMemo(
    () =>
      [...new Set(rows.map((r) => r.developmentCode).filter((c): c is string => !!c))].sort(),
    [rows],
  );

  const chips = filterChips(filters, periodLabel);
  const active = hasActiveFilters(filters);

  const single = (values: string[]) => (values.length === 1 ? values[0] : "");
  const setList = (key: "periods" | "teams" | "employees" | "categories" | "codes") =>
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
        <Select aria-label="Code" value={single(filters.codes)} onChange={setList("codes")}>
          <option value="">All codes</option>
          {codes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
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

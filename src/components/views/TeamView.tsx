"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { DataTable } from "../tables/DataTable";
import { EChart } from "../charts/EChart";
import { horizontalBars } from "../charts/builders";
import { EmployeeDrilldown } from "../drill/Drilldowns";
import { summarizeEmployees, type EmployeeSummary } from "@/core/metrics/engine";
import { formatHours, formatPercent } from "@/core/format";

/** Team utilization: sortable per-employee table with drilldown + visual ranking. */
export function TeamView() {
  const { filtered } = useDashboard();
  const [employee, setEmployee] = React.useState<string | null>(null);
  const summaries = React.useMemo(() => summarizeEmployees(filtered), [filtered]);

  const columns = React.useMemo<ColumnDef<EmployeeSummary, any>[]>(
    () => [
      { id: "employee", header: "Employee", accessorKey: "employee" },
      { id: "team", header: "Team", accessorKey: "team" },
      {
        id: "totalHours",
        header: "Total Hours",
        accessorKey: "totalHours",
        meta: { numeric: true },
        cell: (c) => formatHours(c.getValue()),
      },
      {
        id: "billableHours",
        header: "Billable Hours",
        accessorKey: "billableHours",
        meta: { numeric: true },
        cell: (c) => formatHours(c.getValue()),
      },
      {
        id: "billablePercentage",
        header: "Billable %",
        accessorKey: "billablePercentage",
        meta: { numeric: true },
        cell: (c) => formatPercent(c.getValue()),
      },
      {
        id: "ipHours",
        header: "IP Hours",
        accessorKey: "ipHours",
        meta: { numeric: true },
        cell: (c) => formatHours(c.getValue()),
      },
      {
        id: "acceleratorHours",
        header: "Accelerator Hours",
        accessorKey: "acceleratorHours",
        meta: { numeric: true },
        cell: (c) => formatHours(c.getValue()),
      },
      {
        id: "productiveHours",
        header: "Productive Hours",
        accessorKey: "productiveHours",
        meta: { numeric: true },
        cell: (c) => formatHours(c.getValue()),
      },
      {
        id: "productivePercentage",
        header: "Productive %",
        accessorKey: "productivePercentage",
        meta: { numeric: true },
        cell: (c) => formatPercent(c.getValue()),
      },
    ],
    [],
  );

  const ranking = summaries
    .map((s) => ({ name: s.employee, value: s.billablePercentage }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Billable utilization ranking"
          subtitle="Individual billable % (overall percentages are always computed from summed hours, not averaged) — click a bar for detail"
        />
        <div className="px-3 pb-3">
          <EChart
            option={horizontalBars(ranking, { format: "percent" })}
            height={Math.max(180, ranking.length * 26 + 60)}
            onClick={(p) => p.name && setEmployee(p.name)}
            ariaLabel="Billable percentage ranking by employee"
          />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Team utilization detail"
          subtitle="Click a row to open the employee drilldown"
        />
        <div className="px-5 pb-4">
          <DataTable
            data={summaries}
            columns={columns}
            searchPlaceholder="Search employee or team…"
            onRowClick={(row) => setEmployee(row.employee)}
            csvName="team_utilization.csv"
            testId="team-table"
          />
        </div>
      </Card>
      <EmployeeDrilldown employee={employee} onClose={() => setEmployee(null)} />
    </div>
  );
}

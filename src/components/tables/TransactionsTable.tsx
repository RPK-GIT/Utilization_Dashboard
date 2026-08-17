"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ClassifiedRow } from "@/core/types";
import { formatDate, formatHours } from "@/core/format";
import { Badge } from "../ui/primitives";
import { DataTable } from "./DataTable";

const toneFor = (
  classification: ClassifiedRow["classification"],
): "good" | "accent" | "warning" | "critical" | "neutral" => {
  switch (classification) {
    case "Billable":
      return "good";
    case "Development":
      return "accent";
    case "Excluded":
    case "Not Billable":
      return "warning";
    case "Unclassified":
      return "critical";
    default:
      return "neutral";
  }
};

const COLUMNS: ColumnDef<ClassifiedRow, any>[] = [
  {
    id: "date",
    header: "Date",
    accessorKey: "date",
    cell: (c) => <span className="tnum whitespace-nowrap">{formatDate(c.getValue())}</span>,
  },
  { id: "employee", header: "Employee", accessorKey: "employee" },
  {
    id: "wbs",
    header: "WBS",
    accessorKey: "wbs",
    cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
  },
  {
    id: "shortText",
    header: "Short description",
    accessorKey: "shortText",
    cell: (c) => (
      <span className="block max-w-90 truncate" title={c.getValue()}>
        {c.getValue()}
      </span>
    ),
  },
  {
    id: "hours",
    header: "Hours",
    accessorKey: "hours",
    meta: { numeric: true },
    cell: (c) => formatHours(c.getValue()),
  },
  {
    id: "classification",
    header: "Classification",
    accessorKey: "classification",
    cell: (c) => <Badge tone={toneFor(c.getValue())}>{c.getValue()}</Badge>,
  },
  {
    id: "developmentCategory",
    header: "Category",
    accessorKey: "developmentCategory",
    cell: (c) => c.getValue() ?? "—",
  },
  {
    id: "classificationReason",
    header: "Reason",
    accessorKey: "classificationReason",
    cell: (c) => (
      <span className="block max-w-80 truncate text-xs text-ink-2" title={c.getValue()}>
        {c.getValue()}
      </span>
    ),
  },
];

/** Paginated, searchable raw-transaction table with classification traceability. */
export function TransactionsTable({
  rows,
  pageSize = 15,
  csvName,
  testId,
}: {
  rows: ClassifiedRow[];
  pageSize?: number;
  csvName?: string;
  testId?: string;
}) {
  return (
    <DataTable
      data={rows}
      columns={COLUMNS}
      pageSize={pageSize}
      searchPlaceholder="Search WBS, employee, description…"
      csvName={csvName}
      testId={testId}
    />
  );
}

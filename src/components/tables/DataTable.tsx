"use client";

import * as React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button, Input } from "../ui/primitives";
import { toCsv } from "@/core/export/csv";

/**
 * Data table on TanStack Table: sorting, global search, pagination, sticky
 * header, numeric formatting via column meta, optional CSV export and
 * row-level drilldown. Raw transactions render only through pagination —
 * never thousands of rows at once.
 */

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    numeric?: boolean;
  }
}

export function DataTable<T>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search…",
  pageSize = 15,
  onRowClick,
  csvName,
  emptyMessage = "No records in the current scope.",
  testId,
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  csvName?: string;
  emptyMessage?: string;
  testId?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const downloadCsv = () => {
    const visible = table.getAllLeafColumns();
    const headers = visible.map((c) =>
      typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
    );
    const rows = table
      .getFilteredRowModel()
      .rows.map((r) => visible.map((c) => r.getValue(c.id)));
    const blob = new Blob([toCsv(headers, rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvName ?? "export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      {(searchable || csvName) && (
        <div className="flex items-center justify-between gap-2">
          {searchable ? (
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-64"
              aria-label="Search table"
            />
          ) : (
            <span />
          )}
          {csvName ? (
            <Button variant="ghost" onClick={downloadCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          ) : null}
        </div>
      )}
      <div className="overflow-x-auto rounded-md border border-grid">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-page">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const numeric = header.column.columnDef.meta?.numeric;
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`border-b border-grid px-3 py-2 text-xs font-semibold text-ink-2 select-none ${
                        numeric ? "text-right" : "text-left"
                      } ${header.column.getCanSort() ? "cursor-pointer hover:text-ink" : ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-xs text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-grid last:border-b-0 hover:bg-page ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-3 py-1.5 text-ink ${
                        cell.column.columnDef.meta?.numeric ? "text-right tnum" : ""
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="tnum">
            {filteredCount.toLocaleString()} rows · page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

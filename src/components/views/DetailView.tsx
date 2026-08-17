"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import { Card, CardHeader } from "../ui/primitives";
import { TransactionsTable } from "../tables/TransactionsTable";
import { formatHours } from "@/core/format";

/** Detailed analysis — every classified transaction in the current scope. */
export function DetailView() {
  const { filtered } = useDashboard();
  const total = filtered.reduce((a, r) => a + r.hours, 0);
  return (
    <Card>
      <CardHeader
        title="Detailed transactions"
        subtitle={`${filtered.length.toLocaleString()} records · ${formatHours(total)} hours in the current scope — search covers WBS, employee and description`}
      />
      <div className="px-5 pb-4">
        <TransactionsTable
          rows={filtered}
          pageSize={20}
          csvName="transactions.csv"
          testId="detail-table"
        />
      </div>
    </Card>
  );
}

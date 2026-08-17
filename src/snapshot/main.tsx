import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Users,
} from "lucide-react";
import "../app/globals.css";
import type { FilterState, SnapshotPayload } from "@/core/types";
import { DashboardProvider } from "@/components/DashboardContext";
import { DashboardApp, type SectionDef } from "@/components/DashboardApp";
import { OverviewView } from "@/components/views/OverviewView";
import { TeamView } from "@/components/views/TeamView";
import { IpAccelView } from "@/components/views/IpAccelView";
import { ActivitiesView } from "@/components/views/ActivitiesView";
import { DetailView } from "@/components/views/DetailView";

/**
 * Executive snapshot viewer. Built by Vite as ONE self-contained HTML file
 * (all JS/CSS inlined). The interactive app injects the frozen payload into
 * the #snapshot-data script tag at generation time. Opening the file requires
 * no server, upload, login or network access — and this bundle deliberately
 * contains no admin, import or configuration components.
 */

// Executive sections only.
const SECTIONS: SectionDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, render: () => <OverviewView /> },
  { id: "team", label: "Team Utilization", icon: Users, render: () => <TeamView /> },
  {
    id: "ip-accelerators",
    label: "IP & Accelerators",
    icon: Lightbulb,
    render: () => <IpAccelView />,
  },
  { id: "activities", label: "Activities", icon: Activity, render: () => <ActivitiesView /> },
  { id: "detail", label: "Detailed Analysis", icon: ListChecks, render: () => <DetailView /> },
];

function readPayload(): SnapshotPayload | null {
  const tag = document.getElementById("snapshot-data");
  if (!tag?.textContent) return null;
  try {
    return JSON.parse(tag.textContent) as SnapshotPayload;
  } catch {
    return null;
  }
}

function SnapshotViewer({ payload }: { payload: SnapshotPayload }) {
  const [filters, setFilters] = React.useState<FilterState>(payload.initialFilters);
  return (
    <DashboardProvider
      value={{
        mode: "snapshot",
        rows: payload.rows,
        config: payload.config,
        filters,
        setFilters,
        availablePeriods: payload.availablePeriods,
        meta: {
          title: payload.title,
          subtitle: payload.subtitle,
          periodLabel: payload.periodLabel,
          generatedAt: payload.generatedAt,
          dataThrough: payload.dataThrough,
        },
      }}
    >
      <DashboardApp sections={SECTIONS} />
    </DashboardProvider>
  );
}

const payload = readPayload();
const root = createRoot(document.getElementById("root")!);
root.render(
  payload ? (
    <SnapshotViewer payload={payload} />
  ) : (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#52514e",
        fontSize: 14,
      }}
    >
      This snapshot file contains no embedded data. Please generate it again from the
      Utilization Dashboard.
    </div>
  ),
);

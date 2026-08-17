"use client";

import * as React from "react";
import {
  Activity,
  Database,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { DashboardProvider } from "./DashboardContext";
import { DashboardApp, type SectionDef } from "./DashboardApp";
import { OverviewView } from "./views/OverviewView";
import { TeamView } from "./views/TeamView";
import { IpAccelView } from "./views/IpAccelView";
import { ActivitiesView } from "./views/ActivitiesView";
import { DetailView } from "./views/DetailView";
import { DataQualityView } from "./views/DataQualityView";
import { DatasetsView } from "./views/DatasetsView";
import { AdminView } from "./admin/AdminView";
import { ImportWizard } from "./import/ImportWizard";
import { SnapshotButton } from "./snapshot/SnapshotButton";
import { Badge, EmptyState, Button } from "./ui/primitives";
import { periodLabel } from "@/core/format";

/** Interactive (administrator) application root. */
export function InteractiveApp() {
  const store = useAppStore();
  const { hydrated, hydrate, datasets, config, filters, setFilters } = store;

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const rows = React.useMemo(
    () => datasets.flatMap((d) => d.classified),
    [datasets],
  );
  const availablePeriods = React.useMemo(
    () =>
      [...new Set(datasets.map((d) => d.period))]
        .sort()
        .map((p) => ({ period: p, label: periodLabel(p) })),
    [datasets],
  );

  const goImport = React.useCallback(() => {
    window.location.hash = "/import";
  }, []);
  const goOverview = React.useCallback(() => {
    window.location.hash = "/overview";
  }, []);

  const sections = React.useMemo<SectionDef[]>(
    () => [
      {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        render: () =>
          datasets.length === 0 ? (
            <EmptyState
              title="No data loaded yet"
              hint="Upload the monthly Excel export to build the dashboard. The import is validated before anything is stored."
              action={
                <Button variant="primary" onClick={goImport}>
                  <Upload className="h-4 w-4" />
                  Import monthly Excel
                </Button>
              }
            />
          ) : (
            <OverviewView />
          ),
      },
      { id: "team", label: "Team Utilization", icon: Users, render: () => <TeamView /> },
      {
        id: "ip-accelerators",
        label: "IP & Accelerators",
        icon: Lightbulb,
        render: () => <IpAccelView />,
      },
      {
        id: "activities",
        label: "Activities",
        icon: Activity,
        render: () => <ActivitiesView />,
      },
      {
        id: "detail",
        label: "Detailed Analysis",
        icon: ListChecks,
        render: () => <DetailView />,
      },
      {
        id: "quality",
        label: "Data Quality",
        icon: ShieldCheck,
        admin: true,
        render: () => <DataQualityView />,
      },
      {
        id: "import",
        label: "Import",
        icon: Upload,
        admin: true,
        hideFilters: true,
        render: () => <ImportWizard onDone={goOverview} />,
      },
      {
        id: "datasets",
        label: "Datasets",
        icon: Database,
        admin: true,
        hideFilters: true,
        render: () => <DatasetsView />,
      },
      {
        id: "admin",
        label: "Admin",
        icon: Settings,
        admin: true,
        hideFilters: true,
        render: () => <AdminView />,
      },
    ],
    [datasets.length, goImport, goOverview],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  return (
    <DashboardProvider
      value={{
        mode: "interactive",
        rows,
        config: {
          codes: config.codes,
          categories: config.categories,
          teams: config.teams,
          kpis: config.kpis,
        },
        filters,
        setFilters,
        availablePeriods,
        meta: {
          title: "US Solutions Utilization Dashboard",
          subtitle: "Utilization & Billing",
          periodLabel: availablePeriods.map((p) => p.label).join(", ") || "No data",
          generatedAt: null,
          dataThrough: null,
        },
      }}
    >
      <DashboardApp
        sections={sections}
        headerActions={
          <>
            <Badge tone="neutral">Config {config.version}</Badge>
            <SnapshotButton />
          </>
        }
      />
    </DashboardProvider>
  );
}

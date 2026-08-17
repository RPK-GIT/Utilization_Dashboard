"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { useDashboard } from "./DashboardContext";
import { FilterBar } from "./filters/FilterBar";
import { formatDate } from "@/core/format";

/**
 * Mode-aware dashboard shell: sidebar navigation (hash-based so history and
 * deep links work in the interactive app AND in a file:// snapshot), filter
 * bar, and the active section. The section list is injected by the host —
 * the executive snapshot bundle never even contains admin components.
 */

export interface SectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Sections flagged admin never appear in snapshot mode. */
  admin?: boolean;
  /** Hide the shared filter bar (e.g. on admin/import screens). */
  hideFilters?: boolean;
  render: () => React.ReactNode;
}

function useHashSection(sections: SectionDef[]): [string, (id: string) => void] {
  const fallback = sections[0]?.id ?? "overview";
  const read = React.useCallback(() => {
    if (typeof window === "undefined") return fallback;
    const id = window.location.hash.replace(/^#\/?/, "");
    return sections.some((s) => s.id === id) ? id : fallback;
  }, [sections, fallback]);

  const [section, setSection] = React.useState(read);

  React.useEffect(() => {
    const handler = () => setSection(read());
    window.addEventListener("hashchange", handler);
    handler();
    return () => window.removeEventListener("hashchange", handler);
  }, [read]);

  const navigate = React.useCallback((id: string) => {
    window.location.hash = `/${id}`;
  }, []);

  return [section, navigate];
}

export function DashboardApp({
  sections,
  headerActions,
}: {
  sections: SectionDef[];
  headerActions?: React.ReactNode;
}) {
  const { mode, meta } = useDashboard();
  const visible = React.useMemo(
    () => (mode === "snapshot" ? sections.filter((s) => !s.admin) : sections),
    [sections, mode],
  );
  const [active, navigate] = useHashSection(visible);
  const current = visible.find((s) => s.id === active) ?? visible[0];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-grid bg-surface max-lg:w-14">
        <div className="border-b border-grid px-4 py-4 max-lg:px-2">
          <p className="text-sm font-bold leading-tight text-ink max-lg:hidden">
            {meta.title}
          </p>
          <p className="mt-0.5 text-[11px] text-muted max-lg:hidden">{meta.subtitle}</p>
          <p className="hidden text-center text-sm font-bold text-accent max-lg:block">US</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Dashboard sections">
          {visible.map((s) => {
            const Icon = s.icon;
            const isActive = current?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(s.id)}
                aria-current={isActive ? "page" : undefined}
                data-nav={s.id}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer max-lg:justify-center max-lg:px-0 ${
                  isActive
                    ? "bg-accent-soft text-accent-deep"
                    : "text-ink-2 hover:bg-page hover:text-ink"
                }`}
                title={s.label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-lg:hidden">{s.label}</span>
              </button>
            );
          })}
        </nav>
        {mode === "snapshot" ? (
          <div className="border-t border-grid px-4 py-3 text-[11px] leading-4 text-muted max-lg:hidden">
            <p className="font-medium text-ink-2">{meta.periodLabel}</p>
            {meta.generatedAt ? (
              <p>Snapshot generated {formatDate(meta.generatedAt.slice(0, 10))}</p>
            ) : null}
            {meta.dataThrough ? <p>Data through {formatDate(meta.dataThrough)}</p> : null}
          </div>
        ) : null}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-grid bg-page/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink">{current?.label}</h1>
              {mode === "snapshot" ? (
                <p className="text-xs text-muted">
                  {meta.periodLabel} · frozen point-in-time snapshot
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">{headerActions}</div>
          </div>
          {!current?.hideFilters ? (
            <div className="mt-3">
              <FilterBar />
            </div>
          ) : null}
        </header>
        <main className="px-6 py-5">{current?.render()}</main>
      </div>
    </div>
  );
}

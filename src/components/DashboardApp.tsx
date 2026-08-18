"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { useDashboard } from "./DashboardContext";
import { FilterBar } from "./filters/FilterBar";
import { DetailPage } from "./detail/DetailPage";
import { parseHash, type DetailRoute } from "./navigation";
import { formatDate } from "@/core/format";

/**
 * Mode-aware dashboard shell: sidebar navigation and detail routing are
 * hash-based, so history/back/forward and deep links work in the interactive
 * app AND in a file:// snapshot. The section list is injected by the host —
 * the executive snapshot bundle never even contains admin components.
 * Filter state lives above the router, so navigating to a detail page and
 * back never resets the user's filters.
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

interface RouteState {
  sectionId: string;
  detail: DetailRoute | null;
}

function useHashRoute(sections: SectionDef[]): RouteState {
  const fallback = sections[0]?.id ?? "overview";
  const read = React.useCallback((): RouteState => {
    if (typeof window === "undefined") return { sectionId: fallback, detail: null };
    const route = parseHash(window.location.hash);
    if (route.detail) return { sectionId: fallback, detail: route.detail };
    const id =
      route.section && sections.some((s) => s.id === route.section)
        ? route.section
        : fallback;
    return { sectionId: id, detail: null };
  }, [sections, fallback]);

  const [state, setState] = React.useState(read);

  React.useEffect(() => {
    const handler = () =>
      setState((prev) => {
        const next = read();
        // While a detail is open, keep the previously visited section so the
        // sidebar highlight and the hidden mounted section stay stable.
        return next.detail ? { sectionId: prev.sectionId, detail: next.detail } : next;
      });
    window.addEventListener("hashchange", handler);
    handler();
    return () => window.removeEventListener("hashchange", handler);
  }, [read]);

  return state;
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
  const { sectionId, detail } = useHashRoute(visible);
  const current = visible.find((s) => s.id === sectionId) ?? visible[0];

  const showFilters = detail ? true : !current?.hideFilters;

  // Publish the sticky header's height as a CSS variable so floating
  // controls (the detail Back button) always stick just below it, whatever
  // the current filter-chip rows add to its height.
  const headerRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${header.offsetHeight}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(header);
    update();
    return () => observer.disconnect();
  }, []);

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
            const isActive = current?.id === s.id && !detail;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  window.location.hash = `/${s.id}`;
                }}
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
        <header
          ref={headerRef}
          className="sticky top-0 z-20 border-b border-grid bg-page/95 px-6 py-3 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink">
                {detail ? "Detail" : current?.label}
              </h1>
              {mode === "snapshot" ? (
                <p className="text-xs text-muted">
                  {meta.periodLabel} · frozen point-in-time snapshot
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">{headerActions}</div>
          </div>
          {showFilters ? (
            <div className="mt-3">
              <FilterBar />
            </div>
          ) : null}
        </header>
        <main className="px-6 py-5">
          {/* The section stays mounted (hidden) beneath an open detail page so
              Back restores the exact previous context — tabs, sort order and
              pagination included. */}
          <div className={detail ? "hidden" : undefined}>{current?.render()}</div>
          {detail ? (
            <DetailPage key={`${detail.kind}:${detail.value}`} route={detail} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

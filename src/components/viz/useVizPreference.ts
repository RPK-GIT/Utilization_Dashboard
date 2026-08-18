"use client";

import * as React from "react";
import { useDashboard } from "../DashboardContext";
import {
  loadPresentation,
  savePresentation,
  type StoredVizSelection,
} from "../filterPersistence";

/**
 * Shared visualization-preference hook used by EVERY switchable chart block
 * (VizContainer, TrendContainer, MetricExplorer, Hours Composition).
 * Selections are session presentation preferences — never business
 * configuration — keyed per block, preserved across navigation and refresh,
 * and seeded from a snapshot's embedded presentation state so the offline
 * artifact opens with the same views.
 */
export function useVizPreference(
  blockId: string,
  defaults: StoredVizSelection,
): [StoredVizSelection, (next: StoredVizSelection) => void] {
  const { presentationKey, initialPresentation } = useDashboard();
  const [selection, setSelection] = React.useState<StoredVizSelection>(() => {
    const stored = loadPresentation(presentationKey)[blockId];
    const seeded = initialPresentation?.[blockId];
    return stored ?? seeded ?? defaults;
  });
  const update = React.useCallback(
    (next: StoredVizSelection) => {
      setSelection(next);
      const all = loadPresentation(presentationKey);
      all[blockId] = next;
      savePresentation(presentationKey, all);
    },
    [presentationKey, blockId],
  );
  return [selection, update];
}

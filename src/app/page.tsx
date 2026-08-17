"use client";

import * as React from "react";
import { InteractiveApp } from "@/components/InteractiveApp";

/**
 * The application is fully client-side (IndexedDB persistence, browser Excel
 * parsing), so the dashboard mounts after hydration.
 */
const emptySubscribe = () => () => {};

export default function Page() {
  // Hydration-safe mount gate: false on the server snapshot, true on the client.
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return <InteractiveApp />;
}

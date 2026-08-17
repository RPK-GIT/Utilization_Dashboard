"use client";

/**
 * Hash-based navigation shared by the interactive app and the snapshot
 * viewer (hash routing keeps browser back/forward working on http and on
 * file:// alike). Filter state lives in React state, so it survives
 * navigation untouched.
 */

export type DetailKind =
  | "employee"
  | "code"
  | "category"
  | "team"
  | "month"
  | "classification";

export interface DetailRoute {
  kind: DetailKind;
  value: string;
}

export interface Route {
  section: string | null;
  detail: DetailRoute | null;
}

const DETAIL_KINDS: DetailKind[] = [
  "employee",
  "code",
  "category",
  "team",
  "month",
  "classification",
];

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "detail" && parts.length >= 3) {
    const kind = parts[1] as DetailKind;
    if (DETAIL_KINDS.includes(kind)) {
      return {
        section: null,
        detail: { kind, value: decodeURIComponent(parts.slice(2).join("/")) },
      };
    }
  }
  return { section: parts[0] || null, detail: null };
}

/** True once navigation happened inside the app (so Back can use history). */
let navigatedInternally = false;

export function goSection(id: string): void {
  navigatedInternally = true;
  window.location.hash = `/${id}`;
}

export function goDetail(kind: DetailKind, value: string): void {
  navigatedInternally = true;
  window.location.hash = `/detail/${kind}/${encodeURIComponent(value)}`;
}

/** Returns to the exact previous context; falls back to a section when the
 * detail page was the entry point (e.g. a shared deep link). */
export function goBack(fallbackSection = "overview"): void {
  if (navigatedInternally) {
    window.history.back();
  } else {
    goSection(fallbackSection);
  }
}

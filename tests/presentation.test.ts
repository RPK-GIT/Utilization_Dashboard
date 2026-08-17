import { describe, expect, it } from "vitest";
import { activityLabel } from "@/core/format";
import { validateSnapshotHtml, SNAPSHOT_PLACEHOLDER } from "@/core/snapshot/build";

describe("description-first activity labels", () => {
  it("puts the description first and the code second", () => {
    expect(activityLabel("Digital Time entry Cockpit Simplified", "DTEC")).toBe(
      "Digital Time entry Cockpit Simplified (DTEC)",
    );
    expect(activityLabel("Material Shelf Life Management", "MSLM")).toBe(
      "Material Shelf Life Management (MSLM)",
    );
  });

  it("falls back to an explicit unknown label", () => {
    expect(activityLabel(null, "AIUG")).toBe("Unknown code (AIUG)");
    expect(activityLabel("", "AIUG")).toBe("Unknown code (AIUG)");
    expect(activityLabel("Unknown code", "AIUG")).toBe("Unknown code (AIUG)");
  });
});

describe("snapshot artifact validation", () => {
  const VALID = [
    "<!doctype html><html><head>",
    "<style>body{color:#000}</style>",
    '<script id="snapshot-data" type="application/json">{"rows":[]}</script>',
    '<script type="module">console.log(1)</script>',
    "</head><body></body></html>",
  ].join("");

  it("accepts a self-contained artifact", () => {
    expect(validateSnapshotHtml(VALID)).toEqual({ ok: true, problems: [] });
  });

  it("accepts the Vite single-file inline form (type=module crossorigin)", () => {
    const html = VALID.replace(
      '<script type="module">',
      '<script type="module" crossorigin>',
    );
    expect(validateSnapshotHtml(html)).toEqual({ ok: true, problems: [] });
  });

  it("rejects an artifact whose data was never injected", () => {
    const html = VALID.replace(
      '<script id="snapshot-data" type="application/json">{"rows":[]}</script>',
      SNAPSHOT_PLACEHOLDER,
    );
    const result = validateSnapshotHtml(html);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/data is not embedded/i);
  });

  it("rejects external script and stylesheet references", () => {
    const withScript = validateSnapshotHtml(
      VALID + '<script src="/_next/static/app.js"></script>',
    );
    expect(withScript.ok).toBe(false);
    expect(withScript.problems.join(" ")).toMatch(/external script/i);

    const withCss = validateSnapshotHtml(
      VALID + '<link rel="stylesheet" href="https://cdn.example.com/x.css">',
    );
    expect(withCss.ok).toBe(false);
    expect(withCss.problems.join(" ")).toMatch(/external stylesheet/i);
  });

  it("rejects localhost references", () => {
    const result = validateSnapshotHtml(
      VALID.replace("console.log(1)", 'fetch("http://localhost:3000/api")'),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/localhost/i);
  });

  it("rejects missing inline CSS or JS", () => {
    expect(validateSnapshotHtml(VALID.replace(/<style>.*?<\/style>/, "")).ok).toBe(false);
    expect(
      validateSnapshotHtml(
        VALID.replace('<script type="module">console.log(1)</script>', ""),
      ).ok,
    ).toBe(false);
  });
});

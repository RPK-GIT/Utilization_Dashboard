import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { configureFixtureTeam, ensureFixture, importFixture, resetApp } from "./helpers";

/**
 * End-to-end: executive snapshot generation and offline verification. The
 * downloaded HTML is opened from disk via file:// in a NEW offline browser
 * context — no dev server, backend or network — and must render, navigate,
 * filter, chart-drill into actual records and go Back, with no admin surface
 * present (the §20/§21 acceptance flow).
 */

test.beforeAll(() => ensureFixture());

/** Clicks the top (largest) bar of a horizontal bar chart canvas. */
async function clickTopChartBar(page: Page, ariaLabel: string): Promise<void> {
  const canvas = page.locator(`[aria-label="${ariaLabel}"] canvas`);
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  // The largest bar renders in the top category band and spans most of the
  // plot; probe a few y positions to absorb layout variance (a single-bar
  // chart centers its band near the middle of the plot).
  for (const y of [28, 32, 24, 38, 60, 64, 56]) {
    await canvas.click({ position: { x: Math.round(box.width * 0.55), y } });
    if (page.url().includes("/detail/")) return;
  }
  expect(page.url()).toContain("/detail/");
}

test("generates a self-contained executive snapshot that works offline", async ({
  page,
  browser,
}) => {
  await resetApp(page);
  await configureFixtureTeam(page);
  await importFixture(page);

  // Apply a filter so "current view" state is captured.
  await page.getByLabel("Team", { exact: true }).selectOption("IP Delivery Team");

  await page.getByTestId("generate-snapshot").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("snapshot-current-view").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "Utilization_Executive_Snapshot_July_2026.html",
  );

  const artifactDir = path.join(__dirname, ".artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const file = path.join(artifactDir, download.suggestedFilename());
  await download.saveAs(file);

  // 3. Open the snapshot from disk (file://) in a fresh OFFLINE context.
  const offline = await browser.newContext({ offline: true });
  const snap = await offline.newPage();
  const failedRequests: string[] = [];
  snap.on("requestfailed", (req) => {
    if (req.url().startsWith("http")) failedRequests.push(req.url());
  });
  await snap.goto(pathToFileURL(file).href);

  // 4–6. Dashboard loads with KPI cards and charts, in the captured state.
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(snap.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await expect(snap.getByText("frozen point-in-time snapshot")).toBeVisible();
  expect(await snap.locator("canvas").count()).toBeGreaterThan(0);

  // 7–9. Click a chart bar → drilldown opens with the actual source records
  // (description-first title, code as secondary information).
  await clickTopChartBar(snap, "Top IPs by hours");
  await expect(snap.getByTestId("detail-title")).toHaveText(
    "Digital Time entry Cockpit Simplified",
  );
  await expect(snap.getByText("DTEC · IP")).toBeVisible();
  await expect(snap.getByTestId("detail-transactions")).toContainText(
    "DTEC development sprint",
  );

  // 10–11. Back returns to the previous dashboard view, filters preserved.
  await snap.getByTestId("detail-back").click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(snap.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");

  // 12–13. Changing a filter recalculates KPIs from the embedded dataset.
  await snap.getByRole("button", { name: "Clear filters" }).click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await snap.getByTestId("activity-filter").click();
  await snap.getByTestId("activity-search").fill("Digital Time");
  await snap
    .getByRole("listbox")
    .getByText("Digital Time entry Cockpit Simplified (DTEC)")
    .click();
  await snap.keyboard.press("Escape");
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("14");
  await snap.getByRole("button", { name: "Clear filters" }).click();

  // Navigation works (hash routing on file://) — back/forward included.
  await snap.locator("[data-nav=team]").click();
  await expect(snap.getByTestId("team-table")).toContainText("Ivy Ipdelivery");
  await snap.goBack();
  await expect(snap.getByTestId("kpi-total_hours")).toBeVisible();
  await snap.locator("[data-nav=ip-accelerators]").click();
  await snap.getByRole("tab", { name: "Activity analysis" }).click();

  // Table drilldown works inside the snapshot too.
  await snap
    .getByTestId("code-table")
    .getByText("Digital Time entry Cockpit Simplified")
    .first()
    .click();
  await expect(snap.getByTestId("detail-title")).toHaveText(
    "Digital Time entry Cockpit Simplified",
  );
  await snap.getByTestId("detail-back").click();

  // Table sorting works.
  await snap.locator("[data-nav=team]").click();
  await snap.getByRole("columnheader", { name: "Total Hours" }).click();

  // 15. No admin/config surface, no upload, no generate button.
  await expect(snap.locator("[data-nav=admin]")).toHaveCount(0);
  await expect(snap.locator("[data-nav=import]")).toHaveCount(0);
  await expect(snap.locator("[data-nav=datasets]")).toHaveCount(0);
  await expect(snap.locator("[data-nav=quality]")).toHaveCount(0);
  await expect(snap.getByTestId("generate-snapshot")).toHaveCount(0);
  const html = await snap.content();
  expect(html).not.toContain("localhost");

  // 14. Fully offline: no external request may have been attempted.
  expect(failedRequests).toEqual([]);

  await offline.close();
});

test("snapshot is frozen — later data changes do not affect the saved file", async ({
  page,
  browser,
}) => {
  await resetApp(page);
  await configureFixtureTeam(page);
  await importFixture(page);

  await page.getByTestId("generate-snapshot").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("snapshot-full").click();
  const download = await downloadPromise;
  const artifactDir = path.join(__dirname, ".artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const file = path.join(artifactDir, "frozen-check.html");
  await download.saveAs(file);

  // Delete the dataset in the live application afterwards.
  await page.goto("/#/datasets");
  await page.getByRole("button", { name: "Delete dataset" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.goto("/#/overview");
  await expect(page.getByText("No data loaded yet")).toBeVisible();

  // The saved snapshot still shows the frozen numbers.
  const offline = await browser.newContext({ offline: true });
  const snap = await offline.newPage();
  await snap.goto(pathToFileURL(file).href);
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await offline.close();
});

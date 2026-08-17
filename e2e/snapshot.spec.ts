import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  applyMultiFilter,
  configureFixtureTeam,
  ensureFixture,
  importFixture,
  resetApp,
} from "./helpers";

/**
 * End-to-end: executive snapshot generation and offline verification. The
 * downloaded HTML is opened from disk via file:// in a NEW offline browser
 * context — no dev server, backend or network — and must render, navigate,
 * multi-select filter, validate dates, KPI/chart-drill into actual records
 * and go Back, with no admin surface present.
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
  await applyMultiFilter(page, "filter-team", ["IP Delivery Team"]);

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

  // Open the snapshot from disk (file://) in a fresh OFFLINE context.
  const offline = await browser.newContext({ offline: true });
  const snap = await offline.newPage();
  const failedRequests: string[] = [];
  snap.on("requestfailed", (req) => {
    if (req.url().startsWith("http")) failedRequests.push(req.url());
  });
  await snap.goto(pathToFileURL(file).href);

  // Dashboard loads with KPI cards and charts, in the captured state.
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(snap.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await expect(snap.getByText("frozen point-in-time snapshot")).toBeVisible();
  expect(await snap.locator("canvas").count()).toBeGreaterThan(0);

  // KPI navigation inside the snapshot: Total Hours → detail → Back.
  await snap.getByTestId("kpi-card-total_hours").click();
  await expect(snap.getByTestId("detail-title")).toHaveText("Total hours");
  await expect(snap.getByTestId("detail-transactions")).toBeVisible();
  await snap.getByTestId("detail-back").click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("42");

  // IP Delivery Hours KPI → team detail → Back, filters preserved.
  await snap.getByTestId("kpi-card-ip_delivery_hours").click();
  await expect(snap.getByTestId("detail-title")).toHaveText("IP Delivery Team hours");
  await expect(snap.getByTestId("detail-transactions")).toContainText("Ivy Ipdelivery");
  await snap.getByTestId("detail-back").click();
  await expect(snap.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");

  // Chart drilldown: click a bar → detail with actual records → Back.
  await clickTopChartBar(snap, "Top IPs by hours");
  await expect(snap.getByTestId("detail-title")).toHaveText(
    "Digital Time entry Cockpit Simplified",
  );
  await expect(snap.getByText("DTEC · IP")).toBeVisible();
  await expect(snap.getByTestId("detail-transactions")).toContainText(
    "DTEC development sprint",
  );
  await snap.getByTestId("detail-back").click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(snap.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");

  // Multi-select works in the snapshot: both teams selected → full scope.
  await applyMultiFilter(snap, "filter-team", ["Development Team"]);
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await snap.getByRole("button", { name: "Clear filters" }).click();

  // Activity multi-select (description-first, search by code).
  await snap.getByTestId("filter-activity").click();
  await snap.getByTestId("filter-activity-search").fill("DTEC");
  await snap
    .getByRole("listbox")
    .getByText("Digital Time entry Cockpit Simplified")
    .click();
  await snap.getByTestId("filter-activity-apply").click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("14");
  await snap.getByRole("button", { name: "Clear filters" }).click();

  // Date labels and validation behave identically in the snapshot.
  await expect(snap.getByText("From Date", { exact: true })).toBeVisible();
  await expect(snap.getByText("To Date", { exact: true })).toBeVisible();
  await snap.getByTestId("from-date").fill("2026-07-20");
  await snap.getByTestId("to-date").fill("2026-07-10");
  await expect(snap.getByTestId("date-error")).toBeVisible();
  await expect(snap.getByTestId("apply-dates")).toBeDisabled();
  await snap.getByTestId("from-date").fill("2026-07-06");
  await snap.getByTestId("apply-dates").click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("40");
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

  // No admin/config surface, no upload, no generate button.
  await expect(snap.locator("[data-nav=admin]")).toHaveCount(0);
  await expect(snap.locator("[data-nav=import]")).toHaveCount(0);
  await expect(snap.locator("[data-nav=datasets]")).toHaveCount(0);
  await expect(snap.locator("[data-nav=quality]")).toHaveCount(0);
  await expect(snap.getByTestId("generate-snapshot")).toHaveCount(0);
  const html = await snap.content();
  expect(html).not.toContain("localhost");

  // Fully offline: no external request may have been attempted.
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

import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { configureFixtureTeam, ensureFixture, importFixture, resetApp } from "./helpers";

/**
 * End-to-end: executive snapshot generation and offline verification. The
 * downloaded HTML is opened from disk in a NEW offline browser context —
 * no dev server, backend or network — and must render, navigate, filter and
 * drill down, with no admin surface present.
 */

test.beforeAll(() => ensureFixture());

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

  // Open the snapshot from disk in a fresh OFFLINE context.
  const offline = await browser.newContext({ offline: true });
  const snap = await offline.newPage();
  const failedRequests: string[] = [];
  snap.on("requestfailed", (req) => {
    if (req.url().startsWith("http")) failedRequests.push(req.url());
  });
  await snap.goto(pathToFileURL(file).href);

  // Renders with the captured filter state.
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(snap.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await expect(snap.getByText("frozen point-in-time snapshot")).toBeVisible();

  // Filters still work inside the snapshot.
  await snap.getByRole("button", { name: "Clear filters" }).click();
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await snap.getByLabel("Code", { exact: true }).selectOption("DTEC");
  await expect(snap.getByTestId("kpi-total_hours")).toHaveText("14");
  await snap.getByRole("button", { name: "Clear filters" }).click();

  // Navigation works (hash routing on file://) — back/forward included.
  await snap.locator("[data-nav=team]").click();
  await expect(snap.getByTestId("team-table")).toContainText("Ivy Ipdelivery");
  await snap.goBack();
  await expect(snap.getByTestId("kpi-total_hours")).toBeVisible();
  await snap.locator("[data-nav=ip-accelerators]").click();
  await snap.getByRole("tab", { name: "Code analysis" }).click();

  // Drilldown works inside the snapshot.
  await snap.getByTestId("code-table").getByText("DTEC").first().click();
  await expect(snap.getByRole("dialog")).toContainText("Digital Time entry Cockpit");
  await snap.getByRole("button", { name: "Close" }).click();

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

import { expect, test } from "@playwright/test";
import { resetApp } from "./helpers";

/**
 * Verification against the real monthly export. Runs only when
 * SAMPLE_XLSX_PATH points at the file (never committed to the repository):
 *
 *   SAMPLE_XLSX_PATH="C:\...\EXPORT_20260817_143302.XLSX" npx playwright test real-sample
 *
 * Expected values were computed with an independent implementation
 * (openpyxl) from the same file and the initial business rules.
 */

const SAMPLE = process.env.SAMPLE_XLSX_PATH;

test.skip(!SAMPLE, "SAMPLE_XLSX_PATH not set — skipping real-sample verification");

test("dashboard reproduces independently computed KPIs from the real export", async ({
  page,
}) => {
  await resetApp(page);

  await page.goto("/#/import");
  await page.getByTestId("upload-input").setInputFiles(SAMPLE!);
  await expect(page.getByTestId("map-wbs")).toBeVisible();
  await page.getByTestId("to-validation").click();

  // Validation report (independently verified: 1,617 records, 25 employees,
  // July 2026, 4 duplicate rows, 27 unknown development codes).
  await expect(page.getByTestId("period-input")).toHaveValue("2026-07");
  await expect(page.getByText("1,617").first()).toBeVisible();

  await page.getByTestId("confirm-import").click();
  await page.getByTestId("go-dashboard").click();

  // Ground truth: total 4811, billable 692.5 (14.39%), IP 1247.5,
  // accelerator 53.5, productive 1993.5 (41.44%), IP Delivery 737.5.
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("4,811");
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("692.5");
  await expect(page.getByTestId("kpi-billable_percentage")).toHaveText("14.4%");
  await expect(page.getByTestId("kpi-ip_hours")).toHaveText("1,247.5");
  await expect(page.getByTestId("kpi-accelerator_hours")).toHaveText("53.5");
  await expect(page.getByTestId("kpi-productive_hours")).toHaveText("1,993.5");
  await expect(page.getByTestId("kpi-productive_percentage")).toHaveText("41.4%");
  await expect(page.getByTestId("kpi-ip_delivery_hours")).toHaveText("737.5");

  // IP Delivery Team scope: 737.5 total, 384 billable → 52.1% (ratio of sums).
  await page.getByLabel("Team", { exact: true }).selectOption("IP Delivery Team");
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("737.5");
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("384");
  await expect(page.getByTestId("kpi-billable_percentage")).toHaveText("52.1%");
  await page.getByRole("button", { name: "Clear filters" }).click();

  // Data quality shows the 0085I unclassified rows (28) and unknown codes.
  await page.locator("[data-nav=quality]").click();
  await expect(page.getByTestId("dq-unclassified")).toContainText("28");
  await expect(page.getByTestId("dq-duplicates")).toBeVisible();
});

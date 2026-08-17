import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const FIXTURE_PATH = path.join(__dirname, "fixtures", "EXPORT_FIXTURE.xlsx");

/** Generates the synthetic fixture workbook if missing (never committed). */
export function ensureFixture(): void {
  if (!existsSync(FIXTURE_PATH)) {
    execSync("node scripts/make-fixture.mjs", { cwd: path.join(__dirname, "..") });
  }
}

/** Wipes persisted state so each test starts from the default configuration. */
export async function resetApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("keyval-store"));
  await page.reload();
  await expect(page.locator("[data-nav=overview]")).toBeVisible();
}

/** Adds the fixture's fictional employees to the IP Delivery Team via Admin. */
export async function configureFixtureTeam(page: Page): Promise<void> {
  await page.goto("/#/admin");
  await page.getByTestId("admin-tab-teams").click();
  const input = page.getByTestId("member-input-ip-delivery");
  for (const name of ["Ivy Ipdelivery", "Iris Ipdelivery"]) {
    await input.fill(name);
    await input.press("Enter");
  }
  await page.getByTestId("save-config").click();
  await expect(page.getByTestId("save-message")).toBeVisible();
}

/** Runs the full import wizard with the synthetic fixture. */
export async function importFixture(page: Page): Promise<void> {
  await page.goto("/#/import");
  await page.getByTestId("upload-input").setInputFiles(FIXTURE_PATH);
  await expect(page.getByTestId("map-wbs")).toBeVisible();
  await page.getByTestId("to-validation").click();
  await expect(page.getByTestId("period-input")).toHaveValue("2026-07");
  await page.getByTestId("confirm-import").click();
  await page.getByTestId("go-dashboard").click();
  await expect(page.getByTestId("kpi-total_hours")).toBeVisible();
}

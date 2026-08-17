import { expect, test } from "@playwright/test";
import { configureFixtureTeam, ensureFixture, importFixture, resetApp } from "./helpers";

/**
 * End-to-end: import workflow, KPI calculation, filters, description-first
 * activity labels, routed drilldowns with Back, and data quality — using the
 * synthetic fixture export (structure identical to the real monthly file,
 * fictional employees). Expected values are documented in
 * scripts/make-fixture.mjs.
 */

test.beforeAll(() => ensureFixture());

test("imports the monthly excel, computes KPIs, filters and drills down", async ({
  page,
}) => {
  await resetApp(page);
  await configureFixtureTeam(page);
  await importFixture(page);

  // KPI cards from the central metric engine.
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("24");
  await expect(page.getByTestId("kpi-billable_percentage")).toHaveText("27.7%");
  await expect(page.getByTestId("kpi-ip_hours")).toHaveText("22.5");
  await expect(page.getByTestId("kpi-accelerator_hours")).toHaveText("6");
  await expect(page.getByTestId("kpi-productive_hours")).toHaveText("52.5");
  await expect(page.getByTestId("kpi-productive_percentage")).toHaveText("60.7%");
  await expect(page.getByTestId("kpi-ip_delivery_hours")).toHaveText("42");

  // Team filter recalculates every KPI from the same filtered scope.
  await page.getByLabel("Team", { exact: true }).selectOption("IP Delivery Team");
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("16");
  await expect(page.getByTestId("kpi-billable_percentage")).toHaveText("38.1%");
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");

  // Activity filter is description-first and searches description AND code.
  await page.getByTestId("activity-filter").click();
  await page.getByTestId("activity-search").fill("Digital Time");
  await expect(
    page.getByRole("listbox").getByText("Digital Time entry Cockpit Simplified (DTEC)"),
  ).toBeVisible();
  await page.getByTestId("activity-search").fill("DTEC");
  await page
    .getByRole("listbox")
    .getByText("Digital Time entry Cockpit Simplified (DTEC)")
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("14");
  await expect(page.getByTestId("kpi-ip_hours")).toHaveText("14");
  await expect(page.getByTestId("filter-chips")).toContainText(
    "Activity: Digital Time entry Cockpit Simplified (DTEC)",
  );

  // Clear all filters restores the full scope.
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("86.5");

  // Employee filter.
  await page.getByLabel("Employee", { exact: true }).selectOption("Devon Developer");
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("30");
  await page.getByRole("button", { name: "Clear filters" }).click();

  // KPI card navigates to the classification detail with source records.
  await page.getByTestId("kpi-card-billable_hours").click();
  await expect(page.getByTestId("detail-title")).toHaveText("Billable hours");
  await expect(page.getByTestId("detail-transactions")).toContainText("Customer work");
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("kpi-total_hours")).toBeVisible();

  // Team utilization page: row click opens the routed employee detail;
  // Back returns and the active filter state is preserved.
  await page.getByLabel("Team", { exact: true }).selectOption("IP Delivery Team");
  await page.locator("[data-nav=team]").click();
  await expect(page.getByTestId("team-table")).toContainText("Ivy Ipdelivery");
  await page.getByTestId("team-table").getByText("Ivy Ipdelivery").first().click();
  await expect(page.getByTestId("detail-title")).toHaveText("Ivy Ipdelivery");
  await expect(page.getByTestId("detail-transactions")).toBeVisible();
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("team-table")).toBeVisible();
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await page.getByRole("button", { name: "Clear filters" }).click();

  // Activity analysis table is description-first and drills into detail.
  await page.locator("[data-nav=ip-accelerators]").click();
  await page.getByRole("tab", { name: "Activity analysis" }).click();
  await expect(page.getByTestId("code-table")).toContainText(
    "Digital Time entry Cockpit Simplified",
  );
  await expect(page.getByTestId("code-table")).toContainText("AIUG");
  await page
    .getByTestId("code-table")
    .getByText("Digital Time entry Cockpit Simplified")
    .first()
    .click();
  await expect(page.getByTestId("detail-title")).toHaveText(
    "Digital Time entry Cockpit Simplified",
  );
  await expect(page.getByText("DTEC · IP")).toBeVisible();
  await expect(page.getByTestId("detail-transactions")).toContainText(
    "DTEC development sprint",
  );

  // Browser back also returns from the detail route.
  await page.goBack();
  await expect(page.getByTestId("code-table")).toBeVisible();

  // Data quality drill-through for the unknown code.
  await page.locator("[data-nav=quality]").click();
  await expect(page.getByTestId("dq-unknown-AIUG")).toContainText("1");
  await page.getByTestId("dq-unknown-AIUG").click();
  await expect(page.getByText("AIUG user group")).toBeVisible();
});

test("changing WBS configuration reclassifies after explicit reprocess", async ({
  page,
}) => {
  await resetApp(page);
  await configureFixtureTeam(page);
  await importFixture(page);
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("24");

  // Remove 0004C from billable prefixes.
  await page.goto("/#/admin");
  await page.locator('[aria-label="Remove 0004C"]').click();
  await page.getByTestId("save-config").click();
  await expect(page.getByTestId("save-message")).toBeVisible();

  // Dashboard is unchanged until the dataset is explicitly reprocessed.
  await page.goto("/#/overview");
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("24");

  await page.goto("/#/datasets");
  await page.getByRole("button", { name: "Reprocess with current configuration" }).click();
  await page.getByRole("button", { name: /^Reprocess with v/ }).click();
  await page.goto("/#/overview");
  // 0004C rows (8h billable) drop out: 24 - 8 = 16.
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("16");
});

test("adding a code in admin resolves an unknown code after reprocess", async ({
  page,
}) => {
  await resetApp(page);
  await importFixture(page);

  await page.goto("/#/admin");
  await page.getByTestId("admin-tab-codes").click();
  await page.getByTestId("new-code-input").fill("AIUG");
  await page.getByTestId("new-desc-input").fill("AI User Group");
  await page.getByTestId("add-code").click();
  await page.getByTestId("save-config").click();
  await expect(page.getByTestId("save-message")).toBeVisible();

  await page.goto("/#/datasets");
  await page.getByRole("button", { name: "Reprocess with current configuration" }).click();
  await page.getByRole("button", { name: /^Reprocess with v/ }).click();

  await page.goto("/#/overview");
  // AIUG (8h) now counts as IP: 22.5 + 8 = 30.5.
  await expect(page.getByTestId("kpi-ip_hours")).toHaveText("30.5");
});

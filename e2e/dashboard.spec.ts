import { expect, test } from "@playwright/test";
import {
  applyMultiFilter,
  configureFixtureTeam,
  ensureFixture,
  importFixture,
  resetApp,
  selectFilterValues,
} from "./helpers";

/**
 * End-to-end: import workflow, KPI calculation, multi-select filters, date
 * validation, description-first activity labels, routed drilldowns with Back,
 * and data quality — using the synthetic fixture export (structure identical
 * to the real monthly file, fictional employees). Expected values are
 * documented in scripts/make-fixture.mjs.
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

  // Team filter (checkbox multi-select) recalculates every KPI consistently.
  await applyMultiFilter(page, "filter-team", ["IP Delivery Team"]);
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("42");
  await expect(page.getByTestId("kpi-billable_hours")).toHaveText("16");
  await expect(page.getByTestId("kpi-billable_percentage")).toHaveText("38.1%");
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");

  // Selecting BOTH teams includes both (OR within a dimension).
  await applyMultiFilter(page, "filter-team", ["Development Team"]);
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await page.getByTestId("clear-filters").click();

  // Draft selections do NOT recalculate anything until Apply Filters.
  await selectFilterValues(page, "filter-team", ["IP Delivery Team"]);
  await expect(page.getByTestId("unapplied-hint")).toBeVisible();
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("86.5");
  await page.getByTestId("apply-filters").click();
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("42");
  await page.getByTestId("clear-filters").click();

  // Activity filter is description-first and searches description AND code
  // (case-insensitively).
  await page.getByTestId("filter-activity").click();
  await page.getByTestId("filter-activity-search").fill("digital time");
  await expect(
    page.getByRole("listbox").getByText("Digital Time entry Cockpit Simplified"),
  ).toBeVisible();
  await page.getByTestId("filter-activity-search").fill("dtec");
  await page
    .getByRole("listbox")
    .getByText("Digital Time entry Cockpit Simplified")
    .click();
  await page.getByTestId("filter-activity-done").click();
  await page.getByTestId("apply-filters").click();
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("14");
  await expect(page.getByTestId("kpi-ip_hours")).toHaveText("14");
  await expect(page.getByTestId("filter-chips")).toContainText(
    "Activity: Digital Time entry Cockpit Simplified (DTEC)",
  );
  await page.getByTestId("clear-filters").click();

  // ONE Apply commits several dimensions together: employees + category.
  await selectFilterValues(page, "filter-employee", [
    "Ivy Ipdelivery",
    "Devon Developer",
  ]);
  await selectFilterValues(page, "filter-category", ["IP"]);
  await page.getByTestId("apply-filters").click();
  // (Ivy OR Devon) AND category IP: DTEC 6 (Ivy) + PCSI 6 (Devon) = 12.
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("12");
  await page.getByTestId("clear-filters").click();

  // Multi-select employees: Ivy (22h) + Devon (30h) = 52.
  await applyMultiFilter(page, "filter-employee", ["Ivy Ipdelivery", "Devon Developer"]);
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("52");
  await page.getByTestId("clear-filters").click();

  // Explicit date labels; invalid range blocks the global Apply immediately.
  await expect(page.getByText("From Date", { exact: true })).toBeVisible();
  await expect(page.getByText("To Date", { exact: true })).toBeVisible();
  await page.getByTestId("from-date").fill("2026-07-20");
  await page.getByTestId("to-date").fill("2026-07-10");
  await expect(page.getByTestId("date-error")).toContainText(
    "To Date cannot be earlier than From Date",
  );
  await expect(page.getByTestId("apply-filters")).toBeDisabled();
  // Correcting the range enables Apply; rows 6–10 Jul = 8+8+8+6+4+6 = 40.
  await page.getByTestId("from-date").fill("2026-07-06");
  await expect(page.getByTestId("date-error")).toHaveCount(0);
  await page.getByTestId("apply-filters").click();
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("40");
  await expect(page.getByTestId("filter-chips")).toContainText("From Date: 2026-07-06");
  await expect(page.getByTestId("filter-chips")).toContainText("To Date: 2026-07-10");
  await page.getByTestId("clear-filters").click();

  // Total Hours KPI navigates to a routed detail with Back.
  await page.getByTestId("kpi-card-total_hours").click();
  await expect(page.getByTestId("detail-title")).toHaveText("Total hours");
  await expect(page.getByTestId("detail-transactions")).toBeVisible();
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("kpi-total_hours")).toBeVisible();

  // IP Delivery Hours KPI navigates to the team detail with source records.
  await page.getByTestId("kpi-card-ip_delivery_hours").click();
  await expect(page.getByTestId("detail-title")).toHaveText("IP Delivery Team hours");
  await expect(page.getByTestId("detail-transactions")).toContainText("Ivy Ipdelivery");
  await page.getByTestId("detail-back").click();

  // Billable Hours KPI detail.
  await page.getByTestId("kpi-card-billable_hours").click();
  await expect(page.getByTestId("detail-title")).toHaveText("Billable hours");
  await expect(page.getByTestId("detail-transactions")).toContainText("Customer work");
  await page.getByTestId("detail-back").click();

  // Filter state survives KPI navigation and Back.
  await applyMultiFilter(page, "filter-team", ["IP Delivery Team"]);
  await page.getByTestId("kpi-card-ip_hours").click();
  await expect(page.getByTestId("detail-title")).toHaveText("IP");
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await expect(page.getByTestId("kpi-total_hours")).toHaveText("42");

  // Team utilization page: row click opens the routed employee detail.
  await page.locator("[data-nav=team]").click();
  await expect(page.getByTestId("team-table")).toContainText("Ivy Ipdelivery");
  await page.getByTestId("team-table").getByText("Ivy Ipdelivery").first().click();
  await expect(page.getByTestId("detail-title")).toHaveText("Ivy Ipdelivery");
  await expect(page.getByTestId("detail-transactions")).toBeVisible();
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("team-table")).toBeVisible();
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await page.getByTestId("clear-filters").click();

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

  // Browser back also returns from the detail route with tab state intact.
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

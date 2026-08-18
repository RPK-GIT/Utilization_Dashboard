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

  // Hours composition: segments sum to Total Hours, reconciliation shown.
  // Fixture: 86.5 = 24 Billable + 22.5 IP + 6 Accelerator + 34 Other.
  await expect(page.getByTestId("hours-composition")).toContainText("Total Hours: 86.5");
  await expect(page.getByTestId("comp-Billable")).toContainText("24 hrs");
  await expect(page.getByTestId("comp-IP")).toContainText("22.5 hrs");
  await expect(page.getByTestId("comp-Accelerator")).toContainText("6 hrs");
  await expect(page.getByTestId("comp-Other")).toContainText("34 hrs");
  await expect(page.getByTestId("comp-Other")).toContainText("39.3% of Total Hours");
  await expect(page.getByTestId("reconciliation-ok")).toContainText(
    "100% of total hours accounted for",
  );

  // Other segment drills into the category breakdown, which reconciles
  // exactly: Learning 12 + Unknown 8 + Excluded 6 + Not Billable 4 +
  // Unclassified 4 = 34.
  await page.getByTestId("comp-Other").click();
  await expect(page.getByTestId("detail-title")).toHaveText("Other hours");
  await expect(page.getByTestId("other-breakdown")).toContainText("Learning");
  await expect(page.getByTestId("other-breakdown")).toContainText("Unknown");
  await expect(page.getByTestId("other-breakdown")).toContainText("Excluded");
  await expect(page.getByTestId("other-breakdown")).toContainText("Unclassified");
  await expect(page.getByTestId("other-breakdown").locator("tr").last()).toContainText(
    "34",
  );
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("hours-composition")).toBeVisible();

  // Composition responds to filters: IP Delivery team → 42 = 16 + 14 + 0 + 12.
  await applyMultiFilter(page, "filter-team", ["IP Delivery Team"]);
  await expect(page.getByTestId("hours-composition")).toContainText("Total Hours: 42");
  await expect(page.getByTestId("comp-Other")).toContainText("12 hrs");
  await expect(page.getByTestId("reconciliation-ok")).toBeVisible();
  await page.getByTestId("clear-filters").click();

  // Global visualization switching: every chart card has a subtle View
  // control backed by ONE framework. Representative checks:
  // Top IPs → table (same data, exact values), drilldown from the table,
  // Back restores the chosen visualization.
  await page.getByTestId("overview-top-ips-viz").selectOption("table");
  await expect(page.getByTestId("overview-top-ips-table")).toContainText(
    "Digital Time entry Cockpit Simplified",
  );
  await expect(page.getByTestId("overview-top-ips-table")).toContainText("14");
  await page
    .getByTestId("overview-top-ips-table")
    .getByText("Digital Time entry Cockpit Simplified")
    .click();
  await expect(page.getByTestId("detail-title")).toHaveText(
    "Digital Time entry Cockpit Simplified",
  );
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("overview-top-ips-viz")).toHaveValue("table");
  // Donut view of the same card renders from the same buckets.
  await page.getByTestId("overview-top-ips-viz").selectOption("donut");
  await expect(page.getByTestId("overview-top-ips-body").locator("canvas")).toBeVisible();
  await page.getByTestId("overview-top-ips-viz").selectOption("horizontalBar");

  // Hours Composition also supports alternative views (stacked → table).
  await page.getByTestId("hours-composition-viz").selectOption("table");
  await expect(page.getByTestId("hours-composition-table")).toContainText("Billable");
  await expect(page.getByTestId("hours-composition-table")).toContainText("86.5");
  await page.getByTestId("hours-composition-viz").selectOption("stacked");

  // Metric explorer: same data, switchable visualization + breakdown.
  await expect(page.getByTestId("metric-explorer")).toBeVisible();
  await expect(page.getByTestId("viz-metric")).toHaveValue("ip_hours");
  // Table view shows exact values (IP: DTEC 14, PCSI 6, 2PC 2.5 = 22.5).
  await page.getByTestId("viz-type").selectOption("table");
  await expect(page.getByTestId("viz-table")).toContainText(
    "Digital Time entry Cockpit Simplified",
  );
  await expect(page.getByTestId("viz-table")).toContainText("22.5");
  // Every meaningful visualization renders from the same buckets.
  for (const viz of ["donut", "pie", "verticalBar", "horizontalBar"]) {
    await page.getByTestId("viz-type").selectOption(viz);
    await expect(page.getByTestId("viz-body").locator("canvas")).toBeVisible();
  }
  // Line requires an ordered axis — selecting it switches breakdown to Month.
  await page.getByTestId("viz-type").selectOption("line");
  await expect(page.getByTestId("viz-dimension")).toHaveValue("month");
  // KPI view: single number, no meaningless chart.
  await page.getByTestId("viz-type").selectOption("kpi");
  await expect(page.getByTestId("viz-body")).toContainText("of Total Hours");
  // Total Hours metric never offers pie/donut.
  await page.getByTestId("viz-metric").selectOption("total_hours");
  await expect(page.getByTestId("viz-type").locator('option[value="pie"]')).toHaveCount(0);
  await expect(page.getByTestId("viz-type").locator('option[value="donut"]')).toHaveCount(0);

  // Filters + visualization: filtered dataset feeds every view identically.
  await page.getByTestId("viz-metric").selectOption("ip_hours");
  await page.getByTestId("viz-type").selectOption("table");
  await applyMultiFilter(page, "filter-team", ["IP Delivery Team"]);
  await expect(page.getByTestId("viz-table")).toContainText("14"); // DTEC only
  await expect(page.getByTestId("viz-table")).not.toContainText("Procurement");

  // Drilldown from the explorer table; Back restores the visualization state.
  await page.getByTestId("viz-table").getByText("Digital Time entry Cockpit").click();
  await expect(page.getByTestId("detail-title")).toHaveText(
    "Digital Time entry Cockpit Simplified",
  );
  await page.getByTestId("detail-back").click();
  await expect(page.getByTestId("viz-type")).toHaveValue("table");
  await expect(page.getByTestId("viz-metric")).toHaveValue("ip_hours");
  await expect(page.getByTestId("filter-chips")).toContainText("Team: IP Delivery Team");
  await page.getByTestId("clear-filters").click();

  // Total Hours KPI navigates to a routed detail with Back.
  await page.getByTestId("kpi-card-total_hours").click();
  await expect(page.getByTestId("detail-title")).toHaveText("Total hours");
  await expect(page.getByTestId("detail-transactions")).toBeVisible();

  // The Back button floats: after scrolling to the bottom of the detail page
  // it is still inside the viewport and clickable — exactly one instance.
  await page.mouse.wheel(0, 10000);
  await page.waitForTimeout(200);
  await expect(page.getByTestId("detail-back")).toHaveCount(1);
  await expect(page.getByTestId("detail-back")).toBeInViewport();
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

/** Dev utility: imports the sample export and screenshots key views. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const sample = process.env.SAMPLE_XLSX_PATH;
if (!sample) {
  console.error("Set SAMPLE_XLSX_PATH");
  process.exit(1);
}

mkdirSync("e2e/.artifacts", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://localhost:3000/#/import");
await page.getByTestId("upload-input").setInputFiles(sample);
await page.getByTestId("to-validation").click();
await page.screenshot({ path: "e2e/.artifacts/shot-validation.png", fullPage: true });
await page.getByTestId("confirm-import").click();
await page.getByTestId("go-dashboard").click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "e2e/.artifacts/shot-overview.png", fullPage: true });
await page.locator("[data-nav=team]").click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "e2e/.artifacts/shot-team.png", fullPage: true });
await page.locator("[data-nav=ip-accelerators]").click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "e2e/.artifacts/shot-ip.png", fullPage: true });
await page.locator("[data-nav=quality]").click();
await page.waitForTimeout(800);
await page.screenshot({ path: "e2e/.artifacts/shot-quality.png", fullPage: true });
await browser.close();
console.log("Screenshots written to e2e/.artifacts/");

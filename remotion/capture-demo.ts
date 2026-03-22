import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = join(__dirname, "screenshots");
const VIDEO_DIR = join(__dirname, "recordings");
const VIEWPORT = { width: 1280, height: 720 };

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
    deviceScaleFactor: 2,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  async function captureView(name: string, view: string, extraActions?: () => Promise<void>) {
    console.log(`📸 ${name}...`);
    await page.goto(`${BASE_URL}/demo?view=${view}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    if (extraActions) await extraActions();
    await page.screenshot({ path: join(OUTPUT_DIR, `${name}.png`), type: "png" });
    console.log("   ✅ saved");
    await page.waitForTimeout(1500);
  }

  try {
    // Scene 1: Overview
    await captureView("demo-overview", "overview");

    // Scene 2: Monitors
    await captureView("demo-monitors", "monitors");

    // Scene 3: Results
    await captureView("demo-results", "results");

    // Scene 4: Insights — Pain Points (default tab)
    await captureView("demo-insights-painpoints", "insights");

    // Scene 5: Insights — Recommendations tab (via URL param)
    console.log("📸 Scene 5: Recommendations tab...");
    await page.goto(`${BASE_URL}/demo?view=insights&tab=recommendations`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, "demo-insights-recommendations.png"), type: "png" });
    console.log("   ✅ saved");
    await page.waitForTimeout(1500);

    // Scene 6: Insights — Trending tab (via URL param)
    console.log("📸 Scene 6: Trending tab...");
    await page.goto(`${BASE_URL}/demo?view=insights&tab=trending`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, "demo-insights-trending.png"), type: "png" });
    console.log("   ✅ saved");
    await page.waitForTimeout(1500);

    // Scene 7: Analytics
    await captureView("demo-analytics", "analytics");

    console.log("\n🎬 All screenshots captured!");
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    console.log(`📁 Screenshots: ${OUTPUT_DIR}`);
    console.log(`🎥 Video: ${VIDEO_DIR}`);
  }
}

main();

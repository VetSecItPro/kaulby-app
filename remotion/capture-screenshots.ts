import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = join(__dirname, "screenshots");
const VIEWPORT = { width: 1280, height: 720 };

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  async function capture(name: string, url: string, options?: { waitForSelector?: string; waitMs?: number; scrollY?: number }) {
    const { waitForSelector, waitMs = 6000, scrollY } = options || {};
    console.log(`📸 ${name}...`);
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle", timeout: 45000 });
      // Wait for content to render
      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 15000 });
        } catch {
          console.log(`   ⚠️ Selector "${waitForSelector}" not found, continuing...`);
        }
      }
      await page.waitForTimeout(waitMs);
      if (scrollY) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: join(OUTPUT_DIR, `${name}.png`), type: "png" });
      console.log(`   ✅ saved`);
    } catch (e) {
      console.log(`   ❌ failed: ${e}`);
    }
  }

  try {
    // Dashboard overview — wait for cards/content to load
    await capture("dashboard-overview", "/dashboard", {
      waitForSelector: "main",
      waitMs: 8000,
    });

    // Monitors list
    await capture("monitors-list", "/dashboard/monitors", {
      waitForSelector: "main",
      waitMs: 8000,
    });

    // New monitor form
    await capture("new-monitor", "/dashboard/monitors/new", {
      waitForSelector: "form, input, main",
      waitMs: 8000,
    });

    // Results
    await capture("results-feed", "/dashboard", {
      waitForSelector: "main",
      waitMs: 8000,
    });

    // Analytics
    await capture("analytics", "/dashboard/analytics", {
      waitForSelector: "main",
      waitMs: 8000,
    });

    // Insights — Pain Points tab (default)
    await capture("insights-pain-points", "/dashboard/insights", {
      waitForSelector: "main",
      waitMs: 10000,
    });

    // Insights — click Recommendations tab
    await page.goto(`${BASE_URL}/dashboard/insights`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(8000);
    // Try clicking the Recommendations tab
    const tabSelectors = [
      'button:has-text("Recommendations")',
      'button:has-text("Actions")',
      '[value="recommendations"]',
    ];
    for (const sel of tabSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          console.log(`   Clicked recommendations via: ${sel}`);
          break;
        }
      } catch { /* try next */ }
    }
    await page.waitForTimeout(6000);
    await page.screenshot({ path: join(OUTPUT_DIR, "insights-recommendations.png"), type: "png" });
    console.log("   ✅ insights-recommendations saved");

    // Insights — click Trending tab
    const trendSelectors = [
      'button:has-text("Trending")',
      'button:has-text("Trends")',
      '[value="trending"]',
    ];
    for (const sel of trendSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          console.log(`   Clicked trending via: ${sel}`);
          break;
        }
      } catch { /* try next */ }
    }
    await page.waitForTimeout(6000);
    await page.screenshot({ path: join(OUTPUT_DIR, "insights-trending.png"), type: "png" });
    console.log("   ✅ insights-trending saved");

    // AI Chat
    await capture("ai-chat", "/dashboard/ai", {
      waitForSelector: "main",
      waitMs: 8000,
    });

    // Homepage
    await capture("homepage-hero", "/", { waitMs: 5000 });

    // Pricing
    await capture("pricing-page", "/pricing", { waitMs: 5000 });

    console.log("\n🎬 All screenshots captured!");
    console.log(`📁 Output: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await browser.close();
  }
}

main();

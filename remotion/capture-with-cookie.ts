import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = join(__dirname, "screenshots");
const VIEWPORT = { width: 1280, height: 720 };

// Clerk session cookie - paste fresh value here before running
const CLERK_SESSION = process.argv[2] || "";

async function main() {
  if (!CLERK_SESSION) {
    console.error("Usage: npx tsx remotion/capture-with-cookie.ts <clerk_session_jwt>");
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
    deviceScaleFactor: 2,
  });

  // Inject the Clerk session cookie
  await context.addCookies([
    {
      name: "__session",
      value: CLERK_SESSION,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  async function capture(name: string, url: string, waitMs = 5000) {
    console.log(`📸 ${name}...`);
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(waitMs);

      // Check if we're stuck on "Loading sign in..."
      const bodyText = await page.textContent("body");
      if (bodyText?.includes("Loading sign in")) {
        console.log(`   ⚠️  Still on sign-in screen - cookie may be expired`);
        return false;
      }

      await page.screenshot({ path: join(OUTPUT_DIR, `${name}.png`), type: "png" });
      console.log(`   ✅ saved`);
      return true;
    } catch (e) {
      console.log(`   ❌ failed: ${e}`);
      return false;
    }
  }

  try {
    // Test if cookie works
    const works = await capture("test-dashboard", "/dashboard");
    if (!works) {
      console.log("\n❌ Cookie expired or invalid. Get a fresh one:");
      console.log("   1. Open kaulbyapp.com/dashboard in Chrome");
      console.log("   2. DevTools → Application → Cookies → __session");
      console.log("   3. Copy value and run:");
      console.log('   npx tsx remotion/capture-with-cookie.ts "PASTE_HERE"');
      await browser.close();
      process.exit(1);
    }

    // Dashboard overview
    await capture("dashboard-overview", "/dashboard");

    // Monitors list
    await capture("monitors-list", "/dashboard/monitors");

    // New monitor form
    await capture("new-monitor", "/dashboard/monitors/new");

    // Analytics
    await capture("analytics", "/dashboard/analytics");

    // Insights — Pain Points (default tab)
    await capture("insights-pain-points", "/dashboard/insights");

    // Insights — click Recommendations tab
    await page.goto(`${BASE_URL}/dashboard/insights`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    const recsTab = await page.$('[value="recommendations"]') || await page.$('button:has-text("Recommendations")');
    if (recsTab) {
      await recsTab.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: join(OUTPUT_DIR, "insights-recommendations.png"), type: "png" });
      console.log("   ✅ insights-recommendations saved");
    }

    // Insights — click Trending tab
    const trendTab = await page.$('[value="trending"]') || await page.$('button:has-text("Trending")');
    if (trendTab) {
      await trendTab.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: join(OUTPUT_DIR, "insights-trending.png"), type: "png" });
      console.log("   ✅ insights-trending saved");
    }

    // AI Chat
    await capture("ai-chat", "/dashboard/ai");

    console.log("\n🎬 All dashboard screenshots captured!");

  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await browser.close();
  }
}

main();

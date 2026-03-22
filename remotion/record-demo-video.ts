import { chromium } from "playwright";
import { mkdir, rename } from "fs/promises";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const VIDEO_DIR = join(__dirname, "recordings");
const VIEWPORT = { width: 1280, height: 720 };

async function click(page: any, selector: string) {
  const el = await page.$(selector);
  if (!el) return;
  const box = await el.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function main() {
  await mkdir(VIDEO_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  try {
    // MONITORS — show the list (2s)
    console.log("🎬 Monitors...");
    await page.goto(`${BASE_URL}/demo?view=monitors`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await click(page, 'text=Create Monitor');
    await page.waitForTimeout(500);

    // RESULTS — show the feed (3s)
    console.log("🎬 Results...");
    await click(page, '[data-view="results"]');
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(600);
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(700);

    // INSIGHTS — Pain Points (2.5s)
    console.log("🎬 Pain Points...");
    await click(page, '[data-view="insights"]');
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(500);

    // INSIGHTS — Recommendations (2s)
    console.log("🎬 Recommendations...");
    await page.goto(`${BASE_URL}/demo?view=insights&tab=recommendations`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);

    // INSIGHTS — Trending (1.5s)
    console.log("🎬 Trending...");
    await page.goto(`${BASE_URL}/demo?view=insights&tab=trending`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // ANALYTICS (2s)
    console.log("🎬 Analytics...");
    await click(page, '[data-view="analytics"]');
    await page.waitForTimeout(2000);

    // OVERVIEW — end shot (1.5s)
    console.log("🎬 Overview...");
    await click(page, '[data-view="overview"]');
    await page.waitForTimeout(1500);

    console.log("✅ Done!");
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    const videoPath = await page.video()?.path();
    await page.close();
    await context.close();
    await browser.close();
    if (videoPath) {
      const out = join(VIDEO_DIR, "product-demo.webm");
      try { await rename(videoPath, out); } catch {}
      console.log(`🎥 ${out}`);
    }
  }
}

main();

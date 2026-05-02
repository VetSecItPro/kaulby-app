// Homepage hero video flow.
//
// Story arc (12 sec total + 1.5s outro):
//   0:00–0:02  Land on /demo, dashboard visible with "4 active monitors" KPI cards
//   0:02–0:05  Cursor settles on "Recent Mentions" — Reddit + Trustpilot + HN cards visible
//   0:05–0:08  Hover the high-intent (intent_score=82) Reddit card, lead-score badge zoomed
//   0:08–0:11  Click Insights or Analytics link in sidebar — fade transition to a different view
//   0:11–0:12  End on dashboard wide shot
//
// Captions (overlaid by composition):
//   "track 16 platforms" @ 0:01–0:04
//   "ai surfaces high-intent leads" @ 0:05–0:08
//   "save what matters" @ 0:09–0:12
//
// Why /demo and not /dashboard — /demo is the public, deterministic-data demo
// page. /dashboard requires Clerk auth and seeded test data. Same UI, same
// components, but reproducible across every render.
import type { Flow, Recipe } from "../types";
import { recipeFor } from "../brand/kaulby";

export const hero: Flow = {
  id: "hero",
  description: "Homepage hero — what does Kaulby do",
  viewport: { width: 1280, height: 720 },
  drive: async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });

    // Dismiss the analytics consent modal if it appears — same handler as the
    // PWA screenshot capture earlier in the project. Without this the modal
    // blocks half the dashboard.
    await page.waitForTimeout(500);
    const accept = await page.$("text=Accept");
    if (accept) {
      await accept.click();
      await page.waitForTimeout(300);
    }

    // 0:00–0:02 — settle on dashboard
    await page.waitForTimeout(2000);

    // 0:02–0:05 — pan cursor toward Recent Mentions section
    // Use a target inside the heading to anchor the cursor there.
    const recentHeading = await page.$("text=Recent Mentions");
    if (recentHeading) {
      const box = await recentHeading.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
      }
    }
    await page.waitForTimeout(1500);

    // 0:05–0:08 — hover the Reddit card (first .Reddit badge is the top result)
    const redditCard = await page.$("text=Reddit");
    if (redditCard) {
      const box = await redditCard.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 25 });
      }
    }
    await page.waitForTimeout(2000);

    // 0:08–0:11 — click Insights link in sidebar (fade to another view)
    const insightsLink = await page.$("button:has-text('Insights')");
    if (insightsLink) {
      await insightsLink.click();
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1500);

    // 0:11–0:12 — return to Overview as a clean loop seam
    const overviewLink = await page.$("button:has-text('Overview')");
    if (overviewLink) {
      await overviewLink.click();
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(800);
  },
};

export const heroRecipe: Recipe = recipeFor("hero", {
  durationSec: 13.5, // 12s capture + 1.5s outro (intro=0)
  introSec: 0,
  outroSec: 1.5,
  captions: [
    { fromSec: 1, toSec: 4, text: "track 16 platforms" },
    { fromSec: 5, toSec: 8, text: "ai surfaces high-intent leads" },
    { fromSec: 9, toSec: 12, text: "save what matters" },
  ],
  zooms: [
    // Light zoom-on-card during caption 2 — emphasizes the Reddit lead card
    // sitting in the top portion of Recent Mentions
    { fromSec: 5, toSec: 8, rect: { x: 0.22, y: 0.45, w: 0.7, h: 0.22 }, scale: 1.2 },
  ],
});

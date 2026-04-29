import { test, expect } from "@playwright/test";
import { TIER_DESCRIPTIONS } from "../src/lib/marketing/tier-copy";

/**
 * Marketing Pages E2E Tests
 * Tests public-facing pages for accessibility and basic functionality.
 *
 * Tier copy imported from src/lib/marketing/tier-copy so a rewrite of
 * tier descriptions in pricing/page.tsx automatically updates these
 * assertions too. Prevents the silent CI drift surfaced in PR #333.
 */

test.describe("Marketing Pages", () => {
  test("homepage loads and displays hero section", async ({ page }) => {
    await page.goto("/");

    // Check page title
    await expect(page).toHaveTitle(/Kaulby/i);

    // Check hero section elements
    await expect(page.locator("h1")).toBeVisible();

    // Check CTA buttons exist
    const ctaButton = page.getByRole("link", { name: /get started|sign up|try free|start free/i });
    await expect(ctaButton.first()).toBeVisible();
  });

  test("pricing page loads with plan options", async ({ page }) => {
    await page.goto("/pricing");

    // Check page loads (pricing is a client component, title stays as default)
    await expect(page).toHaveTitle(/Kaulby/i);

    // Check pricing heading
    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();

    // Check plan cards exist by looking for plan names with their descriptions
    // (Free tier retired 2026-04-27 — page now shows 3 paid tiers + Day Pass.)
    // Tier descriptions imported from src/lib/marketing/tier-copy so they
    // can never drift from what's rendered.
    await expect(page.getByText(TIER_DESCRIPTIONS.solo)).toBeVisible();
    await expect(page.getByText(TIER_DESCRIPTIONS.growth)).toBeVisible();

    // Check pricing amounts are visible (boundary number assertions)
    await expect(page.getByText("$39")).toBeVisible();
    await expect(page.getByText("$149")).toBeVisible();
  });

  test("gummysearch migration page loads", async ({ page }) => {
    await page.goto("/gummysearch");

    await expect(page).toHaveTitle(/Kaulby/i);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    test.setTimeout(120_000);
    // Use desktop viewport to ensure nav links are visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { timeout: 60_000, waitUntil: "domcontentloaded" });

    // Click pricing link in the header nav (not the hero CTA "View Pricing")
    const navPricingLink = page.locator("header nav").getByRole("link", { name: /^pricing$/i });
    await navPricingLink.click();
    await page.waitForURL(/pricing/, { timeout: 30_000 });
    await expect(page).toHaveURL(/pricing/);

    // Go back to home - use href="/" link
    await page.goto("/", { timeout: 60_000, waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL("/");
  });
});

test.describe("SEO Pages", () => {
  test("subreddits index page loads", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/subreddits", { timeout: 60_000, waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/subreddit/i, { timeout: 30_000 });
    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
  });

  test("individual subreddit page loads", async ({ page }) => {
    await page.goto("/subreddits/startups");

    // Should have structured content
    await expect(page.locator("h1")).toBeVisible();
  });
});

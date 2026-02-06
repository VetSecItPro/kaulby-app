import { test, expect } from "@playwright/test";

/**
 * Marketing Pages E2E Tests
 * Tests public-facing pages for accessibility and basic functionality
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
    await expect(page.getByText("Get started with basic monitoring")).toBeVisible();
    await expect(page.getByText("For power users and professionals")).toBeVisible();
    await expect(page.getByText("For growing teams and agencies")).toBeVisible();

    // Check pricing amounts are visible
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$29")).toBeVisible();
    await expect(page.getByText("$99")).toBeVisible();
  });

  test("gummysearch migration page loads", async ({ page }) => {
    await page.goto("/gummysearch");

    await expect(page).toHaveTitle(/Kaulby/i);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    // Use desktop viewport to ensure nav links are visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // Click pricing link in the header nav (not the hero CTA "View Pricing")
    const navPricingLink = page.locator("header nav").getByRole("link", { name: /^pricing$/i });
    await navPricingLink.click();
    await page.waitForURL(/pricing/);
    await expect(page).toHaveURL(/pricing/);

    // Go back to home - use href="/" link
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });
});

test.describe("SEO Pages", () => {
  test("subreddits index page loads", async ({ page }) => {
    await page.goto("/subreddits");

    await expect(page).toHaveTitle(/subreddit/i);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("individual subreddit page loads", async ({ page }) => {
    await page.goto("/subreddits/startups");

    // Should have structured content
    await expect(page.locator("h1")).toBeVisible();
  });
});

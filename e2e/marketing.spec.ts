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
    const ctaButton = page.getByRole("link", { name: /get started|sign up|try free/i });
    await expect(ctaButton.first()).toBeVisible();
  });

  test("pricing page loads with plan options", async ({ page }) => {
    await page.goto("/pricing");

    // Check page loads
    await expect(page).toHaveTitle(/pricing/i);

    // Check plan cards exist (Free, Pro, Team)
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test("features page loads", async ({ page }) => {
    await page.goto("/features");

    await expect(page).toHaveTitle(/features/i);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");

    // Click pricing link
    await page.getByRole("link", { name: /pricing/i }).first().click();
    await expect(page).toHaveURL(/pricing/);

    // Go back to home
    await page.getByRole("link", { name: /kaulby/i }).first().click();
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

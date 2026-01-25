import { test, expect } from "@playwright/test";

/**
 * SEO Pages E2E Tests
 * Tests programmatic SEO pages for discoverability and functionality
 */

test.describe("Subreddit SEO Pages", () => {
  test("subreddits index page loads with content", async ({ page }) => {
    await page.goto("/subreddits");

    await expect(page).toHaveTitle(/subreddit/i);
    await expect(page.locator("h1")).toBeVisible();

    // Should have links to individual subreddit pages
    const subredditLinks = page.getByRole("link", { name: /r\// });
    await expect(subredditLinks.first()).toBeVisible();
  });

  test("subreddit page has structured content", async ({ page }) => {
    await page.goto("/subreddits/startups");

    // Should have h1
    await expect(page.locator("h1")).toBeVisible();

    // Should have CTA to sign up/monitor
    const cta = page.getByRole("link", { name: /monitor|track|sign up|get started/i });
    await expect(cta.first()).toBeVisible();
  });

  test("subreddit page has JSON-LD structured data", async ({ page }) => {
    await page.goto("/subreddits/startups");

    // Check for JSON-LD script tag
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd.first()).toBeAttached();
  });
});

test.describe("Alternatives SEO Pages", () => {
  test("alternatives index page loads", async ({ page }) => {
    await page.goto("/alternatives");

    await expect(page.locator("h1")).toBeVisible();
  });

  test("individual alternative page loads", async ({ page }) => {
    await page.goto("/alternatives/gummysearch");

    // Should have comparison content
    await expect(page.locator("h1")).toBeVisible();

    // Should have CTA
    const cta = page.getByRole("link", { name: /try|start|sign up|get started/i });
    await expect(cta.first()).toBeVisible();
  });
});

test.describe("Tools SEO Pages", () => {
  test("tools index page loads", async ({ page }) => {
    await page.goto("/tools");

    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Articles Pages", () => {
  test("articles index page loads", async ({ page }) => {
    await page.goto("/articles");

    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("*** Migration Page", () => {
  test("gummysearch page has migration content", async ({ page }) => {
    await page.goto("/gummysearch");

    await expect(page.locator("h1")).toBeVisible();

    // Should mention ***
    await expect(page.getByText(/gummysearch/i).first()).toBeVisible();

    // Should have CTA for migration
    const cta = page.getByRole("link", { name: /migrate|switch|try|start|sign up/i });
    await expect(cta.first()).toBeVisible();
  });
});

test.describe("Legal Pages", () => {
  test("privacy policy page loads", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/privacy/i).first()).toBeVisible();
  });

  test("terms of service page loads", async ({ page }) => {
    await page.goto("/terms");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/terms/i).first()).toBeVisible();
  });
});

test.describe("API Documentation", () => {
  test("API docs page loads", async ({ page }) => {
    await page.goto("/docs/api");

    // API docs page should load with heading
    await expect(page.locator("h1")).toBeVisible();
  });
});

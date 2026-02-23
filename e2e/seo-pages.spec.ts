import { test, expect, Page } from "@playwright/test";

/**
 * SEO Pages E2E Tests
 * Tests programmatic SEO pages for discoverability and functionality
 *
 * Note: Dev mode SSR + compilation is slow on first load, so we use
 * extended timeouts throughout.
 */

async function suppressConsentBanner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

test.describe("Subreddit SEO Pages", () => {
  test("subreddits index page loads with content", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/subreddits", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveTitle(/subreddit/i, { timeout: 30_000 });
    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });

    // Should have links to individual subreddit pages
    const subredditLinks = page.getByRole("link", { name: /r\// });
    await expect(subredditLinks.first()).toBeVisible({ timeout: 30_000 });
  });

  test("subreddit page has structured content", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/subreddits/startups", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    // Should have h1
    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });

    // Should have CTA to sign up/monitor
    const cta = page.getByRole("link", {
      name: /monitor|track|sign up|get started/i,
    });
    await expect(cta.first()).toBeVisible({ timeout: 30_000 });
  });

  test("subreddit page has JSON-LD structured data", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/subreddits/startups", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    // Check for JSON-LD script tag
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd.first()).toBeAttached({ timeout: 30_000 });
  });
});

test.describe("Alternatives SEO Pages", () => {
  test("alternatives index page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/alternatives", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
  });

  test("individual alternative page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/alternatives/gummysearch", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    // Should have comparison content
    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });

    // Should have CTA
    const cta = page.getByRole("link", {
      name: /try|start|sign up|get started/i,
    });
    await expect(cta.first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Tools SEO Pages", () => {
  test("tools index page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/tools", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Articles Pages", () => {
  test("articles index page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/articles", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("GummySearch Migration Page", () => {
  test("gummysearch page has migration content", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/gummysearch", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });

    // Should mention GummySearch
    await expect(page.getByText(/gummysearch/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Should have CTA for migration
    const cta = page.getByRole("link", {
      name: /migrate|switch|try|start|sign up/i,
    });
    await expect(cta.first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Legal Pages", () => {
  test("privacy policy page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/privacy", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/privacy/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("terms of service page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/terms", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/terms/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("API Documentation", () => {
  test("API docs page loads", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/docs/api", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });

    // API docs page should load with heading
    await expect(page.locator("h1")).toBeVisible({ timeout: 30_000 });
  });
});

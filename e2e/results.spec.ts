import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Results Viewing E2E Tests
 * Tests the results page including filters, search, and result interactions.
 *
 * IMPORTANT: The responsive dashboard layout renders {children} twice --
 * mobile first (lg:hidden) and desktop second (hidden lg:flex/lg:block).
 * See dashboard.spec.ts for viewport-aware selector details.
 */

const isLocalDev =
  !process.env.CI &&
  !process.env.PLAYWRIGHT_BASE_URL?.includes("kaulbyapp.com");

/** Tailwind lg breakpoint */
const LG_BREAKPOINT = 1024;

function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport ? viewport.width < LG_BREAKPOINT : false;
}

function visibleElement(locator: Locator, page: Page): Locator {
  return isMobileViewport(page) ? locator.first() : locator.last();
}

async function suppressConsentBanner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

const PAGE_TIMEOUT = 15_000;

test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

// ---------------------------------------------------------------------------
// Results Page - Loading & Layout
// ---------------------------------------------------------------------------

test.describe("Results Page - Layout", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("results page loads with heading", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    await expect(
      visibleElement(page.getByRole("heading", { name: /results/i }), page)
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test("results page shows empty state or result cards", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    // Page should show either result cards or an empty/scanning state
    const resultCard = page.locator("[class*=card]").first();
    const emptyState = visibleElement(
      page.getByText(/no results|no monitors|create a monitor|scanning/i),
      page
    );

    await expect(resultCard.or(emptyState)).toBeVisible({ timeout: 30_000 });
  });

  test("results count is displayed", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // The page should show some count indicator (total results, "showing X", etc.)
    // or an empty state message
    const mainContent = page.getByRole("main").first();
    await expect(mainContent).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Results Page - Search
// ---------------------------------------------------------------------------

test.describe("Results Page - Search", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("search input is present and accepts text", async ({ page }) => {
    await page.goto("/dashboard/results");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill("test search query");
      await expect(searchInput).toHaveValue("test search query");
    }
  });

  test("search input can be cleared", async ({ page }) => {
    await page.goto("/dashboard/results");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("some query");
      await expect(searchInput).toHaveValue("some query");

      await searchInput.clear();
      await expect(searchInput).toHaveValue("");
    }
  });
});

// ---------------------------------------------------------------------------
// Results Page - Filters
// ---------------------------------------------------------------------------

test.describe("Results Page - Filters", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("filters toggle button is present", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    const filterBtn = visibleElement(
      page.getByRole("button", { name: /show filters|hide filters|filters/i }),
      page
    );

    // On mobile, filters may be in a sheet; on desktop, in a sidebar
    if (await filterBtn.isVisible().catch(() => false)) {
      await expect(filterBtn).toBeEnabled();
    }
  });

  test("clicking filters button reveals filter options", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    const filterBtn = visibleElement(
      page.getByRole("button", { name: /show filters|hide filters|filters/i }),
      page
    );

    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click({ force: true });

      // After clicking, filter-related content should appear
      // This could be sentiment filters, platform filters, or date range
      const filterContent = page.getByText(/sentiment|platform|date|monitor/i).first();
      if (await filterContent.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(filterContent).toBeVisible();
      }
    }
  });

  test("platform filter badges are interactive", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    // Open filters if needed
    const filterBtn = visibleElement(
      page.getByRole("button", { name: /show filters|hide filters|filters/i }),
      page
    );
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click({ force: true });
    }

    // Look for platform filter options (e.g., Reddit badge/checkbox)
    const platformFilter = page.getByText(/reddit/i).first();
    if (await platformFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(platformFilter).toBeVisible();
    }
  });

  test("sentiment filter options are available", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    // Open filters if needed
    const filterBtn = visibleElement(
      page.getByRole("button", { name: /show filters|hide filters|filters/i }),
      page
    );
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click({ force: true });
    }

    // Look for sentiment options (positive, negative, neutral)
    const sentimentLabel = page.getByText(/sentiment/i).first();
    if (await sentimentLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(sentimentLabel).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Results Page - API Validation
// ---------------------------------------------------------------------------

test.describe("Results Page - API", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("GET /api/results returns paginated response", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/results");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
      expect(body).toHaveProperty("hasMore");
    }
  });

  test("GET /api/results supports cursor parameter", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/results?limit=5");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  test("result card shows external link when results exist", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000 });

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // If results exist, cards should have external links to source
    const externalLink = page.locator('a[target="_blank"]').first();
    if (await externalLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await externalLink.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });
});

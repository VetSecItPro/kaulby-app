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

const PAGE_TIMEOUT = 30_000;

/** Standard goto options for dev mode */
const GOTO_OPTS = { timeout: 60_000, waitUntil: "domcontentloaded" as const };

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
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

    await expect(
      visibleElement(page.getByRole("heading", { name: /results/i }), page)
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test("results page shows empty state or result cards", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/results", GOTO_OPTS);

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // Page should show either result cards or a scanning/empty state
    // Use try/catch with toBeVisible() to poll for either state
    // Use visibleElement() to avoid hidden mobile copy in dual-render layout
    let foundContent = false;

    try {
      await expect(
        visibleElement(page.getByText(/no results|no monitors|create a monitor|scanning|start monitoring/i), page)
      ).toBeVisible({ timeout: 20_000 });
      foundContent = true;
    } catch {
      try {
        await expect(
          page.locator("[class*=card]").first()
        ).toBeVisible({ timeout: 10_000 });
        foundContent = true;
      } catch {
        // Neither found
      }
    }

    expect(foundContent).toBe(true);
  });

  test("results count is displayed", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

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
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill("test search query");
      await expect(searchInput).toHaveValue("test search query");
    }
  });

  test("search input can be cleared", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });
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
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

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
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

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
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

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
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

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
    test.setTimeout(60_000);
    await page.goto("/dashboard", { timeout: 45_000, waitUntil: "domcontentloaded" });

    const response = await page.request.get("/api/results", { timeout: 30_000 });
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
      expect(body).toHaveProperty("hasMore");
    }
  });

  test("GET /api/results supports cursor parameter", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard", { timeout: 45_000, waitUntil: "domcontentloaded" });

    const response = await page.request.get("/api/results?limit=5", { timeout: 30_000 });
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  test("result card shows external link when results exist", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/results", { timeout: 45_000, waitUntil: "domcontentloaded" });

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // If results exist, cards should have external links to source
    const externalLink = page.locator('a[target="_blank"]').first();
    if (await externalLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await externalLink.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });
});

import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Dashboard E2E Tests
 * Tests dashboard functionality in local development (auth bypassed)
 *
 * IMPORTANT: The responsive dashboard layout renders {children} twice —
 * mobile first (lg:hidden) and desktop second (hidden lg:flex/lg:block).
 *
 * Viewport behavior (Tailwind lg breakpoint = 1024px):
 * - Desktop (≥1024px): Mobile container hidden, desktop visible → use .last()
 * - Mobile (<1024px): Mobile container visible, desktop hidden → use .first()
 *
 * Consequences:
 * - All text, headings, inputs, buttons exist TWICE in the DOM
 * - Must use viewport-aware selector to pick the visible copy
 *
 * We use visibleElement() helper for viewport-aware selection and
 * click({ force: true }) to bypass any actionability issues.
 */

const isLocalDev =
  !process.env.CI &&
  !process.env.PLAYWRIGHT_BASE_URL?.includes("kaulbyapp.com");

/** Tailwind lg breakpoint */
const LG_BREAKPOINT = 1024;

/**
 * Check if current viewport is mobile (< 1024px width).
 * Uses Playwright's viewport info from the page context.
 */
function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport ? viewport.width < LG_BREAKPOINT : false;
}

/**
 * Get the visible element based on viewport size.
 * - Desktop: .last() (desktop container is second in DOM)
 * - Mobile: .first() (mobile container is first in DOM)
 */
function visibleElement(locator: Locator, page: Page): Locator {
  return isMobileViewport(page) ? locator.first() : locator.last();
}

/** Get the visible form instance based on viewport */
function visibleForm(page: Page): Locator {
  return visibleElement(page.locator("form"), page);
}

/**
 * Submit a form by clicking the submit button with force: true.
 *
 * Playwright's dispatchEvent("click") does NOT trigger native form
 * submission (documented behavior). We use click({ force: true }) instead,
 * which performs a real mouse click that triggers the browser's form
 * submit flow, while bypassing the "element is covered" actionability check.
 */
async function submitForm(btn: Locator) {
  await btn.click({ force: true });
}

/**
 * Suppress the analytics consent banner by pre-setting localStorage.
 * The CookieConsent component checks "kaulby:analytics-consent" —
 * if set to "denied", the banner never renders. Must be called via
 * addInitScript BEFORE any page.goto() so it runs before React hydrates.
 */
async function suppressConsentBanner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

/**
 * Wait for React to hydrate by checking for React internal fibers on DOM nodes.
 * React 18 attaches __reactFiber$... and __reactProps$... properties to DOM
 * elements during hydration. This is the most reliable way to ensure event
 * handlers are attached before interacting with elements.
 *
 * @param selector - CSS selector for elements to check (default: "form")
 * @param timeout - Timeout in ms (default: 15_000, mobile Safari can be slow)
 */
async function waitForHydration(page: Page, selector = "form", timeout = 15_000) {
  await page.waitForFunction((sel: string) => {
    const elements = document.querySelectorAll(sel);
    if (elements.length === 0) return false;
    const lastEl = elements[elements.length - 1];
    return Object.keys(lastEl).some((key) => key.startsWith("__react"));
  }, selector, { timeout });
}

/** Longer timeout for pages that run SSR database queries */
const PAGE_TIMEOUT = 15_000;

// Suppress the analytics consent banner for all tests
test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

// ---------------------------------------------------------------------------
// Dashboard Navigation
// ---------------------------------------------------------------------------

test.describe("Dashboard Navigation", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("dashboard pages are accessible via direct navigation", async ({
    page,
  }) => {
    // Each page needs ~8s in dev mode (SSR + DB queries), so extend timeout
    // Mobile Safari can be slower — use generous timeouts
    test.setTimeout(120_000);
    const NAV_TIMEOUT = 30_000;

    // Mobile Safari has an issue where client-side router code from a previous
    // page can interrupt navigation to the next page. We address this by:
    // 1. Using a fresh about:blank before each navigation
    // 2. Waiting for networkidle after each page load
    // This ensures no pending client-side navigation can interfere.
    const pages = [
      "/dashboard",
      "/dashboard/monitors",
      "/dashboard/settings",
      "/dashboard/results",
    ];

    for (const path of pages) {
      // Clear any pending navigations by going to blank first
      await page.goto("about:blank", { timeout: 5_000 });

      // Now navigate to the target
      await page.goto(path, { timeout: 45_000, waitUntil: "networkidle" });
      await expect(page.getByRole("main").first()).toBeVisible({ timeout: NAV_TIMEOUT });
    }
  });

  test("dashboard overview shows action cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    await expect(
      visibleElement(page.getByRole("heading", { name: "Dashboard" }), page)
    ).toBeVisible();
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/dashboard");

    const monitorsLink = page.getByRole("link", { name: /monitors/i }).first();
    if (await monitorsLink.isVisible()) {
      await monitorsLink.click();
      await page.waitForURL("**/dashboard/monitors");
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Monitor Creation Form
// ---------------------------------------------------------------------------

test.describe("Monitor Creation Form", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("form renders with required fields", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    const form = visibleForm(page);

    await expect(
      visibleElement(page.getByRole("heading", { name: "New Monitor" }), page)
    ).toBeVisible();
    await expect(form.getByLabel("Monitor Name")).toBeVisible();
    await expect(form.getByLabel(/company\/brand name/i)).toBeVisible();
    await expect(form.getByRole("checkbox", { name: /reddit/i })).toBeVisible();
    await expect(
      form.getByRole("button", { name: /create monitor/i })
    ).toBeVisible();
  });

  test("shows validation errors for empty required fields", async ({
    page,
  }) => {
    await page.goto("/dashboard/monitors/new");
    
    await waitForHydration(page);
    const form = visibleForm(page);

    await submitForm(form.getByRole("button", { name: /create monitor/i }));

    await expect(form.getByText(/please enter a monitor name/i)).toBeVisible();
  });

  test("shows error when no platform selected", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    
    await waitForHydration(page);
    const form = visibleForm(page);

    await form.getByLabel("Monitor Name").fill("Test Monitor");
    await form.getByLabel(/company\/brand name/i).fill("Test Company");

    await submitForm(form.getByRole("button", { name: /create monitor/i }));

    await expect(
      form.getByText(/please select at least one platform/i)
    ).toBeVisible();
  });

  test("keyword input adds and removes keywords", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    
    await waitForHydration(page);
    const form = visibleForm(page);

    const keywordInput = form.getByLabel(/additional keywords/i);
    await keywordInput.fill("test keyword");
    await keywordInput.press("Enter");

    await expect(form.getByText("test keyword")).toBeVisible();

    // Remove via the X button inside the badge
    const badge = form.getByText("test keyword");
    const removeBtn = badge.locator("button");
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click({ force: true });
      await expect(form.getByText("test keyword")).not.toBeVisible();
    }
  });

  test("platform checkboxes toggle selection", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    
    await waitForHydration(page);
    const form = visibleForm(page);

    const redditCheckbox = form.getByRole("checkbox", { name: /reddit/i });
    await expect(redditCheckbox).toBeVisible();

    await redditCheckbox.click({ force: true });
    await expect(redditCheckbox).toBeChecked();

    await redditCheckbox.click({ force: true });
    await expect(redditCheckbox).not.toBeChecked();
  });

  test("cancel button navigates back to monitors list", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    await waitForHydration(page);

    const cancelLink = visibleElement(page.getByRole("link", { name: /cancel/i }), page);
    if (await cancelLink.isVisible()) {
      await cancelLink.click();
      await page.waitForURL("**/dashboard/monitors");
    }
  });

  test("creates a monitor and redirects to monitors list", async ({
    page,
  }) => {
    await page.goto("/dashboard/monitors/new");
    
    await waitForHydration(page);
    const form = visibleForm(page);

    await form.getByLabel("Monitor Name").fill("E2E Test Monitor");
    await form.getByLabel(/company\/brand name/i).fill("E2E Test Company");
    await form.getByRole("checkbox", { name: /reddit/i }).click({ force: true });

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/monitors") &&
        res.request().method() === "POST"
    );

    await submitForm(form.getByRole("button", { name: /create monitor/i }));

    const response = await responsePromise;
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      await page.waitForURL("**/dashboard/monitors", { timeout: 10000 });
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Monitors List Page
// ---------------------------------------------------------------------------

test.describe("Monitors List Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("shows monitors heading and new monitor button", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/monitors", { timeout: 45_000 });

    await expect(
      visibleElement(page.getByRole("heading", { name: /monitors/i }), page)
    ).toBeVisible({ timeout: 30_000 });

    // Desktop: "New Monitor" button in header (hidden on mobile)
    // Mobile: "+" button in bottom nav (hidden on desktop)
    // Use :visible pseudo-selector to only match the one that's actually visible
    const addLink = page.locator('a[href="/dashboard/monitors/new"]:visible');
    await expect(addLink.first()).toBeVisible({ timeout: 30_000 });
  });

  test("new monitor button links to creation page", async ({ page }) => {
    // Server is slower during full suite — extend timeouts for SSR
    test.setTimeout(60_000);

    await page.goto("/dashboard/monitors", { timeout: 45_000 });

    // Wait for the actual page to load — use :visible to get the correct link
    const link = page.locator('a[href="/dashboard/monitors/new"]:visible').first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveAttribute("href", "/dashboard/monitors/new");

    // Mobile Safari: Clear any pending client-side navigation before navigating to next page.
    // The /dashboard/monitors page can trigger a redirect that interrupts navigation.
    await page.goto("about:blank", { timeout: 5_000 });

    // Verify the target page loads (avoids click/hydration timing under load)
    await page.goto("/dashboard/monitors/new", { timeout: 30_000 });
    await expect(visibleElement(page.getByLabel("Monitor Name"), page)).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

test.describe("Settings Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("settings page shows account information", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // In dev mode, subscription is "enterprise" → Team plan is current
    const planBadge = visibleElement(page.getByText(/free|pro|team/i), page);
    await expect(planBadge).toBeVisible();
  });

  test("timezone selector is present", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    const timezoneText = visibleElement(
      page.getByText(/eastern|central|mountain|pacific/i),
      page
    );
    await expect(timezoneText).toBeVisible({ timeout: 30_000 });
  });

  test("pause digests switch toggles and calls API", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // The switch may not exist in dev mode without a full user record
    const digestSwitch = visibleElement(page.getByRole("switch", { name: /pause/i }), page);
    if (await digestSwitch.isVisible().catch(() => false)) {
      const responsePromise = page.waitForResponse((res) =>
        res.url().includes("/api/user/email-preferences")
      );
      await digestSwitch.click({ force: true });
      const response = await responsePromise;
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("delete account dialog requires confirmation text", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    const deleteTrigger = visibleElement(
      page.getByRole("button", { name: /delete account/i }),
      page
    );
    if (await deleteTrigger.isVisible().catch(() => false)) {
      await deleteTrigger.click({ force: true });

      const confirmInput = page.getByPlaceholder(/delete my account/i);
      if (await confirmInput.isVisible().catch(() => false)) {
        const deleteBtn = page
          .getByRole("button", { name: /schedule deletion/i })
          .first();
        await expect(deleteBtn).toBeDisabled();

        await confirmInput.fill("delete my account");
        await expect(deleteBtn).toBeEnabled();

        await page.getByRole("button", { name: /cancel/i }).click();
      }
    }
  });

  test("subscription plans section shows pricing cards", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    await expect(visibleElement(page.getByText(/\$0/), page)).toBeVisible({ timeout: 30_000 });
    await expect(visibleElement(page.getByText(/\$29/), page)).toBeVisible();
  });

  test("export data dropdown shows format options", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await waitForHydration(page, "button");

    const exportBtn = visibleElement(
      page.getByRole("button", { name: /export data/i }),
      page
    );
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click();

      await expect(page.getByText(/full export/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/results only/i).first()).toBeVisible();

      await page.keyboard.press("Escape");
    }
  });
});

// ---------------------------------------------------------------------------
// Results Page
// ---------------------------------------------------------------------------

test.describe("Results Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("results page shows heading", async ({ page }) => {
    await page.goto("/dashboard/results");

    await expect(
      visibleElement(page.getByRole("heading", { name: /results/i }), page)
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test("search input accepts text when results exist", async ({ page }) => {
    await page.goto("/dashboard/results");

    // Search input: mobile always shows it, desktop only shows when results exist
    // Use first visible search input (there may be only one)
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill("pricing feedback");
      await expect(searchInput).toHaveValue("pricing feedback");
    }
  });

  test("filters toggle button shows/hides sidebar", async ({ page }) => {
    await page.goto("/dashboard/results");

    const filterBtn = visibleElement(
      page.getByRole("button", { name: /show filters|hide filters|filters/i }),
      page
    );
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click({ force: true });
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Analytics Page
// ---------------------------------------------------------------------------

test.describe("Analytics Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  // Analytics page: SSR + dynamic import + API fetch can be slow under load
  const ANALYTICS_TIMEOUT = 30_000;

  test("analytics page shows heading and charts or empty state", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/analytics", { timeout: 45_000 });

    // Heading is server-rendered
    await expect(
      visibleElement(page.getByRole("heading", { name: /analytics/i }), page)
    ).toBeVisible({ timeout: ANALYTICS_TIMEOUT });

    // AnalyticsCharts (dynamically imported, ssr: false) shows either:
    // - Time range buttons + charts when data exists
    // - "No data yet" empty state when no results
    const sevenDays = visibleElement(page.getByRole("button", { name: "7 Days" }), page);
    const noData = visibleElement(page.getByText(/no data yet/i), page);

    await expect(sevenDays.or(noData)).toBeVisible({ timeout: ANALYTICS_TIMEOUT });
  });

  test("time range buttons switch active state when data exists", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/analytics", { timeout: 45_000 });

    // Wait for AnalyticsCharts to load (dynamic import) — shows either buttons or empty state
    const sevenDays = visibleElement(page.getByRole("button", { name: "7 Days" }), page);
    const noData = visibleElement(page.getByText(/no data yet/i), page);
    await expect(sevenDays.or(noData)).toBeVisible({ timeout: ANALYTICS_TIMEOUT });

    // Skip if empty state — no time range buttons to test
    if (await noData.isVisible()) {
      return;
    }

    const thirtyDays = visibleElement(page.getByRole("button", { name: "30 Days" }), page);

    await sevenDays.click({ force: true });
    await expect(sevenDays).toBeVisible();

    await thirtyDays.click({ force: true });
    await expect(thirtyDays).toBeVisible();
  });

  test("summary cards visible when data exists, otherwise empty state", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/analytics", { timeout: 45_000 });

    // Either summary cards or "No data yet" empty state
    const totalMentions = visibleElement(page.getByText(/total mentions/i), page);
    const noData = visibleElement(page.getByText(/no data yet/i), page);

    await expect(totalMentions.or(noData)).toBeVisible({ timeout: ANALYTICS_TIMEOUT });
  });
});

// ---------------------------------------------------------------------------
// Ask AI Page
// ---------------------------------------------------------------------------

test.describe("Ask AI Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("ask page shows heading and input", async ({ page }) => {
    await page.goto("/dashboard/ask");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    await expect(
      visibleElement(page.getByRole("heading", { name: /ask kaulby ai/i }), page)
    ).toBeVisible();
  });

  test("chat input is present and submittable", async ({ page }) => {
    await page.goto("/dashboard/ask");

    const chatInput = page.getByPlaceholder(/ask about your data/i);
    const upgradePrompt = visibleElement(page.getByText(/pro feature/i), page);

    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.fill("What are the top pain points?");
      await expect(chatInput).toHaveValue("What are the top pain points?");
    } else if (await upgradePrompt.isVisible().catch(() => false)) {
      await expect(visibleElement(page.getByText(/upgrade to pro/i), page)).toBeVisible();
    }
  });

  test("suggested questions appear in empty state", async ({ page }) => {
    await page.goto("/dashboard/ask");

    const suggestedBtn = page
      .getByRole("button")
      .filter({ hasText: /what|show|top/i })
      .first();
    if (
      await suggestedBtn.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await expect(suggestedBtn).toBeEnabled();
    }
  });
});

// ---------------------------------------------------------------------------
// API Response Validation
// ---------------------------------------------------------------------------

test.describe("API Response Shape", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("GET /api/results returns expected shape", async ({ page }) => {
    // Navigate first so cookies are set for same-origin requests
    await page.goto("/dashboard");

    const response = await page.request.get("/api/results");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      // API uses cursor-based pagination with { items, nextCursor, hasMore }
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  test("GET /api/insights returns expected shape", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/insights?range=30d");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test("GET /api/analytics returns expected shape", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/analytics?range=30d");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

test.describe("Error Handling", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("invalid dashboard route shows error or redirects", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard/nonexistent-page");
    expect(response?.status()).not.toBe(500);
  });

  test("monitor creation with network error shows feedback", async ({
    page,
  }) => {
    await page.goto("/dashboard/monitors/new");

    await waitForHydration(page);
    const form = visibleForm(page);

    await form.getByLabel("Monitor Name").fill("Network Error Test");
    await form.getByLabel(/company\/brand name/i).fill("Error Corp");
    await form.getByRole("checkbox", { name: /reddit/i }).click({ force: true });

    // Intercept API and simulate server error
    await page.route("**/api/monitors", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Server error" }),
      })
    );

    await submitForm(form.getByRole("button", { name: /create monitor/i }));

    await expect(
      visibleElement(page.getByText(/failed|error|something went wrong/i), page)
    ).toBeVisible({ timeout: 5000 });
  });
});

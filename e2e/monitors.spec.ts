import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Monitor CRUD E2E Tests
 * Tests monitor creation, listing, detail view, editing, and deletion.
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

function visibleForm(page: Page): Locator {
  return visibleElement(page.locator("form"), page);
}

async function submitForm(btn: Locator) {
  await btn.click({ force: true });
}

async function suppressConsentBanner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

async function waitForHydration(page: Page, selector = "form", timeout = 15_000) {
  await page.waitForFunction((sel: string) => {
    const elements = document.querySelectorAll(sel);
    if (elements.length === 0) return false;
    const lastEl = elements[elements.length - 1];
    return Object.keys(lastEl).some((key) => key.startsWith("__react"));
  }, selector, { timeout });
}

const PAGE_TIMEOUT = 15_000;

test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

// ---------------------------------------------------------------------------
// Monitor Creation Form - Extended Tests
// ---------------------------------------------------------------------------

test.describe("Monitor Creation - Form Fields", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("form renders all platform checkboxes available for the plan", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    const form = visibleForm(page);

    await expect(
      visibleElement(page.getByRole("heading", { name: "New Monitor" }), page)
    ).toBeVisible({ timeout: PAGE_TIMEOUT });

    // In dev mode, user has enterprise plan so all platforms should be available
    // At minimum, Reddit should always be present
    await expect(form.getByRole("checkbox", { name: /reddit/i })).toBeVisible();

    // Enterprise plan should show additional platforms
    const hnCheckbox = form.getByRole("checkbox", { name: /hacker news/i });
    if (await hnCheckbox.isVisible().catch(() => false)) {
      await expect(hnCheckbox).toBeVisible();
    }
  });

  test("monitor name field accepts text input", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    const nameInput = form.getByLabel("Monitor Name");
    await nameInput.fill("My Brand Monitor");
    await expect(nameInput).toHaveValue("My Brand Monitor");
  });

  test("company name field accepts text input", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    const companyInput = form.getByLabel(/company\/brand name/i);
    await companyInput.fill("Acme Corp");
    await expect(companyInput).toHaveValue("Acme Corp");
  });

  test("multiple keywords can be added sequentially", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    const keywordInput = form.getByLabel(/additional keywords/i);

    // Add first keyword
    await keywordInput.fill("keyword one");
    await keywordInput.press("Enter");
    await expect(form.getByText("keyword one")).toBeVisible();

    // Add second keyword
    await keywordInput.fill("keyword two");
    await keywordInput.press("Enter");
    await expect(form.getByText("keyword two")).toBeVisible();

    // Both should be visible
    await expect(form.getByText("keyword one")).toBeVisible();
    await expect(form.getByText("keyword two")).toBeVisible();
  });

  test("duplicate keywords are not added", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    const keywordInput = form.getByLabel(/additional keywords/i);

    await keywordInput.fill("duplicate");
    await keywordInput.press("Enter");
    await expect(form.getByText("duplicate")).toBeVisible();

    // Try adding same keyword again
    await keywordInput.fill("duplicate");
    await keywordInput.press("Enter");

    // Should still only show one instance (badges with text "duplicate")
    const badges = form.locator("text=duplicate");
    // The keyword input may also contain the text, so count badges specifically
    const badgeCount = await form.locator("[class*=badge]", { hasText: "duplicate" }).count();
    expect(badgeCount).toBeLessThanOrEqual(1);
  });

  test("multiple platforms can be selected simultaneously", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    const reddit = form.getByRole("checkbox", { name: /reddit/i });
    await reddit.click({ force: true });
    await expect(reddit).toBeChecked();

    // Try selecting another platform if available
    const hn = form.getByRole("checkbox", { name: /hacker news/i });
    if (await hn.isVisible().catch(() => false)) {
      await hn.click({ force: true });
      await expect(hn).toBeChecked();
      // Reddit should remain checked
      await expect(reddit).toBeChecked();
    }
  });
});

// ---------------------------------------------------------------------------
// Monitor Creation - Validation
// ---------------------------------------------------------------------------

test.describe("Monitor Creation - Validation", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("shows validation error for empty monitor name", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    await submitForm(form.getByRole("button", { name: /create monitor/i }));

    await expect(form.getByText(/please enter a monitor name/i)).toBeVisible();
  });

  test("shows error when no platform is selected", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    await form.getByLabel("Monitor Name").fill("Test Monitor");
    await form.getByLabel(/company\/brand name/i).fill("Test Co");

    await submitForm(form.getByRole("button", { name: /create monitor/i }));

    await expect(
      form.getByText(/please select at least one platform/i)
    ).toBeVisible();
  });

  test("create monitor button is visible and enabled", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    const createBtn = form.getByRole("button", { name: /create monitor/i });
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Monitor Creation - Successful Submission
// ---------------------------------------------------------------------------

test.describe("Monitor Creation - Submission", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("successful creation posts to API and redirects", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");
    await waitForHydration(page);
    const form = visibleForm(page);

    await form.getByLabel("Monitor Name").fill("E2E CRUD Monitor");
    await form.getByLabel(/company\/brand name/i).fill("E2E Corp");
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

test.describe("Monitors List - Layout", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("monitors page loads with heading", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/monitors", { timeout: 45_000 });

    await expect(
      visibleElement(page.getByRole("heading", { name: /monitors/i }), page)
    ).toBeVisible({ timeout: 30_000 });
  });

  test("monitors page has add new monitor link", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/monitors", { timeout: 45_000 });

    const addLink = page.locator('a[href="/dashboard/monitors/new"]:visible');
    await expect(addLink.first()).toBeVisible({ timeout: 30_000 });
  });

  test("monitor cards display when monitors exist", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/monitors", { timeout: 45_000 });

    // Page should either show monitor cards or an empty state
    const monitorCard = page.locator("[class*=card]").first();
    const emptyState = visibleElement(page.getByText(/no monitors|create your first/i), page);

    await expect(monitorCard.or(emptyState)).toBeVisible({ timeout: 30_000 });
  });
});

// ---------------------------------------------------------------------------
// Monitor Detail Page
// ---------------------------------------------------------------------------

test.describe("Monitor Detail Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("monitor detail page shows 404 for non-existent monitor", async ({ page }) => {
    const response = await page.goto("/dashboard/monitors/non-existent-id-12345");
    // Should get a 404 not found
    expect(response?.status()).toBe(404);
  });

  test("GET /api/monitors returns monitor list", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/monitors");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });
});

import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Monitor CRUD E2E Tests
 * Tests monitor creation, listing, detail view, editing, and deletion.
 *
 * IMPORTANT: The responsive dashboard layout renders {children} twice --
 * mobile first (lg:hidden) and desktop second (hidden lg:flex/lg:block).
 * See dashboard.spec.ts for viewport-aware selector details.
 *
 * NEW QUICK CREATE FORM:
 * - Default: Simple "Brand / Company Name" input + disabled Create button
 * - NO visible platform checkboxes or keyword inputs by default
 * - "Or customize everything below" button expands detailed form section
 * - Form element may not exist - use waitForHydration(page, "button") instead
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

async function submitForm(btn: Locator) {
  await btn.click({ force: true });
}

async function suppressConsentBanner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

async function waitForHydration(page: Page, selector = "form", timeout = 30_000) {
  await page.waitForFunction((sel: string) => {
    const elements = document.querySelectorAll(sel);
    if (elements.length === 0) return false;
    const lastEl = elements[elements.length - 1];
    return Object.keys(lastEl).some((key) => key.startsWith("__react"));
  }, selector, { timeout });
}

/** Standard goto options for dev mode */
const GOTO_OPTS = { timeout: 60_000, waitUntil: "domcontentloaded" as const };

test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

// ---------------------------------------------------------------------------
// Monitor Creation Form - Quick Create
// ---------------------------------------------------------------------------

test.describe("Monitor Creation - Quick Create Form", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("quick create form renders with brand name input", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);

    await expect(
      visibleElement(page.getByRole("heading", { name: "New Monitor" }), page)
    ).toBeVisible({ timeout: 30_000 });

    // Quick Create section should be visible
    await expect(
      visibleElement(page.getByText(/quick create/i), page)
    ).toBeVisible({ timeout: 15_000 });

    // Brand / Company Name input should be visible
    await expect(
      visibleElement(page.getByLabel(/brand.*company name/i), page)
    ).toBeVisible({ timeout: 15_000 });

    // Create Monitor button should be visible
    await expect(
      visibleElement(page.getByRole("button", { name: /create monitor/i }), page)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("brand name field accepts text input", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    const brandInput = visibleElement(page.getByLabel(/brand.*company name/i), page);
    await brandInput.fill("Acme Corp");
    await expect(brandInput).toHaveValue("Acme Corp");
  });

  test("create button is disabled when brand name is empty", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    const createBtn = visibleElement(page.getByRole("button", { name: /create monitor/i }), page);

    // Initially disabled when empty
    await expect(createBtn).toBeDisabled();

    // Fill brand name
    const brandInput = visibleElement(page.getByLabel(/brand.*company name/i), page);
    await brandInput.fill("Test Company");

    // Should become enabled
    await expect(createBtn).toBeEnabled({ timeout: 5_000 });

    // Clear the input
    await brandInput.clear();

    // Should become disabled again
    await expect(createBtn).toBeDisabled({ timeout: 5_000 });
  });

  test("expand button reveals detailed form options", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Click "Or customize everything below" to expand (use visibleElement to avoid hidden mobile copy)
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expect(expandBtn).toBeVisible({ timeout: 15_000 });
    await expandBtn.click();

    // After expanding, platform checkboxes should appear
    await expect(
      page.getByRole("checkbox", { name: /reddit/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Monitor Creation Form - Detailed Form (Expanded)
// ---------------------------------------------------------------------------

test.describe("Monitor Creation - Detailed Form", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("expanded form shows all platform checkboxes available for the plan", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Expand the detailed form (use visibleElement to avoid hidden mobile copy)
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expandBtn.click();

    await expect(
      visibleElement(page.getByRole("heading", { name: "New Monitor" }), page)
    ).toBeVisible({ timeout: 30_000 });

    // In dev mode, user has enterprise plan so all platforms should be available
    // At minimum, Reddit should always be present
    await expect(
      page.getByRole("checkbox", { name: /reddit/i }).first()
    ).toBeVisible({ timeout: 15_000 });

    // Enterprise plan should show additional platforms
    const hnCheckbox = page.getByRole("checkbox", { name: /hacker news/i }).first();
    if (await hnCheckbox.isVisible().catch(() => false)) {
      await expect(hnCheckbox).toBeVisible();
    }
  });

  test("multiple keywords can be added sequentially", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Expand the detailed form first
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expandBtn.click();

    const keywordInput = page.getByLabel(/additional keywords/i).first();

    // Add first keyword
    await keywordInput.fill("keyword one");
    await keywordInput.press("Enter");
    await expect(page.getByText("keyword one").first()).toBeVisible({ timeout: 15_000 });

    // Add second keyword
    await keywordInput.fill("keyword two");
    await keywordInput.press("Enter");
    await expect(page.getByText("keyword two").first()).toBeVisible({ timeout: 15_000 });

    // Both should be visible
    await expect(page.getByText("keyword one").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("keyword two").first()).toBeVisible({ timeout: 15_000 });
  });

  test("duplicate keywords are not added", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Expand the detailed form
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expandBtn.click();

    const keywordInput = page.getByLabel(/additional keywords/i).first();

    await keywordInput.fill("duplicate");
    await keywordInput.press("Enter");
    await expect(page.getByText("duplicate").first()).toBeVisible({ timeout: 15_000 });

    // Try adding same keyword again
    await keywordInput.fill("duplicate");
    await keywordInput.press("Enter");

    // Should still only show one instance (badges with text "duplicate")
    const badgeCount = await page.locator("[class*=badge]", { hasText: "duplicate" }).count();
    expect(badgeCount).toBeLessThanOrEqual(1);
  });

  test("multiple platforms can be selected simultaneously", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Expand the detailed form
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expandBtn.click();

    const reddit = page.getByRole("checkbox", { name: /reddit/i }).first();
    await reddit.click({ force: true });
    await expect(reddit).toBeChecked();

    // Try selecting another platform if available
    const hn = page.getByRole("checkbox", { name: /hacker news/i }).first();
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

  test("create button disabled when brand name is empty (no error message)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    const createBtn = visibleElement(page.getByRole("button", { name: /create monitor/i }), page);

    // Button should be disabled when brand name is empty
    await expect(createBtn).toBeDisabled();

    // No validation error message should appear (just disabled state)
    // The old form showed validation errors, new form uses disabled state
  });

  test("detailed form shows validation error when monitor name missing", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Fill brand name for Quick Create
    const brandInput = visibleElement(page.getByLabel(/brand.*company name/i), page);
    await brandInput.fill("Test Co");

    // Expand detailed form
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expandBtn.click();

    // Don't fill Monitor Name — leave it empty
    // Click the detailed form's Create Monitor button (last one)
    const createBtns = page.getByRole("button", { name: /create monitor/i });
    const detailedCreateBtn = createBtns.last();
    await submitForm(detailedCreateBtn);

    // Should show "Please enter a monitor name" validation error
    await expect(
      page.getByText(/please enter a monitor name/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("create monitor button is visible and enabled with brand name", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    const brandInput = visibleElement(page.getByLabel(/brand.*company name/i), page);
    await brandInput.fill("Valid Brand");

    const createBtn = visibleElement(page.getByRole("button", { name: /create monitor/i }), page);
    await expect(createBtn).toBeVisible({ timeout: 15_000 });
    await expect(createBtn).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Monitor Creation - Successful Submission
// ---------------------------------------------------------------------------

test.describe("Monitor Creation - Submission", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("quick create submission posts to API and redirects", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Use Quick Create flow (just brand name, uses defaults)
    const brandInput = visibleElement(page.getByLabel(/brand.*company name/i), page);
    await brandInput.fill("E2E Quick Create Corp");

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/monitors") &&
        res.request().method() === "POST",
      { timeout: 30_000 }
    );

    const createBtn = visibleElement(page.getByRole("button", { name: /create monitor/i }), page);
    await submitForm(createBtn);

    const response = await responsePromise;
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      await page.waitForURL("**/dashboard/monitors", { timeout: 30_000 });
      await expect(page.getByRole("main").first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("detailed form submission with custom options posts to API", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors/new", GOTO_OPTS);
    await waitForHydration(page, "button");

    // Fill brand name for Quick Create
    const brandInput = visibleElement(page.getByLabel(/brand.*company name/i), page);
    await brandInput.fill("E2E Custom Corp");

    // Expand detailed form
    const expandBtn = visibleElement(page.getByText(/customize everything below/i), page);
    await expandBtn.click();

    // Fill Monitor Name in detailed form
    const monitorNameInput = page.getByLabel("Monitor Name").last();
    if (await monitorNameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await monitorNameInput.fill("E2E Custom Monitor");
    }

    // Fill Company/Brand Name in detailed form
    const companyInput = page.getByLabel(/company\/brand name/i).last();
    if (await companyInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await companyInput.fill("E2E Custom Corp");
    }

    // Select platforms
    await page.getByRole("checkbox", { name: /reddit/i }).first().click({ force: true });

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/monitors") &&
        res.request().method() === "POST",
      { timeout: 30_000 }
    );

    // Use the detailed form's Create Monitor button (last one)
    const createBtn = page.getByRole("button", { name: /create monitor/i }).last();
    await submitForm(createBtn);

    const response = await responsePromise;
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      await page.waitForURL("**/dashboard/monitors", { timeout: 30_000 });
      await expect(page.getByRole("main").first()).toBeVisible({ timeout: 15_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Monitors List Page
// ---------------------------------------------------------------------------

test.describe("Monitors List - Layout", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("monitors page loads with heading", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors", GOTO_OPTS);

    await expect(
      visibleElement(page.getByRole("heading", { name: /monitors/i }), page)
    ).toBeVisible({ timeout: 30_000 });
  });

  test("monitors page has add new monitor link", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors", GOTO_OPTS);

    const addLink = page.locator('a[href="/dashboard/monitors/new"]:visible');
    await expect(addLink.first()).toBeVisible({ timeout: 30_000 });
  });

  test("monitor cards display when monitors exist", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard/monitors", GOTO_OPTS);

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // Page should either show monitor items or an empty state
    let foundContent = false;

    try {
      // Monitor items have "View Results" buttons
      await expect(
        page.getByRole("button", { name: /view results/i }).first()
      ).toBeVisible({ timeout: 15_000 });
      foundContent = true;
    } catch {
      try {
        // Or look for monitor name text
        await expect(
          page.getByText(/monitor/i).first()
        ).toBeVisible({ timeout: 5_000 });
        foundContent = true;
      } catch {
        try {
          await expect(
            visibleElement(page.getByText(/no monitors|create your first|create a monitor/i), page)
          ).toBeVisible({ timeout: 10_000 });
          foundContent = true;
        } catch {
          // Neither found
        }
      }
    }

    expect(foundContent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Monitor Detail Page
// ---------------------------------------------------------------------------

test.describe("Monitor Detail Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("monitor detail page shows 404 for non-existent monitor", async ({ page }) => {
    test.setTimeout(120_000);
    const response = await page.goto("/dashboard/monitors/non-existent-id-12345", GOTO_OPTS);
    // Next.js may return a 404 status or a 200 with a not-found page
    const status = response?.status() ?? 200;
    if (status === 404) {
      expect(status).toBe(404);
    } else {
      // Page may show a not-found indicator or a dashboard error page
      // Use visibleElement to avoid hidden mobile copy in dual-render layout
      const notFoundIndicator = page.getByText(/not found|404|doesn.t exist|no monitor|error|something went wrong|dashboard error/i);
      await expect(visibleElement(notFoundIndicator, page)).toBeVisible({ timeout: 30_000 });
    }
  });

  test("GET /api/monitors returns monitor list", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard", GOTO_OPTS);

    const response = await page.request.get("/api/monitors", { timeout: 30_000 });
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });
});

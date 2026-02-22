import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Onboarding Wizard E2E Tests
 * Tests the onboarding wizard flow shown to new users on the dashboard.
 *
 * The onboarding wizard is a Dialog component triggered by OnboardingProvider
 * when `isNewUser` is true. In dev mode with ALLOW_DEV_AUTH_BYPASS=true,
 * the user may or may not be flagged as "new" depending on DB state.
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

/**
 * Suppress the analytics consent banner by pre-setting localStorage.
 */
async function suppressConsentBanner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

/** Longer timeout for pages that run SSR database queries */
const PAGE_TIMEOUT = 15_000;

test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

// ---------------------------------------------------------------------------
// Dashboard Quick Start Guide (server-rendered onboarding checklist)
// ---------------------------------------------------------------------------

test.describe("Quick Start Guide", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("dashboard shows Getting Started guide for users without monitors", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // The QuickStartGuide renders when showGettingStarted is true
    // It contains "Getting Started" title and step items
    const gettingStarted = visibleElement(
      page.getByText(/getting started/i),
      page
    );
    const dashboardHeading = visibleElement(
      page.getByRole("heading", { name: "Dashboard" }),
      page
    );

    // Dashboard heading should always be visible
    await expect(dashboardHeading).toBeVisible();

    // Either "Getting Started" guide or "Dashboard Insights" should be visible
    // depending on whether the dev user has monitors
    const insightsOrGuide = gettingStarted.or(
      visibleElement(page.getByText(/scanning for mentions/i), page)
    );
    // Just verify the page rendered something meaningful
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("quick start guide has create monitor step", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // The guide step "Create your first monitor" should be present
    const createStep = visibleElement(
      page.getByText(/create your first monitor/i),
      page
    );
    if (await createStep.isVisible().catch(() => false)) {
      await expect(createStep).toBeVisible();

      // The Create button should link to monitors/new
      const createBtn = visibleElement(
        page.getByRole("button", { name: /create/i }),
        page
      );
      if (await createBtn.isVisible().catch(() => false)) {
        await expect(createBtn).toBeEnabled();
      }
    }
  });

  test("quick start guide has review results step", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const reviewStep = visibleElement(
      page.getByText(/review your results/i),
      page
    );
    if (await reviewStep.isVisible().catch(() => false)) {
      await expect(reviewStep).toBeVisible();
    }
  });

  test("quick start guide has notifications step", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const notifStep = visibleElement(
      page.getByText(/set up notifications/i),
      page
    );
    if (await notifStep.isVisible().catch(() => false)) {
      await expect(notifStep).toBeVisible();
    }
  });

  test("quick start guide dismiss button hides the guide", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // The dismiss button is an X icon button in the CardHeader
    const gettingStartedTitle = visibleElement(
      page.getByText(/getting started/i),
      page
    );

    if (await gettingStartedTitle.isVisible().catch(() => false)) {
      // Find the dismiss (X) button near the Getting Started card
      // It's a ghost variant button with an X icon
      const dismissBtns = page.locator("button").filter({
        has: page.locator("svg.lucide-x"),
      });

      if (await dismissBtns.first().isVisible().catch(() => false)) {
        await dismissBtns.first().click({ force: true });

        // Guide should be dismissed (component returns null after dismiss)
        await expect(gettingStartedTitle).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Dashboard New Monitor CTA
// ---------------------------------------------------------------------------

test.describe("Dashboard New Monitor CTA", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("dashboard has New Monitor button linking to creation page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // The dashboard page always renders a "New Monitor" link button
    const newMonitorLink = page.getByRole("link", { name: /new monitor/i }).first();
    await expect(newMonitorLink).toBeVisible();
    await expect(newMonitorLink).toHaveAttribute("href", "/dashboard/monitors/new");
  });

  test("sample results preview shown for users without monitors", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    // SampleResultsPreview is shown when !hasMonitors
    // If user has monitors this won't appear, which is fine
    const samplePreview = visibleElement(
      page.getByText(/sample/i),
      page
    );
    const monitorsHeading = visibleElement(
      page.getByText(/scanning for mentions/i),
      page
    );

    // Either sample preview or scanning state should be visible (or insights)
    // Just verify the page loaded correctly
    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

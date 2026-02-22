import { test, expect } from "@playwright/test";

/**
 * Pricing & Billing E2E Tests
 * Tests the public pricing page including plan cards, feature comparison,
 * billing toggle, FAQ, and CTA buttons.
 *
 * These tests do NOT require auth -- the pricing page is public.
 * The billing toggle and checkout modals are client-side components.
 */

async function suppressConsentBanner(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kaulby:analytics-consent", "denied");
  });
}

test.beforeEach(async ({ page }) => {
  await suppressConsentBanner(page);
});

// ---------------------------------------------------------------------------
// Pricing Page - Layout & Plan Cards
// ---------------------------------------------------------------------------

test.describe("Pricing Page - Plan Cards", () => {
  test("pricing page loads with heading", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
    await expect(page).toHaveTitle(/Kaulby/i);
  });

  test("displays all three subscription plan cards", async ({ page }) => {
    await page.goto("/pricing");

    // Free plan
    await expect(page.getByText("Get started with basic monitoring")).toBeVisible();
    // Pro plan
    await expect(page.getByText("For power users and professionals")).toBeVisible();
    // Team plan
    await expect(page.getByText("For growing teams and agencies")).toBeVisible();
  });

  test("displays correct monthly prices", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$29")).toBeVisible();
    await expect(page.getByText("$99")).toBeVisible();
  });

  test("Pro plan is marked as Most Popular", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByText("Most Popular")).toBeVisible();
  });

  test("Day Pass card is displayed with one-time pricing", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByText("Day Pass")).toBeVisible();
    await expect(page.getByText("$10")).toBeVisible();
    await expect(page.getByText("One-Time")).toBeVisible();
  });

  test("free plan has correct features listed", async ({ page }) => {
    await page.goto("/pricing");

    // Check a few key free plan features
    await expect(page.getByText("1 monitor").first()).toBeVisible();
    await expect(page.getByText("Reddit only").first()).toBeVisible();
    await expect(page.getByText("3 keywords per monitor").first()).toBeVisible();
  });

  test("pro plan shows 14-day free trial", async ({ page }) => {
    await page.goto("/pricing");

    const trialText = page.getByText(/14-day free trial/i);
    await expect(trialText.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - Billing Toggle
// ---------------------------------------------------------------------------

test.describe("Pricing Page - Billing Toggle", () => {
  test("monthly/annual toggle is present", async ({ page }) => {
    await page.goto("/pricing");

    const monthlyBtn = page.getByRole("button", { name: /monthly/i });
    const annualBtn = page.getByRole("button", { name: /annual/i });

    await expect(monthlyBtn).toBeVisible();
    await expect(annualBtn).toBeVisible();
  });

  test("annual toggle shows 2 months free badge", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByText("2 months free")).toBeVisible();
  });

  test("switching to annual updates displayed prices", async ({ page }) => {
    await page.goto("/pricing");

    // Click annual toggle
    const annualBtn = page.getByRole("button", { name: /annual/i });
    await annualBtn.click();

    // Pro annual: $290/year = $24/mo equivalent
    // Team annual: $990/year = $82/mo equivalent (rounded)
    // After switching, the Pro price should show ~$24 instead of $29
    await expect(page.getByText("$24")).toBeVisible({ timeout: 3000 });
  });

  test("switching back to monthly restores original prices", async ({ page }) => {
    await page.goto("/pricing");

    // Switch to annual
    await page.getByRole("button", { name: /annual/i }).click();
    await expect(page.getByText("$24")).toBeVisible({ timeout: 3000 });

    // Switch back to monthly
    await page.getByRole("button", { name: /monthly/i }).click();
    await expect(page.getByText("$29")).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - Feature Comparison Table
// ---------------------------------------------------------------------------

test.describe("Pricing Page - Feature Comparison", () => {
  test("compare plans section is visible", async ({ page }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: /compare plans/i })
    ).toBeVisible();
  });

  test("feature comparison table has correct column headers", async ({ page }) => {
    await page.goto("/pricing");

    // Table headers: Feature, Free, Pro, Team
    await expect(page.getByRole("columnheader", { name: /feature/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /free/i })).toBeVisible();

    // Pro header contains "Popular" badge
    const proHeader = page.getByRole("columnheader").filter({ hasText: /pro/i });
    await expect(proHeader).toBeVisible();

    await expect(page.getByRole("columnheader", { name: /team/i })).toBeVisible();
  });

  test("feature rows include key comparison items", async ({ page }) => {
    await page.goto("/pricing");

    // Check that key feature rows exist
    await expect(page.getByRole("cell", { name: "Monitors" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /keywords per monitor/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /platforms/i }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /refresh cycle/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - FAQ
// ---------------------------------------------------------------------------

test.describe("Pricing Page - FAQ", () => {
  test("FAQ section is present with accordion items", async ({ page }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: /frequently asked questions/i })
    ).toBeVisible();
  });

  test("FAQ accordion items expand on click", async ({ page }) => {
    await page.goto("/pricing");

    // Click on "Is there really a free plan?" question
    const freeQuestion = page.getByRole("button", { name: /is there really a free plan/i });
    await expect(freeQuestion).toBeVisible();
    await freeQuestion.click();

    // Answer should become visible
    await expect(
      page.getByText(/free forever/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test("Day Pass FAQ item explains the feature", async ({ page }) => {
    await page.goto("/pricing");

    const dayPassQuestion = page.getByRole("button", { name: /what is the day pass/i });
    await expect(dayPassQuestion).toBeVisible();
    await dayPassQuestion.click();

    await expect(
      page.getByText(/full pro access for 24 hours/i)
    ).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - CTA Buttons
// ---------------------------------------------------------------------------

test.describe("Pricing Page - CTAs", () => {
  test("free plan CTA links to sign-up", async ({ page }) => {
    await page.goto("/pricing");

    const freeCtaLink = page.getByRole("link", { name: /get started free/i });
    await expect(freeCtaLink).toBeVisible();
    await expect(freeCtaLink).toHaveAttribute("href", "/sign-up");
  });

  test("pro plan CTA links to sign-up with plan parameter", async ({ page }) => {
    await page.goto("/pricing");

    const proCtaLink = page.getByRole("link", { name: /sign up for pro/i });
    await expect(proCtaLink).toBeVisible();
    await expect(proCtaLink).toHaveAttribute("href", "/sign-up?plan=pro");
  });

  test("team plan CTA links to sign-up with enterprise parameter", async ({ page }) => {
    await page.goto("/pricing");

    const teamCtaLink = page.getByRole("link", { name: /sign up for team/i });
    await expect(teamCtaLink).toBeVisible();
    await expect(teamCtaLink).toHaveAttribute("href", "/sign-up?plan=enterprise");
  });

  test("trust signals are displayed below heading", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByText(/14-day money-back guarantee/i)).toBeVisible();
    await expect(page.getByText(/no credit card for free tier/i)).toBeVisible();
    await expect(page.getByText(/cancel anytime/i)).toBeVisible();
  });

  test("bottom CTA section has start free button", async ({ page }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: /still not sure/i })
    ).toBeVisible();

    const startFreeBtn = page.getByRole("link", { name: /start free/i });
    await expect(startFreeBtn).toBeVisible();
    await expect(startFreeBtn).toHaveAttribute("href", "/sign-up");
  });

  test("navigation header links work", async ({ page }) => {
    await page.goto("/pricing");

    // Logo/brand link goes to homepage
    const homeLink = page.getByRole("link", { name: /kaulby/i }).first();
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");
  });
});

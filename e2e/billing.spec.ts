import { test, expect } from "@playwright/test";

/**
 * Pricing & Billing E2E Tests
 * Tests the public pricing page including plan cards, feature comparison,
 * billing toggle, FAQ, and CTA buttons.
 *
 * These tests do NOT require auth -- the pricing page is public.
 * The billing toggle and checkout modals are client-side components.
 *
 * NOTE: The pricing page is a "use client" component that uses useAuth()
 * from Clerk. In dev mode, initial page compilation is slow, and client-side
 * hydration adds additional delay before interactive content is visible.
 */

const GOTO_OPTS = { timeout: 45_000, waitUntil: "domcontentloaded" as const };
const VISIBLE_OPTS = { timeout: 10_000 };

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
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible(VISIBLE_OPTS);
    await expect(page).toHaveTitle(/Kaulby/i);
  });

  test("displays all three paid subscription plan cards", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Free tier retired 2026-04-27 (Apify costs); page now shows 3 paid tiers + Day Pass.
    // Solo plan (was Pro)
    await expect(page.getByText("For one operator watching their brand")).toBeVisible(VISIBLE_OPTS);
    // Scale plan (mid tier)
    await expect(page.getByText("For the operator who outgrew Solo")).toBeVisible(VISIBLE_OPTS);
    // Growth plan (was Team)
    await expect(page.getByText("For teams operationalizing brand intelligence")).toBeVisible(VISIBLE_OPTS);
  });

  test("displays correct monthly prices", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(page.getByText("$39")).toBeVisible(VISIBLE_OPTS);   // Solo
    await expect(page.getByText("$79")).toBeVisible(VISIBLE_OPTS);   // Scale
    await expect(page.getByText("$149")).toBeVisible(VISIBLE_OPTS);  // Growth
  });

  test("Scale plan is marked as Most Popular", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(page.getByText("Most Popular")).toBeVisible(VISIBLE_OPTS);
  });

  test("Day Pass card is displayed with one-time pricing", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(page.getByText("Day Pass", { exact: true }).first()).toBeVisible(VISIBLE_OPTS);
    // "$15" appears in multiple places after free-tier removal (Day Pass card, FAQ,
    // trust signal, bottom CTA), so scope to .first() to avoid strict-mode violation.
    await expect(page.getByText("$15").first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText("One-Time", { exact: true })).toBeVisible(VISIBLE_OPTS);
  });

  test("Solo plan has correct entry-tier features listed", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Solo (entry paid tier) feature highlights — replaces the old free-tier feature check.
    await expect(page.getByText("10 monitors").first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/9 platforms/i).first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/unlimited keywords/i).first()).toBeVisible(VISIBLE_OPTS);
  });

  test("paid plans show 14-day money-back guarantee", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Free trial replaced by money-back guarantee on monthly plans (2026-04-27).
    const guaranteeText = page.getByText(/14-day money-back guarantee/i);
    await expect(guaranteeText.first()).toBeVisible(VISIBLE_OPTS);
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - Billing Toggle
// ---------------------------------------------------------------------------

test.describe("Pricing Page - Billing Toggle", () => {
  test("monthly/annual toggle is present", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const monthlyBtn = page.getByRole("button", { name: "Monthly", exact: true });
    const annualBtn = page.getByRole("button", { name: "Annual", exact: true });

    await expect(monthlyBtn).toBeVisible(VISIBLE_OPTS);
    await expect(annualBtn).toBeVisible(VISIBLE_OPTS);
  });

  test("annual toggle shows 2 months free badge", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(page.getByText("2 months free")).toBeVisible(VISIBLE_OPTS);
  });

  test("switching to annual updates displayed prices", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Click annual toggle
    const annualBtn = page.getByRole("button", { name: "Annual", exact: true });
    await expect(annualBtn).toBeVisible(VISIBLE_OPTS);
    await annualBtn.click();

    // Solo annual: $374/year = $31/mo equivalent (20% off list)
    // Scale annual: $758/year = $63/mo equivalent
    // Growth annual: $1,430/year = $119/mo equivalent
    // After switching, the Solo price should show $31 instead of $39
    await expect(page.getByText("$31")).toBeVisible(VISIBLE_OPTS);
  });

  test("switching back to monthly restores original prices", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Switch to annual
    const annualBtn = page.getByRole("button", { name: "Annual", exact: true });
    await expect(annualBtn).toBeVisible(VISIBLE_OPTS);
    await annualBtn.click();
    await expect(page.getByText("$31")).toBeVisible(VISIBLE_OPTS);

    // Switch back to monthly
    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await expect(page.getByText("$39")).toBeVisible(VISIBLE_OPTS);
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - Feature Comparison Table
// ---------------------------------------------------------------------------

test.describe("Pricing Page - Feature Comparison", () => {
  test("compare plans section is visible", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(
      page.getByRole("heading", { name: /compare plans/i })
    ).toBeVisible(VISIBLE_OPTS);
  });

  test("feature comparison table has correct column headers", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Table headers: Feature, Solo, Scale, Growth (Free retired 2026-04-27)
    await expect(page.getByRole("columnheader", { name: /feature/i })).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByRole("columnheader", { name: /solo/i })).toBeVisible(VISIBLE_OPTS);

    // Scale header contains "Popular" badge
    const scaleHeader = page.getByRole("columnheader").filter({ hasText: /scale/i });
    await expect(scaleHeader).toBeVisible(VISIBLE_OPTS);

    await expect(page.getByRole("columnheader", { name: /growth/i })).toBeVisible(VISIBLE_OPTS);
  });

  test("feature rows include key comparison items", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Check that key feature rows exist
    await expect(page.getByRole("cell", { name: "Monitors" })).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByRole("cell", { name: /keywords per monitor/i })).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByRole("cell", { name: /platforms/i }).first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByRole("cell", { name: /refresh cadence/i })).toBeVisible(VISIBLE_OPTS);
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - FAQ
// ---------------------------------------------------------------------------

test.describe("Pricing Page - FAQ", () => {
  test("FAQ section is present with accordion items", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(
      page.getByRole("heading", { name: /frequently asked questions/i })
    ).toBeVisible(VISIBLE_OPTS);
  });

  test("FAQ accordion items expand on click", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // "How can I try Kaulby before subscribing?" replaced "Is there really a free plan?" (2026-04-27).
    const tryQuestion = page.getByRole("button", { name: /how can i try kaulby before subscribing/i });
    await expect(tryQuestion).toBeVisible(VISIBLE_OPTS);
    await tryQuestion.click();

    // Answer mentions Day Pass + 24 hours.
    await expect(
      page.getByText(/24 hours of full scale-tier access/i).first()
    ).toBeVisible(VISIBLE_OPTS);
  });

  test("Day Pass FAQ item explains the feature", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const dayPassQuestion = page.getByRole("button", { name: /what is the day pass/i });
    await expect(dayPassQuestion).toBeVisible(VISIBLE_OPTS);
    await dayPassQuestion.click();

    // Day Pass copy: "Scale-level access for 24 hours with a one-time $15 payment"
    await expect(
      page.getByText(/scale-level access for 24 hours/i)
    ).toBeVisible(VISIBLE_OPTS);
  });
});

// ---------------------------------------------------------------------------
// Pricing Page - CTA Buttons
// ---------------------------------------------------------------------------

test.describe("Pricing Page - CTAs", () => {
  test("solo plan CTA links to sign-up with plan parameter", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const soloCtaLink = page.getByRole("link", { name: /start solo/i });
    await expect(soloCtaLink).toBeVisible(VISIBLE_OPTS);
    await expect(soloCtaLink).toHaveAttribute("href", "/sign-up?plan=solo");
  });

  test("scale plan CTA links to sign-up with plan parameter", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const scaleCtaLink = page.getByRole("link", { name: /start scale/i });
    await expect(scaleCtaLink).toBeVisible(VISIBLE_OPTS);
    await expect(scaleCtaLink).toHaveAttribute("href", "/sign-up?plan=scale");
  });

  test("growth plan CTA links to sign-up with plan parameter", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const growthCtaLink = page.getByRole("link", { name: /start growth/i });
    await expect(growthCtaLink).toBeVisible(VISIBLE_OPTS);
    await expect(growthCtaLink).toHaveAttribute("href", "/sign-up?plan=growth");
  });

  test("trust signals are displayed below heading", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Money-back guarantee phrase appears in trust signal + FAQ, scope to first().
    await expect(page.getByText(/14-day money-back guarantee/i).first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/day pass: \$15 for 24h/i)).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/cancel anytime/i).first()).toBeVisible(VISIBLE_OPTS);
  });

  test("bottom CTA section has Day Pass button", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(
      page.getByRole("heading", { name: /still not sure/i })
    ).toBeVisible(VISIBLE_OPTS);

    // Bottom CTA replaced "Start Free" with the Day Pass purchase button (2026-04-27).
    const dayPassBtn = page.getByRole("button", { name: /get day pass.*\$15/i });
    await expect(dayPassBtn).toBeVisible(VISIBLE_OPTS);
  });

  test("navigation header links work", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Logo/brand link goes to homepage
    const homeLink = page.getByRole("link", { name: /kaulby/i }).first();
    await expect(homeLink).toBeVisible(VISIBLE_OPTS);
    await expect(homeLink).toHaveAttribute("href", "/");
  });
});

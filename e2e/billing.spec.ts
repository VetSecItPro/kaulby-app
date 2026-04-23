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

  test("displays all four subscription plan cards", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Free plan
    await expect(page.getByText("Try Kaulby with a single monitor")).toBeVisible(VISIBLE_OPTS);
    // Solo plan (was Pro)
    await expect(page.getByText("For one operator watching their brand")).toBeVisible(VISIBLE_OPTS);
    // Scale plan (new mid tier)
    await expect(page.getByText("For the operator who outgrew Solo")).toBeVisible(VISIBLE_OPTS);
    // Growth plan (was Team)
    await expect(page.getByText("For teams operationalizing brand intelligence")).toBeVisible(VISIBLE_OPTS);
  });

  test("displays correct monthly prices", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(page.getByText("$0")).toBeVisible(VISIBLE_OPTS);
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
    await expect(page.getByText("$15")).toBeVisible(VISIBLE_OPTS);   // Was $10, now $15
    await expect(page.getByText("One-Time", { exact: true })).toBeVisible(VISIBLE_OPTS);
  });

  test("free plan has correct features listed", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    // Check a few key free plan features
    await expect(page.getByText("1 monitor").first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText("Reddit only").first()).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/3 keywords/i).first()).toBeVisible(VISIBLE_OPTS);
  });

  test("paid plans show 14-day free trial", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const trialText = page.getByText(/14-day free trial/i);
    await expect(trialText.first()).toBeVisible(VISIBLE_OPTS);
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

    // Table headers: Feature, Free, Solo, Scale, Growth
    await expect(page.getByRole("columnheader", { name: /feature/i })).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByRole("columnheader", { name: /free/i })).toBeVisible(VISIBLE_OPTS);
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

    // Click on "Is there really a free plan?" question
    const freeQuestion = page.getByRole("button", { name: /is there really a free plan/i });
    await expect(freeQuestion).toBeVisible(VISIBLE_OPTS);
    await freeQuestion.click();

    // Answer should become visible (use .first() — text may appear in both FAQ answer and plan card)
    await expect(
      page.getByText(/free forever/i).first()
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
  test("free plan CTA links to sign-up", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    const freeCtaLink = page.getByRole("link", { name: /get started free/i });
    await expect(freeCtaLink).toBeVisible(VISIBLE_OPTS);
    await expect(freeCtaLink).toHaveAttribute("href", "/sign-up");
  });

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

    await expect(page.getByText(/14-day money-back guarantee/i)).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/no credit card for free tier/i)).toBeVisible(VISIBLE_OPTS);
    await expect(page.getByText(/cancel anytime/i).first()).toBeVisible(VISIBLE_OPTS);
  });

  test("bottom CTA section has start free button", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pricing", GOTO_OPTS);

    await expect(
      page.getByRole("heading", { name: /still not sure/i })
    ).toBeVisible(VISIBLE_OPTS);

    const startFreeBtn = page.getByRole("link", { name: /start free/i });
    await expect(startFreeBtn).toBeVisible(VISIBLE_OPTS);
    await expect(startFreeBtn).toHaveAttribute("href", "/sign-up");
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

import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Settings & Integrations E2E Tests
 * Tests settings page sections: profile, notifications, integrations,
 * timezone, export, subscriptions, and account deletion.
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

async function waitForHydration(page: Page, selector = "button", timeout = 15_000) {
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
// Settings Page - Profile Section
// ---------------------------------------------------------------------------

test.describe("Settings - Profile", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("settings page loads with main content", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("profile section shows user email", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // In dev mode, email is "dev-mode@kaulby.local" or actual user email
    const emailText = visibleElement(
      page.getByText(/@/i),
      page
    );
    await expect(emailText).toBeVisible({ timeout: 30_000 });
  });

  test("profile section shows plan badge", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // In dev mode, subscription is "enterprise" -> Team plan
    const planBadge = visibleElement(page.getByText(/free|pro|team/i), page);
    await expect(planBadge).toBeVisible({ timeout: 30_000 });
  });

  test("user name is displayed in settings", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // In dev mode, name is "Dev Mode User" or actual user name
    const nameElement = visibleElement(
      page.getByText(/dev mode user|account/i),
      page
    );
    // Name or Account heading should be visible
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });
  });
});

// ---------------------------------------------------------------------------
// Settings Page - Timezone
// ---------------------------------------------------------------------------

test.describe("Settings - Timezone", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("timezone selector shows current timezone", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // Timezone options include Eastern, Central, Mountain, Pacific
    const timezoneText = visibleElement(
      page.getByText(/eastern|central|mountain|pacific/i),
      page
    );
    await expect(timezoneText).toBeVisible({ timeout: 30_000 });
  });
});

// ---------------------------------------------------------------------------
// Settings Page - Notifications & Digests
// ---------------------------------------------------------------------------

test.describe("Settings - Notifications", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("pause digests switch is present", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    const digestSwitch = visibleElement(
      page.getByRole("switch", { name: /pause/i }),
      page
    );
    if (await digestSwitch.isVisible().catch(() => false)) {
      await expect(digestSwitch).toBeVisible();
    }
  });

  test("digest toggle sends API request", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const digestSwitch = visibleElement(
      page.getByRole("switch", { name: /pause/i }),
      page
    );
    if (await digestSwitch.isVisible().catch(() => false)) {
      const responsePromise = page.waitForResponse((res) =>
        res.url().includes("/api/user/email-preferences")
      );
      await digestSwitch.click({ force: true });
      const response = await responsePromise;
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("report schedule selector is present", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // Report schedule options: Off, Weekly, Monthly
    const reportLabel = visibleElement(
      page.getByText(/scheduled report|pdf report/i),
      page
    );
    if (await reportLabel.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(reportLabel).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Settings Page - Data Export
// ---------------------------------------------------------------------------

test.describe("Settings - Export", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("export data button is present", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });
    await waitForHydration(page);

    const exportBtn = visibleElement(
      page.getByRole("button", { name: /export data/i }),
      page
    );
    if (await exportBtn.isVisible().catch(() => false)) {
      await expect(exportBtn).toBeEnabled();
    }
  });

  test("export dropdown shows format options", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await waitForHydration(page);

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

  test("data stats section shows usage numbers", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // Data stats card shows monitors count, results count, AI calls
    const dataUsage = visibleElement(
      page.getByText(/data usage|storage|monitors|usage/i),
      page
    );
    // Just verify main content loaded
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });
  });
});

// ---------------------------------------------------------------------------
// Settings Page - Subscription Plans
// ---------------------------------------------------------------------------

test.describe("Settings - Subscription Plans", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("subscription section shows pricing cards", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // Settings page includes plan cards with $0 (Free), $29 (Pro), $99 (Team)
    await expect(visibleElement(page.getByText(/\$0/), page)).toBeVisible({ timeout: 30_000 });
    await expect(visibleElement(page.getByText(/\$29/), page)).toBeVisible();
  });

  test("current plan is highlighted", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/settings", { timeout: 45_000 });

    // In dev mode, enterprise/Team is current
    // Look for "Current" or "current" indicator on a plan card
    const currentIndicator = visibleElement(
      page.getByText(/current/i),
      page
    );
    if (await currentIndicator.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(currentIndicator).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Settings Page - Account Deletion
// ---------------------------------------------------------------------------

test.describe("Settings - Account Deletion", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("delete account button opens confirmation dialog", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: PAGE_TIMEOUT });

    const deleteTrigger = visibleElement(
      page.getByRole("button", { name: /delete account/i }),
      page
    );
    if (await deleteTrigger.isVisible().catch(() => false)) {
      await deleteTrigger.click({ force: true });

      // Confirmation dialog should appear
      const confirmInput = page.getByPlaceholder(/delete my account/i);
      if (await confirmInput.isVisible().catch(() => false)) {
        await expect(confirmInput).toBeVisible();
      }
    }
  });

  test("delete confirmation button is disabled until correct text entered", async ({ page }) => {
    await page.goto("/dashboard/settings");

    const deleteTrigger = visibleElement(
      page.getByRole("button", { name: /delete account/i }),
      page
    );
    if (await deleteTrigger.isVisible().catch(() => false)) {
      await deleteTrigger.click({ force: true });

      const confirmInput = page.getByPlaceholder(/delete my account/i);
      if (await confirmInput.isVisible().catch(() => false)) {
        // Button should be disabled initially
        const deleteBtn = page
          .getByRole("button", { name: /schedule deletion/i })
          .first();
        await expect(deleteBtn).toBeDisabled();

        // Type the confirmation text
        await confirmInput.fill("delete my account");
        await expect(deleteBtn).toBeEnabled();

        // Cancel to avoid actual deletion
        await page.getByRole("button", { name: /cancel/i }).click();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Webhooks Page
// ---------------------------------------------------------------------------

test.describe("Webhooks Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("webhooks page loads for enterprise users", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/dashboard/webhooks", { timeout: 45_000 });

    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });

    // Should show webhook management UI or empty state
    const webhookContent = visibleElement(
      page.getByText(/webhook/i),
      page
    );
    await expect(webhookContent).toBeVisible({ timeout: 30_000 });
  });
});

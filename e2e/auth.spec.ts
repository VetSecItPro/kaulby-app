import { test, expect } from "@playwright/test";

/**
 * Authentication Flow E2E Tests
 * Tests sign-in/sign-up pages and protected route redirects
 *
 * Note: In local development, the middleware bypasses auth for dashboard routes
 * to allow easier testing. Auth protection is enforced in production/CI.
 * Set PLAYWRIGHT_BASE_URL to production URL to test auth redirects.
 */

const isLocalDev = !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL?.includes("kaulbyapp.com");

test.describe("Authentication Pages", () => {
  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");

    // Clerk sign-in component should load
    await expect(page.locator("[data-clerk-component]").first()).toBeVisible({ timeout: 10000 });
  });

  test("sign-up page loads", async ({ page }) => {
    await page.goto("/sign-up");

    // Clerk sign-up component should load
    await expect(page.locator("[data-clerk-component]").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Protected Routes", () => {
  // Skip auth redirect tests in local dev where middleware bypasses auth
  test.skip(isLocalDev, "Auth bypassed in local development");

  test("dashboard redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });

  test("monitors page redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/monitors");
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });

  test("settings page redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });
});

test.describe("Dashboard Pages (Local Dev)", () => {
  // These tests only run in local dev where auth is bypassed
  test.skip(!isLocalDev, "Only runs in local development");

  test("dashboard page loads without auth in local dev", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/dashboard/);
    // Dashboard should show content - check for dashboard-specific element
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("monitors page loads without auth in local dev", async ({ page }) => {
    await page.goto("/dashboard/monitors");
    await expect(page).toHaveURL(/monitors/);
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("settings page loads without auth in local dev", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/settings/);
    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

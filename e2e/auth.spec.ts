import { test, expect } from "@playwright/test";

/**
 * Authentication Flow E2E Tests
 * Tests sign-in/sign-up pages load correctly
 *
 * Note: Protected route redirect tests are skipped as they require
 * real Clerk auth configuration. Test manually or in staging.
 */

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

// Skip protected route redirect tests - requires real Clerk auth setup
// These are better tested manually or in staging with real auth
test.describe.skip("Protected Routes", () => {
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

// Dashboard page tests are in e2e/dashboard.spec.ts

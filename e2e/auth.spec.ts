import { test, expect } from "@playwright/test";

/**
 * Authentication Flow E2E Tests
 * Tests sign-in/sign-up pages and protected route redirects
 */

test.describe("Authentication", () => {
  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");

    // Clerk sign-in component should load
    await expect(page.locator("[data-clerk-component]").or(page.getByText(/sign in/i).first())).toBeVisible({
      timeout: 10000,
    });
  });

  test("sign-up page loads", async ({ page }) => {
    await page.goto("/sign-up");

    // Clerk sign-up component should load
    await expect(page.locator("[data-clerk-component]").or(page.getByText(/sign up/i).first())).toBeVisible({
      timeout: 10000,
    });
  });

  test("dashboard redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });

  test("monitors page redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/monitors");

    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });

  test("settings page redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 10000 });
  });
});

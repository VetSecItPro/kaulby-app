import { test, expect } from "@playwright/test";

/**
 * Dashboard E2E Tests
 * Tests dashboard functionality in local development (auth bypassed)
 *
 * Note: These tests run against local dev where auth is bypassed.
 * They verify dashboard pages load and basic interactions work.
 */

const isLocalDev = !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL?.includes("kaulbyapp.com");

test.describe("Dashboard Navigation", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("dashboard pages are accessible via direct navigation", async ({ page }) => {
    // Test that key dashboard routes load
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/dashboard/monitors");
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/dashboard/results");
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("dashboard shows main content area", async ({ page }) => {
    await page.goto("/dashboard");

    // Dashboard should have a main content area
    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

test.describe("Monitors Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("monitors page loads", async ({ page }) => {
    await page.goto("/dashboard/monitors");

    // Page should load with main content
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("monitor creation page is accessible", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    // Should load the creation page
    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

test.describe("Settings Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("settings page loads", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Settings page should load
    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

test.describe("Results Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("results page loads", async ({ page }) => {
    await page.goto("/dashboard/results");

    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

test.describe("Analytics Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("analytics page loads with charts or empty state", async ({ page }) => {
    await page.goto("/dashboard/analytics");

    await expect(page.getByRole("main").first()).toBeVisible();
  });
});

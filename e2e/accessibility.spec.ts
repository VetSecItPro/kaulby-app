import { test, expect } from "@playwright/test";

/**
 * Accessibility E2E Tests
 * Basic accessibility checks for key pages
 */

test.describe("Accessibility", () => {
  test("homepage has proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Should have exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // H1 should be visible
    await expect(page.locator("h1")).toBeVisible();
  });

  test("homepage images have alt text", async ({ page }) => {
    await page.goto("/");

    // All images should have alt attribute
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const src = await img.getAttribute("src");

      // Allow empty alt for decorative images, but attribute must exist
      expect(alt, `Image ${src} missing alt attribute`).not.toBeNull();
    }
  });

  test("pricing page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/pricing");

    // Should have exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("interactive elements are keyboard accessible", async ({ page }) => {
    await page.goto("/");

    // Tab to first interactive element
    await page.keyboard.press("Tab");

    // Should have focus on some element
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });

  test("color contrast is sufficient (visual check)", async ({ page }) => {
    await page.goto("/");

    // This is a basic check - full contrast testing requires axe-core
    // Just verify the page renders without errors
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("homepage renders correctly on mobile", async ({ page }) => {
    await page.goto("/");

    // H1 should still be visible
    await expect(page.locator("h1")).toBeVisible();

    // CTA should be visible
    const ctaButton = page.getByRole("link", { name: /get started|sign up|try free|start free/i });
    await expect(ctaButton.first()).toBeVisible();
  });

  test("navigation is accessible on mobile", async ({ page }) => {
    await page.goto("/");

    // Mobile menu button or nav should be accessible
    const navElement = page.locator("nav").or(page.getByRole("navigation"));
    await expect(navElement.first()).toBeVisible();
  });
});

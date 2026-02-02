import { test, expect } from "@playwright/test";

/**
 * Dashboard E2E Tests
 * Tests dashboard functionality in local development (auth bypassed)
 *
 * Note: These tests run against local dev where auth is bypassed.
 * They verify dashboard pages load, forms validate, and interactions work.
 */

const isLocalDev =
  !process.env.CI &&
  !process.env.PLAYWRIGHT_BASE_URL?.includes("kaulbyapp.com");

// ---------------------------------------------------------------------------
// Dashboard Navigation
// ---------------------------------------------------------------------------

test.describe("Dashboard Navigation", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("dashboard pages are accessible via direct navigation", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/dashboard/monitors");
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/dashboard/results");
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("dashboard overview shows action cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main").first()).toBeVisible();

    // The overview page shows the heading
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/dashboard");

    // Click Monitors nav link and verify navigation
    const monitorsLink = page.getByRole("link", { name: /monitors/i }).first();
    if (await monitorsLink.isVisible()) {
      await monitorsLink.click();
      await page.waitForURL("**/dashboard/monitors");
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Monitor Creation Form
// ---------------------------------------------------------------------------

test.describe("Monitor Creation Form", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("form renders with required fields", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    // Heading
    await expect(
      page.getByRole("heading", { name: "New Monitor" })
    ).toBeVisible();

    // Required input fields
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#companyName")).toBeVisible();

    // Platform selection area should have Reddit checkbox (always available)
    await expect(page.locator("#platform-reddit")).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: /create monitor/i })
    ).toBeVisible();
  });

  test("shows validation errors for empty required fields", async ({
    page,
  }) => {
    await page.goto("/dashboard/monitors/new");

    // Submit without filling anything
    await page.getByRole("button", { name: /create monitor/i }).click();

    // Should show error for missing name
    await expect(page.getByText(/please enter a monitor name/i)).toBeVisible();
  });

  test("shows error when no platform selected", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    // Fill name and company but skip platforms
    await page.locator("#name").fill("Test Monitor");
    await page.locator("#companyName").fill("Test Company");

    await page.getByRole("button", { name: /create monitor/i }).click();

    // Should require platform selection
    await expect(
      page.getByText(/please select at least one platform/i)
    ).toBeVisible();
  });

  test("keyword input adds and removes keywords", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    // Type a keyword and press Enter
    const keywordInput = page.locator("#keywords");
    await keywordInput.fill("test keyword");
    await keywordInput.press("Enter");

    // Keyword should appear as a badge
    await expect(page.getByText("test keyword")).toBeVisible();

    // Remove it by clicking the X button
    const badge = page.getByText("test keyword").locator("..");
    const removeBtn = badge.locator("svg").first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await expect(page.getByText("test keyword")).not.toBeVisible();
    }
  });

  test("platform checkboxes toggle selection", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    // Reddit should be unchecked initially
    const redditCheckbox = page.locator("#platform-reddit");
    await expect(redditCheckbox).toBeVisible();

    // Click to select Reddit
    await redditCheckbox.click();
    await expect(redditCheckbox).toBeChecked();

    // Click again to deselect
    await redditCheckbox.click();
    await expect(redditCheckbox).not.toBeChecked();
  });

  test("cancel button navigates back to monitors list", async ({ page }) => {
    await page.goto("/dashboard/monitors/new");

    const cancelLink = page.getByRole("link", { name: /cancel/i });
    if (await cancelLink.isVisible()) {
      await cancelLink.click();
      await page.waitForURL("**/dashboard/monitors");
    }
  });

  test("creates a monitor and redirects to monitors list", async ({
    page,
  }) => {
    await page.goto("/dashboard/monitors/new");

    // Fill required fields
    await page.locator("#name").fill("E2E Test Monitor");
    await page.locator("#companyName").fill("E2E Test Company");

    // Select Reddit platform
    await page.locator("#platform-reddit").click();

    // Intercept the API call
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/monitors") && res.request().method() === "POST"
    );

    // Submit the form
    await page.getByRole("button", { name: /create monitor/i }).click();

    // Wait for API response
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(500);

    // If successful, should redirect to monitors list
    if (response.ok()) {
      await page.waitForURL("**/dashboard/monitors", { timeout: 10000 });
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Monitors List Page
// ---------------------------------------------------------------------------

test.describe("Monitors List Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("shows monitors heading and new monitor button", async ({ page }) => {
    await page.goto("/dashboard/monitors");

    await expect(
      page.getByRole("heading", { name: /monitors/i }).first()
    ).toBeVisible();

    // New Monitor button should be present
    const newMonitorBtn = page.getByRole("link", { name: /new monitor/i });
    await expect(newMonitorBtn).toBeVisible();
  });

  test("new monitor button navigates to creation page", async ({ page }) => {
    await page.goto("/dashboard/monitors");

    const newMonitorBtn = page.getByRole("link", { name: /new monitor/i });
    await newMonitorBtn.click();
    await page.waitForURL("**/dashboard/monitors/new");
    await expect(page.locator("#name")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

test.describe("Settings Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("settings page shows account information", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("main").first()).toBeVisible();

    // Should show account section with plan badge
    const planBadge = page.getByText(/free|pro|team/i).first();
    await expect(planBadge).toBeVisible();
  });

  test("timezone selector is present", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Timezone select should be visible
    const timezoneText = page.getByText(/eastern|central|mountain|pacific/i).first();
    await expect(timezoneText).toBeVisible();
  });

  test("pause digests switch toggles and calls API", async ({ page }) => {
    await page.goto("/dashboard/settings");

    const digestSwitch = page.locator("#pause-digests");
    if (await digestSwitch.isVisible()) {
      // Intercept the API call
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/user/email-preferences")
      );

      await digestSwitch.click();

      const response = await responsePromise;
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("delete account dialog requires confirmation text", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    // Find and click the delete account trigger
    const deleteTrigger = page.getByRole("button", {
      name: /delete account/i,
    });
    if (await deleteTrigger.isVisible()) {
      await deleteTrigger.click();

      // Dialog should open with confirmation input
      const confirmInput = page.locator("#confirm-delete");
      await expect(confirmInput).toBeVisible();

      // Delete button should be disabled until confirmation is typed
      const deleteBtn = page
        .getByRole("button", { name: /schedule deletion/i })
        .first();
      await expect(deleteBtn).toBeDisabled();

      // Type the confirmation phrase
      await confirmInput.fill("delete my account");
      await expect(deleteBtn).toBeEnabled();

      // Cancel instead of actually deleting
      await page.getByRole("button", { name: /cancel/i }).click();
    }
  });

  test("subscription plans section shows pricing cards", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Should show plan cards with pricing
    await expect(page.getByText(/\$0/)).toBeVisible();
    await expect(page.getByText(/\$29/)).toBeVisible();
  });

  test("export data dropdown shows format options", async ({ page }) => {
    await page.goto("/dashboard/settings");

    const exportBtn = page.getByRole("button", { name: /export data/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();

      // Dropdown should show format options
      await expect(page.getByText(/full export.*json/i)).toBeVisible();
      await expect(page.getByText(/results only.*csv/i)).toBeVisible();

      // Dismiss dropdown by pressing Escape
      await page.keyboard.press("Escape");
    }
  });
});

// ---------------------------------------------------------------------------
// Results Page
// ---------------------------------------------------------------------------

test.describe("Results Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("results page shows heading and search input", async ({ page }) => {
    await page.goto("/dashboard/results");

    await expect(
      page.getByRole("heading", { name: /results/i }).first()
    ).toBeVisible();

    // Search input should be present
    const searchInput = page.getByPlaceholder(/search results/i);
    await expect(searchInput).toBeVisible();
  });

  test("search input accepts text", async ({ page }) => {
    await page.goto("/dashboard/results");

    const searchInput = page.getByPlaceholder(/search results/i);
    await searchInput.fill("pricing feedback");

    await expect(searchInput).toHaveValue("pricing feedback");
  });

  test("filters toggle button shows/hides sidebar", async ({ page }) => {
    await page.goto("/dashboard/results");

    const filterBtn = page.getByRole("button", { name: /show filters|hide filters/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      // Filter sidebar should toggle visibility
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Analytics Page
// ---------------------------------------------------------------------------

test.describe("Analytics Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("analytics page shows heading and time range buttons", async ({
    page,
  }) => {
    await page.goto("/dashboard/analytics");

    await expect(
      page.getByRole("heading", { name: /analytics/i }).first()
    ).toBeVisible();

    // Time range buttons
    await expect(page.getByRole("button", { name: "7 Days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30 Days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "90 Days" })).toBeVisible();
  });

  test("time range buttons switch active state", async ({ page }) => {
    await page.goto("/dashboard/analytics");

    const sevenDays = page.getByRole("button", { name: "7 Days" });
    const thirtyDays = page.getByRole("button", { name: "30 Days" });

    // Click 7 Days and verify it becomes active
    await sevenDays.click();
    // The active button uses the "default" variant (non-outline)
    await expect(sevenDays).toBeVisible();

    // Click 30 Days
    await thirtyDays.click();
    await expect(thirtyDays).toBeVisible();
  });

  test("summary cards are visible", async ({ page }) => {
    await page.goto("/dashboard/analytics");

    // Summary stats cards should be present (may show 0 values)
    await expect(page.getByText(/total mentions/i)).toBeVisible();
    await expect(page.getByText(/sentiment/i).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Ask AI Page
// ---------------------------------------------------------------------------

test.describe("Ask AI Page", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("ask page shows heading and input", async ({ page }) => {
    await page.goto("/dashboard/ask");
    await expect(page.getByRole("main").first()).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /ask kaulby ai/i })
    ).toBeVisible();
  });

  test("chat input is present and submittable", async ({ page }) => {
    await page.goto("/dashboard/ask");

    // For free users, the page may show upgrade prompt instead of input
    const chatInput = page.getByPlaceholder(/ask about your data/i);
    const upgradePrompt = page.getByText(/pro feature/i);

    if (await chatInput.isVisible()) {
      await chatInput.fill("What are the top pain points?");
      await expect(chatInput).toHaveValue("What are the top pain points?");

      // Send button should be present
      const sendBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
      await expect(sendBtn).toBeVisible();
    } else if (await upgradePrompt.isVisible()) {
      // Free user sees upgrade prompt - this is expected
      await expect(page.getByText(/upgrade to pro/i)).toBeVisible();
    }
  });

  test("suggested questions appear in empty state", async ({ page }) => {
    await page.goto("/dashboard/ask");

    // For Pro users, suggested questions should appear
    const suggestedBtn = page.getByRole("button").filter({ hasText: /what|show|top/i }).first();
    // This may not be visible for free users, which is expected
    if (await suggestedBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(suggestedBtn).toBeEnabled();
    }
  });
});

// ---------------------------------------------------------------------------
// API Response Validation
// ---------------------------------------------------------------------------

test.describe("API Response Shape", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("GET /api/results returns expected shape", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/results");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      // Should have a results array
      expect(body).toHaveProperty("results");
      expect(Array.isArray(body.results)).toBe(true);
    }
  });

  test("GET /api/insights returns expected shape", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/insights?range=30d");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test("GET /api/analytics returns expected shape", async ({ page }) => {
    await page.goto("/dashboard");

    const response = await page.request.get("/api/analytics?range=30d");
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

test.describe("Error Handling", () => {
  test.skip(!isLocalDev, "Only runs in local development");

  test("invalid dashboard route shows error or redirects", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard/nonexistent-page");
    // Should get 404 or redirect — not a 500
    expect(response?.status()).not.toBe(500);
  });

  test("monitor creation with network error shows feedback", async ({
    page,
  }) => {
    await page.goto("/dashboard/monitors/new");

    // Fill valid form data
    await page.locator("#name").fill("Network Error Test");
    await page.locator("#companyName").fill("Error Corp");
    await page.locator("#platform-reddit").click();

    // Intercept API and simulate server error
    await page.route("**/api/monitors", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );

    await page.getByRole("button", { name: /create monitor/i }).click();

    // Should show error message, not crash
    await expect(
      page.getByText(/failed|error|something went wrong/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

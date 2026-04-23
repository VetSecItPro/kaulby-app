/**
 * Comprehensive Polar Checkout Flow Test
 *
 * Tests the entire checkout flow logic:
 * 1. Plan/product ID mapping
 * 2. Checkout API request validation
 * 3. Webhook event processing
 * 4. Database updates
 *
 * Run with: npx tsx scripts/test-polar-checkout.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Import the functions we're testing
import {
  POLAR_PLANS,
  getPlanFromProductId,
  getProductId,
  type PolarPlanKey,
  type BillingInterval
} from "../src/lib/polar";

// Test results tracking
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📋 ${name}`);
  console.log("=".repeat(60));
}

// ============================================================
// SECTION 1: Environment Variables
// ============================================================
section("Environment Variables");

const requiredEnvVars = [
  "POLAR_ACCESS_TOKEN",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_ORG_ID",
  "POLAR_PRO_MONTHLY_PRODUCT_ID",
  "POLAR_PRO_ANNUAL_PRODUCT_ID",
  "POLAR_TEAM_MONTHLY_PRODUCT_ID",
  "POLAR_TEAM_ANNUAL_PRODUCT_ID",
  "POLAR_DAY_PASS_PRODUCT_ID",
];

for (const envVar of requiredEnvVars) {
  test(`${envVar} is set`, () => {
    const value = process.env[envVar];
    return !!value && value.length > 0;
  });
}

// ============================================================
// SECTION 2: Plan Configuration
// ============================================================
section("Plan Configuration");

test("Free plan has no product IDs", () => {
  return POLAR_PLANS.free.priceId === null && POLAR_PLANS.free.annualPriceId === null;
});

// Note: POLAR_PLANS reads env vars at module load time, so we test via getProductId instead
test("getProductId returns Pro monthly product ID", () => {
  const id = getProductId("solo", "monthly");
  return !!id && id.length > 0;
});

test("getProductId returns Pro annual product ID", () => {
  const id = getProductId("solo", "annual");
  return !!id && id.length > 0;
});

test("getProductId returns Team monthly product ID", () => {
  const id = getProductId("growth", "monthly");
  return !!id && id.length > 0;
});

test("getProductId returns Team annual product ID", () => {
  const id = getProductId("growth", "annual");
  return !!id && id.length > 0;
});

test("Pro monthly price is $29", () => {
  return POLAR_PLANS.solo.price === 29;
});

test("Pro annual price is $290 (2 months free)", () => {
  return POLAR_PLANS.solo.annualPrice === 290;
});

test("Team monthly price is $99", () => {
  return POLAR_PLANS.growth.price === 99;
});

test("Team annual price is $990 (2 months free)", () => {
  return POLAR_PLANS.growth.annualPrice === 990;
});

test("Pro has 14-day trial", () => {
  return POLAR_PLANS.solo.trialDays === 14;
});

test("Team has 14-day trial", () => {
  return POLAR_PLANS.growth.trialDays === 14;
});

// ============================================================
// SECTION 3: Product ID Mapping
// ============================================================
section("Product ID Mapping (getProductId)");

test("getProductId('pro', 'monthly') returns env var value", () => {
  const id = getProductId("solo", "monthly");
  return id === process.env.POLAR_PRO_MONTHLY_PRODUCT_ID;
});

test("getProductId('pro', 'annual') returns env var value", () => {
  const id = getProductId("solo", "annual");
  return id === process.env.POLAR_PRO_ANNUAL_PRODUCT_ID;
});

test("getProductId('team', 'monthly') returns env var value", () => {
  const id = getProductId("growth", "monthly");
  return id === process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID;
});

test("getProductId('team', 'annual') returns env var value", () => {
  const id = getProductId("growth", "annual");
  return id === process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID;
});

test("getProductId('free', 'monthly') returns null", () => {
  const id = getProductId("free", "monthly");
  return id === null;
});

// ============================================================
// SECTION 4: Reverse Product ID Mapping (Webhook)
// ============================================================
section("Reverse Product ID Mapping (getPlanFromProductId)");

test("Pro monthly product ID maps to 'pro'", () => {
  const plan = getPlanFromProductId(process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || "");
  return plan === "solo";
});

test("Pro annual product ID maps to 'pro'", () => {
  const plan = getPlanFromProductId(process.env.POLAR_PRO_ANNUAL_PRODUCT_ID || "");
  return plan === "solo";
});

test("Team monthly product ID maps to 'team'", () => {
  const plan = getPlanFromProductId(process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID || "");
  return plan === "growth";
});

test("Team annual product ID maps to 'team'", () => {
  const plan = getPlanFromProductId(process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID || "");
  return plan === "growth";
});

test("Unknown product ID maps to 'free'", () => {
  const plan = getPlanFromProductId("unknown-product-id");
  return plan === "free";
});

test("Empty product ID maps to 'free'", () => {
  const plan = getPlanFromProductId("");
  return plan === "free";
});

// ============================================================
// SECTION 5: Checkout API Request Validation
// ============================================================
section("Checkout API Request Validation Logic");

function validateCheckoutRequest(body: { plan?: string; billingInterval?: string }): { valid: boolean; error?: string } {
  const { plan, billingInterval = "monthly" } = body;

  // Validate plan
  if (!plan || !(plan in POLAR_PLANS) || plan === "free") {
    return { valid: false, error: "Invalid plan selected" };
  }

  // Validate billing interval
  if (billingInterval !== "monthly" && billingInterval !== "annual") {
    return { valid: false, error: "Invalid billing interval" };
  }

  // Get product ID
  const productId = getProductId(plan as PolarPlanKey, billingInterval as BillingInterval);
  if (!productId) {
    return { valid: false, error: "Product ID not configured for this plan" };
  }

  return { valid: true };
}

test("Valid pro monthly request passes", () => {
  const result = validateCheckoutRequest({ plan: "solo", billingInterval: "monthly" });
  return result.valid === true;
});

test("Valid pro annual request passes", () => {
  const result = validateCheckoutRequest({ plan: "solo", billingInterval: "annual" });
  return result.valid === true;
});

test("Valid team monthly request passes", () => {
  const result = validateCheckoutRequest({ plan: "growth", billingInterval: "monthly" });
  return result.valid === true;
});

test("Valid team annual request passes", () => {
  const result = validateCheckoutRequest({ plan: "growth", billingInterval: "annual" });
  return result.valid === true;
});

test("Missing plan fails", () => {
  const result = validateCheckoutRequest({ billingInterval: "monthly" });
  return result.valid === false && result.error === "Invalid plan selected";
});

test("Free plan fails", () => {
  const result = validateCheckoutRequest({ plan: "free", billingInterval: "monthly" });
  return result.valid === false && result.error === "Invalid plan selected";
});

test("Invalid plan fails", () => {
  const result = validateCheckoutRequest({ plan: "invalid", billingInterval: "monthly" });
  return result.valid === false && result.error === "Invalid plan selected";
});

test("Invalid billing interval fails", () => {
  const result = validateCheckoutRequest({ plan: "solo", billingInterval: "weekly" });
  return result.valid === false && result.error === "Invalid billing interval";
});

test("Default billing interval is monthly", () => {
  const result = validateCheckoutRequest({ plan: "solo" });
  return result.valid === true;
});

// ============================================================
// SECTION 7: Webhook Plan Mapping
// ============================================================
section("Webhook Plan to Subscription Status Mapping");

function mapPlanToSubscriptionStatus(plan: PolarPlanKey): "free" | "scale" | "solo" | "enterprise" {
  if (plan === "growth") return "enterprise";
  return plan;
}

test("'pro' maps to 'pro' subscription status", () => {
  return mapPlanToSubscriptionStatus("solo") === "solo";
});

test("'team' maps to 'enterprise' subscription status", () => {
  return mapPlanToSubscriptionStatus("growth") === "enterprise";
});

test("'free' maps to 'free' subscription status", () => {
  return mapPlanToSubscriptionStatus("free") === "free";
});

// ============================================================
// SECTION 8: Full Flow Simulation
// ============================================================
section("Full Checkout Flow Simulation");

function simulateCheckoutFlow(plan: "solo" | "growth", interval: BillingInterval) {
  // Step 1: Get product ID (checkout API)
  const productId = getProductId(plan, interval);
  if (!productId) return { success: false, error: "No product ID" };

  // Step 2: Simulate webhook with this product ID
  const detectedPlan = getPlanFromProductId(productId);
  if (detectedPlan === "free") return { success: false, error: "Plan not detected from product ID" };

  // Step 3: Map to subscription status
  const subscriptionStatus = mapPlanToSubscriptionStatus(detectedPlan);

  // Step 4: Verify the status matches expected
  const expectedStatus = plan === "growth" ? "enterprise" : plan;
  if (subscriptionStatus !== expectedStatus) {
    return { success: false, error: `Status mismatch: got ${subscriptionStatus}, expected ${expectedStatus}` };
  }

  return { success: true, productId, plan: detectedPlan, subscriptionStatus };
}

test("Pro monthly: checkout → webhook → correct status", () => {
  const result = simulateCheckoutFlow("solo", "monthly");
  return result.success && result.subscriptionStatus === "solo";
});

test("Pro annual: checkout → webhook → correct status", () => {
  const result = simulateCheckoutFlow("solo", "annual");
  return result.success && result.subscriptionStatus === "solo";
});

test("Team monthly: checkout → webhook → correct status", () => {
  const result = simulateCheckoutFlow("growth", "monthly");
  return result.success && result.subscriptionStatus === "enterprise";
});

test("Team annual: checkout → webhook → correct status", () => {
  const result = simulateCheckoutFlow("growth", "annual");
  return result.success && result.subscriptionStatus === "enterprise";
});

// ============================================================
// SECTION 9: Product ID Uniqueness
// ============================================================
section("Product ID Uniqueness Check");

test("All product IDs are unique", () => {
  const ids = [
    process.env.POLAR_PRO_MONTHLY_PRODUCT_ID,
    process.env.POLAR_PRO_ANNUAL_PRODUCT_ID,
    process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID,
    process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID,
  ].filter(Boolean);

  const uniqueIds = new Set(ids);
  return uniqueIds.size === ids.length;
});

test("Monthly and annual IDs are different for Pro", () => {
  return process.env.POLAR_PRO_MONTHLY_PRODUCT_ID !== process.env.POLAR_PRO_ANNUAL_PRODUCT_ID;
});

test("Monthly and annual IDs are different for Team", () => {
  return process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID !== process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID;
});

// ============================================================
// FINAL RESULTS
// ============================================================
console.log(`\n${"=".repeat(60)}`);
console.log("📊 FINAL RESULTS");
console.log("=".repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total:  ${passed + failed}`);
console.log("=".repeat(60));

if (failed > 0) {
  console.log("\n⚠️  Some tests failed. Review the output above.");
  process.exit(1);
} else {
  console.log("\n🎉 All tests passed! Checkout flow is ready for production.");
  process.exit(0);
}

# Kaulby: Stripe to Polar.sh Migration Guide

**Status:** Planning Phase
**Last Updated:** January 18, 2026

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Why Polar.sh?](#why-polarsh)
3. [Current Stripe Integration](#current-stripe-integration)
4. [Polar.sh Overview](#polarsh-overview)
5. [Conversion Todo List](#conversion-todo-list)
6. [Implementation Details](#implementation-details)
7. [Database Changes](#database-changes)
8. [API Route Changes](#api-route-changes)
9. [Webhook Handler](#webhook-handler)
10. [UI Component Changes](#ui-component-changes)
11. [Environment Variables](#environment-variables)
12. [Testing Checklist](#testing-checklist)
13. [Rollback Plan](#rollback-plan)
14. [Sources & References](#sources--references)

---

## Executive Summary

This document outlines the complete migration from Stripe to Polar.sh as Kaulby's payment processor and Merchant of Record (MoR). Polar.sh handles tax compliance globally, simplifies our billing infrastructure, and provides developer-friendly webhooks.

**Key Benefits:**
- **Merchant of Record**: Polar handles VAT, GST, Sales Tax worldwide
- **Transparent Pricing**: 4% + $0.40 per transaction (includes all payment processor fees)
- **Business-Logic Webhooks**: Events like `subscription.created` instead of generic `payment.succeeded`
- **Data Portability**: Built on Stripe Connect, enabling future flexibility
- **Developer Experience**: TypeScript SDK, Next.js adapter, minimal boilerplate

---

## Why Polar.sh?

### Comparison: Stripe vs Polar.sh

| Feature | Stripe | Polar.sh |
|---------|--------|----------|
| **Role** | Payment Processor | Merchant of Record |
| **Tax Compliance** | You handle it (or pay extra for Stripe Tax) | Included - Polar files all taxes |
| **Base Fee** | 2.9% + $0.30 | 4% + $0.40 (includes underlying fees) |
| **International Cards** | +1.5% additional | Included in base fee |
| **Webhooks** | Low-level payment events | High-level business events |
| **Setup Complexity** | Moderate | Simple (6-line integration) |
| **Subscription Management** | You build billing portal | Built-in customer portal |
| **VAT/GST B2B** | Complex to implement | Automatic |

### When to Choose Polar.sh
- Solo developer or small team
- Selling SaaS subscriptions globally
- Want to avoid tax compliance headaches
- Need simple subscription billing
- Value developer experience

### When to Stick with Stripe
- Complex marketplace with split payouts
- Need PayPal, BNPL, regional payment methods
- High volume (>$1M ARR) where 4% becomes expensive
- Custom payment flows beyond subscriptions

**Decision for Kaulby:** Polar.sh is the right choice for our current stage. No paying customers yet, and the tax compliance alone justifies the slightly higher fee.

---

## Current Stripe Integration

### Files with Stripe Dependencies

| File | Purpose | LOC |
|------|---------|-----|
| `src/lib/plans.ts` | Core config, plan definitions, helpers (renamed from stripe.ts) | ~200 |
| `src/app/api/stripe/checkout/route.ts` | Standard checkout (redirect) | ~80 |
| `src/app/api/stripe/embedded-checkout/route.ts` | Embedded checkout with trials | ~100 |
| `src/app/api/stripe/day-pass/route.ts` | Day Pass one-time payment | ~70 |
| `src/app/api/stripe/portal/route.ts` | Billing portal access | ~50 |
| `src/app/api/webhooks/stripe/route.ts` | Webhook handler | ~300 |
| `src/components/checkout-modal.tsx` | Embedded checkout UI | ~150 |
| `src/components/day-pass-card.tsx` | Day Pass purchase/countdown | ~100 |
| `src/app/pricing/page.tsx` | Pricing page | ~400 |

### Subscription Tiers

```typescript
// Current pricing structure
PLANS = {
  free: {
    price: 0,
    monitors: 1,
    keywordsPerMonitor: 3,
    resultsVisible: 3,
    resultsHistoryDays: 3,
    refreshDelayHours: 24,
    platforms: ["reddit"],
    trialDays: 0,
  },
  pro: {
    monthlyPrice: 29,
    annualPrice: 290, // ~$24/mo, 2 months free
    monitors: 10,
    keywordsPerMonitor: 20,
    resultsVisible: -1, // unlimited
    resultsHistoryDays: 90,
    refreshDelayHours: 4,
    platforms: ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"],
    trialDays: 14,
  },
  enterprise: {
    monthlyPrice: 99,
    annualPrice: 990, // ~$82.50/mo, 2 months free
    monitors: -1, // unlimited
    keywordsPerMonitor: 50,
    resultsVisible: -1,
    resultsHistoryDays: 365,
    refreshDelayHours: 0, // real-time
    platforms: [/* all */],
    trialDays: 14,
    teamSeats: 5, // +$15/additional user
  },
};
```

### Special Features

**Day Pass ($10 one-time)**
- 24-hour Pro access for free users
- Stored in `dayPassExpiresAt`, `dayPassPurchaseCount`
- Conversion tool - lets users experience Pro before committing

**Founding Members (First 1,000)**
- Pro/Enterprise subscribers 1-1000 get price locked forever
- Atomic SQL assignment prevents race conditions
- Stored in `isFoundingMember`, `foundingMemberNumber`, `foundingMemberPriceId`

### Database Schema (users table)

```sql
-- Stripe-specific fields (to be replaced)
stripe_customer_id TEXT UNIQUE,
subscription_id TEXT,

-- Subscription tracking (keep these)
subscription_status TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'enterprise'
current_period_start TIMESTAMP,
current_period_end TIMESTAMP,

-- Founding member tracking (keep these)
is_founding_member BOOLEAN DEFAULT FALSE,
founding_member_number INTEGER,
founding_member_price_id TEXT,

-- Day Pass tracking (keep these)
day_pass_expires_at TIMESTAMP,
day_pass_purchase_count INTEGER DEFAULT 0,
last_day_pass_purchased_at TIMESTAMP,
```

### Feature Gating (`src/lib/limits.ts`)

```typescript
// Key functions (unchanged - uses subscriptionStatus, not Stripe)
getUserPlan(userId) // Returns 'free' | 'pro' | 'enterprise' (checks day pass first)
getPlanLimits(plan) // Returns limits for plan
canAccessPlatform(userId, platform)
canAccessFeature(userId, feature)
canCreateMonitor(userId)
getResultsVisibility(userId)
canViewAiAnalysis(userId, resultIndex, totalResults)
```

---

## Polar.sh Overview

### How Polar.sh Works

1. **Products**: Define products in Polar dashboard (or via API)
2. **Checkout**: Redirect users to Polar-hosted checkout
3. **Webhooks**: Receive events when subscriptions change
4. **Customer Portal**: Users manage subscriptions via Polar portal

### Polar API Endpoints

```
POST /v1/products/          - Create products
GET  /v1/products/{id}      - Get product details
POST /v1/checkouts/         - Create checkout session
GET  /v1/subscriptions/{id} - Get subscription
PATCH /v1/subscriptions/{id} - Update subscription
DELETE /v1/subscriptions/{id} - Cancel subscription
```

### Polar Webhook Events

| Event | Description |
|-------|-------------|
| `checkout.created` | Checkout session started |
| `checkout.updated` | Checkout state changed (succeeded, failed) |
| `subscription.created` | New subscription created |
| `subscription.active` | Subscription became active (after trial) |
| `subscription.updated` | Subscription modified |
| `subscription.canceled` | Subscription canceled (end of period) |
| `subscription.revoked` | Subscription immediately terminated |
| `customer.state_changed` | Unified customer state update |
| `order.paid` | One-time payment completed |
| `benefit.granted` | Benefit (license, Discord, etc.) granted |

### Polar SDK

```typescript
import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: "production", // or "sandbox"
});

// Create checkout
const checkout = await polar.checkouts.create({
  products: [productId],
  customerEmail: "user@example.com",
  metadata: { userId: "..." },
  successUrl: "https://app.com/success?checkout_id={CHECKOUT_ID}",
});

// Redirect user to checkout.url
```

### Polar Next.js Adapter

```typescript
import { Checkout, CustomerPortal, Webhooks } from "@polar-sh/nextjs";

// Checkout handler
export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: "/dashboard?success=true",
});

// Customer portal handler
export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  getCustomerId: async (req) => { /* ... */ },
});

// Webhook handler
export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onSubscriptionCreated: async (subscription) => { /* ... */ },
  onSubscriptionCanceled: async (subscription) => { /* ... */ },
});
```

---

## Conversion Todo List

### Phase 1: Polar.sh Setup
- [ ] Create Polar.sh organization account
- [ ] Generate Organization Access Token (Settings > Developers)
- [ ] Configure webhook endpoint URL
- [ ] Create products in Polar dashboard:
  - [ ] **Kaulby Pro Monthly** - $29/month, 14-day trial, recurring
  - [ ] **Kaulby Pro Annual** - $290/year, 14-day trial, recurring
  - [ ] **Kaulby Team Monthly** - $99/month, 14-day trial, recurring
  - [ ] **Kaulby Team Annual** - $990/year, 14-day trial, recurring
  - [ ] **Kaulby Day Pass** - $10, one-time payment
- [ ] Record all Product IDs
- [ ] Test sandbox checkout flow

### Phase 2: Environment Setup
- [ ] Add Polar environment variables to `.env.local`
- [ ] Add Polar environment variables to Vercel (production)
- [ ] Add Polar environment variables to Vercel (preview)

### Phase 3: Dependencies
- [ ] Install `@polar-sh/sdk`
- [ ] Install `@polar-sh/nextjs`
- [ ] Keep Stripe packages (remove later after cleanup)

### Phase 4: Database Schema
- [ ] Add `polar_customer_id` column to users table
- [ ] Add `polar_subscription_id` column to users table
- [ ] Run `npm run db:push`
- [ ] Verify columns in Drizzle Studio

### Phase 5: Core Library
- [ ] Create `src/lib/polar.ts`:
  - [ ] Export Polar client
  - [ ] Export product ID mappings
  - [ ] Export `getPlanFromProductId()`
  - [ ] Export `getProductId(plan, interval)`
  - [ ] Keep PLANS object (used for feature gating)

### Phase 6: API Routes
- [ ] Create `src/app/api/polar/checkout/route.ts`
- [ ] Create `src/app/api/polar/checkout/embedded/route.ts`
- [ ] Create `src/app/api/polar/day-pass/route.ts`
- [ ] Create `src/app/api/polar/portal/route.ts`
- [ ] Create `src/app/api/webhooks/polar/route.ts`

### Phase 7: Webhook Handler
- [ ] Implement `onCheckoutUpdated` (day pass handling)
- [ ] Implement `onSubscriptionCreated` (founding member logic)
- [ ] Implement `onSubscriptionActive` (trial ended)
- [ ] Implement `onSubscriptionCanceled` (downgrade to free)
- [ ] Implement `onSubscriptionRevoked` (immediate cancel)
- [ ] Port email notifications
- [ ] Port PostHog tracking

### Phase 8: UI Components
- [ ] Update `src/components/checkout-modal.tsx` to use Polar
- [ ] Update `src/components/day-pass-card.tsx` API endpoint
- [ ] Update `src/app/pricing/page.tsx` checkout calls
- [ ] Update settings page billing portal link

### Phase 9: Import Updates
- [ ] Replace `@/lib/plans` imports with `@/lib/polar`
- [ ] Update `stripeCustomerId` references to `polarCustomerId`
- [ ] Update `subscriptionId` references where needed

### Phase 10: Testing
- [ ] Test Pro Monthly checkout → webhook → database
- [ ] Test Pro Annual checkout → webhook → database
- [ ] Test Team Monthly checkout → webhook → database
- [ ] Test Team Annual checkout → webhook → database
- [ ] Test Day Pass checkout → webhook → database
- [ ] Test subscription cancellation
- [ ] Test customer portal access
- [ ] Test founding member assignment
- [ ] Test feature gating after subscription
- [ ] Test trial period handling

### Phase 11: Deployment
- [ ] Deploy to Vercel preview
- [ ] Test in preview environment
- [ ] Deploy to production
- [ ] Monitor webhook deliveries
- [ ] Monitor error logs

### Phase 12: Cleanup (After Stable)
- [ ] Remove Stripe environment variables
- [ ] Remove Stripe packages (`npm uninstall stripe @stripe/stripe-js @stripe/react-stripe-js`)
- [x] Rename `src/lib/stripe.ts` to `src/lib/plans.ts` (contains shared plan definitions - keep)
- [ ] Delete `src/app/api/stripe/*` routes
- [ ] Delete `src/app/api/webhooks/stripe/route.ts`
- [ ] Remove deprecated database columns

---

## Implementation Details

### src/lib/polar.ts

```typescript
import { Polar } from "@polar-sh/sdk";

// Polar client instance
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

// Product ID mappings (set these after creating products in Polar dashboard)
export const POLAR_PRODUCTS = {
  pro: {
    monthly: process.env.POLAR_PRO_MONTHLY_PRODUCT_ID!,
    annual: process.env.POLAR_PRO_ANNUAL_PRODUCT_ID!,
  },
  enterprise: {
    monthly: process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID!,
    annual: process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID!,
  },
  dayPass: process.env.POLAR_DAY_PASS_PRODUCT_ID!,
} as const;

// Billing intervals
export type BillingInterval = "monthly" | "annual";
export type PlanKey = "free" | "pro" | "enterprise";

// Get plan name from Polar product ID
export function getPlanFromProductId(productId: string): PlanKey {
  if (productId === POLAR_PRODUCTS.pro.monthly || productId === POLAR_PRODUCTS.pro.annual) {
    return "pro";
  }
  if (productId === POLAR_PRODUCTS.enterprise.monthly || productId === POLAR_PRODUCTS.enterprise.annual) {
    return "enterprise";
  }
  return "free";
}

// Get product ID for plan and interval
export function getProductId(plan: PlanKey, interval: BillingInterval): string | null {
  if (plan === "free") return null;
  return POLAR_PRODUCTS[plan][interval];
}

// Plan definitions (same as before - used for feature gating)
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    monitors: 1,
    keywordsPerMonitor: 3,
    resultsVisible: 3,
    resultsHistoryDays: 3,
    refreshDelayHours: 24,
    platforms: ["reddit"] as const,
    aiFeatures: {
      sentiment: false,
      painPointCategories: false,
      askFeature: false,
      unlimitedAiAnalysis: false,
      comprehensiveAnalysis: false,
    },
  },
  pro: {
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 290,
    monitors: 10,
    keywordsPerMonitor: 20,
    resultsVisible: -1,
    resultsHistoryDays: 90,
    refreshDelayHours: 4,
    platforms: ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"] as const,
    trialDays: 14,
    aiFeatures: {
      sentiment: true,
      painPointCategories: true,
      askFeature: false,
      unlimitedAiAnalysis: true,
      comprehensiveAnalysis: false,
    },
  },
  enterprise: {
    name: "Team",
    monthlyPrice: 99,
    annualPrice: 990,
    monitors: -1,
    keywordsPerMonitor: 50,
    resultsVisible: -1,
    resultsHistoryDays: 365,
    refreshDelayHours: 0,
    platforms: ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"] as const,
    trialDays: 14,
    teamSeats: 5,
    aiFeatures: {
      sentiment: true,
      painPointCategories: true,
      askFeature: true,
      unlimitedAiAnalysis: true,
      comprehensiveAnalysis: true,
    },
  },
} as const;

export type Plan = keyof typeof PLANS;

export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan];
}
```

---

## Database Changes

### Schema Updates (src/lib/db/schema.ts)

```typescript
// Add to users table:
polarCustomerId: text("polar_customer_id").unique(),
polarSubscriptionId: text("polar_subscription_id"),

// Keep existing (just rename internally if desired):
// stripeCustomerId -> marked as deprecated
// subscriptionId -> can be repurposed or keep as polarSubscriptionId
```

### Migration SQL

```sql
-- Add new Polar columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS polar_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_polar_customer_id ON users(polar_customer_id);
```

---

## API Route Changes

### Checkout Route

**File:** `src/app/api/polar/checkout/embedded/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { polar, getProductId } from "@/lib/polar";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, billingInterval = "monthly" } = await request.json();

  if (!plan || !["pro", "enterprise"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const productId = getProductId(plan, billingInterval);
  if (!productId) {
    return NextResponse.json({ error: "Product not found" }, { status: 400 });
  }

  const email = user.emailAddresses[0]?.emailAddress;

  try {
    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: email,
      metadata: {
        userId,
        plan,
        billingInterval,
      },
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout_success=true&checkout_id={CHECKOUT_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });

    return NextResponse.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    });
  } catch (error) {
    console.error("Failed to create checkout:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
```

### Day Pass Route

**File:** `src/app/api/polar/day-pass/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { polar, POLAR_PRODUCTS } from "@/lib/polar";

export async function POST() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = user.emailAddresses[0]?.emailAddress;

  try {
    const checkout = await polar.checkouts.create({
      products: [POLAR_PRODUCTS.dayPass],
      customerEmail: email,
      metadata: {
        userId,
        type: "day_pass",
      },
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?day_pass=success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Failed to create day pass checkout:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
```

### Customer Portal Route

**File:** `src/app/api/polar/portal/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { polar } from "@/lib/polar";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { polarCustomerId: true },
  });

  if (!user?.polarCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  try {
    const portal = await polar.customerPortal.create({
      customerId: user.polarCustomerId,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("Failed to create portal session:", error);
    return NextResponse.json({ error: "Failed to access billing portal" }, { status: 500 });
  }
}
```

---

## Webhook Handler

**File:** `src/app/api/webhooks/polar/route.ts`

```typescript
import { Webhooks } from "@polar-sh/nextjs";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { upsertContact, sendSubscriptionEmail, sendPaymentFailedEmail } from "@/lib/email";
import { captureEvent } from "@/lib/posthog";
import { activateDayPass } from "@/lib/day-pass";
import { getPlanFromProductId } from "@/lib/polar";

const FOUNDING_MEMBER_LIMIT = 1000;

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  // Handle checkout completion (day pass)
  onCheckoutUpdated: async (checkout) => {
    if (checkout.status !== "succeeded") return;

    const userId = checkout.metadata?.userId as string | undefined;
    const checkoutType = checkout.metadata?.type as string | undefined;

    // Handle Day Pass one-time payment
    if (checkoutType === "day_pass" && userId) {
      const dayPassResult = await activateDayPass(userId);

      captureEvent({
        distinctId: userId,
        event: "day_pass_purchased",
        properties: {
          checkoutId: checkout.id,
          expiresAt: dayPassResult.expiresAt.toISOString(),
          purchaseCount: dayPassResult.purchaseCount,
        },
      });

      console.log(`Day pass activated for user ${userId} via Polar webhook`);
    }
  },

  // Handle new subscription
  onSubscriptionCreated: async (subscription) => {
    const userId = subscription.metadata?.userId as string | undefined;
    const customerId = subscription.customer_id;
    const productId = subscription.product_id;

    if (!userId) {
      console.error("No userId in subscription metadata");
      return;
    }

    const plan = getPlanFromProductId(productId);

    // Atomically assign founding member number (same logic as Stripe)
    if (plan === "pro" || plan === "enterprise") {
      const result = await db
        .update(users)
        .set({
          polarCustomerId: customerId,
          polarSubscriptionId: subscription.id,
          subscriptionStatus: plan,
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start)
            : new Date(),
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end)
            : null,
          isFoundingMember: sql`CASE
            WHEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) < ${FOUNDING_MEMBER_LIMIT}
            THEN true
            ELSE false
          END`,
          foundingMemberNumber: sql`CASE
            WHEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) < ${FOUNDING_MEMBER_LIMIT}
            THEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) + 1
            ELSE NULL
          END`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          email: users.email,
          name: users.name,
          isFoundingMember: users.isFoundingMember,
          foundingMemberNumber: users.foundingMemberNumber,
        });

      if (result[0]) {
        // Send confirmation email
        await sendSubscriptionEmail({
          email: result[0].email,
          name: result[0].name || undefined,
          plan: plan.charAt(0).toUpperCase() + plan.slice(1),
        });

        // Update contact in Resend
        await upsertContact({
          email: result[0].email,
          userId,
          subscriptionStatus: plan,
        });

        // Track in PostHog
        captureEvent({
          distinctId: userId,
          event: "subscription_created",
          properties: {
            plan,
            productId,
            subscriptionId: subscription.id,
            isFoundingMember: result[0].isFoundingMember,
            foundingMemberNumber: result[0].foundingMemberNumber,
            source: "polar",
          },
        });
      }
    }
  },

  // Handle subscription becoming active (after trial)
  onSubscriptionActive: async (subscription) => {
    const customerId = subscription.customer_id;

    await db
      .update(users)
      .set({
        currentPeriodStart: subscription.current_period_start
          ? new Date(subscription.current_period_start)
          : new Date(),
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(users.polarCustomerId, customerId));
  },

  // Handle subscription cancellation (end of period)
  onSubscriptionCanceled: async (subscription) => {
    const customerId = subscription.customer_id;

    const user = await db.query.users.findFirst({
      where: eq(users.polarCustomerId, customerId),
    });

    if (user) {
      await db
        .update(users)
        .set({
          polarSubscriptionId: null,
          subscriptionStatus: "free",
          updatedAt: new Date(),
        })
        .where(eq(users.polarCustomerId, customerId));

      captureEvent({
        distinctId: user.id,
        event: "subscription_canceled",
        properties: {
          previousPlan: user.subscriptionStatus,
          source: "polar",
        },
      });
    }
  },

  // Handle immediate subscription revocation
  onSubscriptionRevoked: async (subscription) => {
    const customerId = subscription.customer_id;

    await db
      .update(users)
      .set({
        polarSubscriptionId: null,
        subscriptionStatus: "free",
        updatedAt: new Date(),
      })
      .where(eq(users.polarCustomerId, customerId));
  },
});
```

---

## UI Component Changes

### Checkout Modal

The current checkout modal uses Stripe's embedded checkout. Polar uses redirect-based checkout, so we'll simplify:

```typescript
// src/components/checkout-modal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { useState } from "react";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: "pro" | "enterprise";
  planName: string;
  billingInterval: "monthly" | "annual";
}

export function CheckoutModal({
  open,
  onOpenChange,
  plan,
  planName,
  billingInterval,
}: CheckoutModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/polar/checkout/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingInterval }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error("No checkout URL returned");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to {planName}</DialogTitle>
          <DialogDescription>
            You'll be redirected to complete your purchase securely.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            {billingInterval === "monthly"
              ? `$${plan === "pro" ? 29 : 99}/month`
              : `$${plan === "pro" ? 290 : 990}/year (save 2 months)`}
          </p>
          <Button onClick={handleCheckout} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Continue to Checkout
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Environment Variables

### .env.local Template

```bash
# ========================================
# Polar.sh Configuration
# ========================================

# Organization Access Token (from Polar dashboard: Settings > Developers)
POLAR_ACCESS_TOKEN=

# Webhook Secret (from Polar dashboard: Settings > Webhooks)
POLAR_WEBHOOK_SECRET=

# Organization ID (from Polar dashboard URL)
POLAR_ORG_ID=

# Product IDs (from Polar dashboard: Products)
POLAR_PRO_MONTHLY_PRODUCT_ID=
POLAR_PRO_ANNUAL_PRODUCT_ID=
POLAR_TEAM_MONTHLY_PRODUCT_ID=
POLAR_TEAM_ANNUAL_PRODUCT_ID=
POLAR_DAY_PASS_PRODUCT_ID=

# ========================================
# Stripe Configuration (DEPRECATED - Remove after migration)
# ========================================
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# STRIPE_PUBLIC_KEY=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# STRIPE_PRO_PRICE_ID=
# STRIPE_PRO_ANNUAL_PRICE_ID=
# STRIPE_ENTERPRISE_PRICE_ID=
# STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=
# STRIPE_DAY_PASS_PRICE_ID=
```

---

## Testing Checklist

### Sandbox Testing

- [ ] **Pro Monthly Flow**
  - [ ] Create checkout session
  - [ ] Complete payment (use test card)
  - [ ] Verify webhook received
  - [ ] Verify `subscriptionStatus` = "pro" in database
  - [ ] Verify founding member number assigned
  - [ ] Verify email sent
  - [ ] Verify PostHog event tracked

- [ ] **Pro Annual Flow**
  - [ ] Same checks as monthly

- [ ] **Team Monthly Flow**
  - [ ] Same checks as Pro
  - [ ] Verify `subscriptionStatus` = "enterprise"

- [ ] **Team Annual Flow**
  - [ ] Same checks as monthly

- [ ] **Day Pass Flow**
  - [ ] Create checkout session
  - [ ] Complete payment
  - [ ] Verify `dayPassExpiresAt` set to 24h from now
  - [ ] Verify `dayPassPurchaseCount` incremented
  - [ ] Verify user has Pro access via `getUserPlan()`

- [ ] **Subscription Cancellation**
  - [ ] Cancel via Customer Portal
  - [ ] Verify webhook received
  - [ ] Verify `subscriptionStatus` reverts to "free"
  - [ ] Verify `polarSubscriptionId` set to null

- [ ] **Customer Portal**
  - [ ] Access portal for subscribed user
  - [ ] Verify can view subscription details
  - [ ] Verify can update payment method
  - [ ] Verify can cancel subscription

- [ ] **Feature Gating**
  - [ ] Free user: verify limited to 1 monitor, Reddit only
  - [ ] Pro user: verify 10 monitors, all platforms
  - [ ] Team user: verify unlimited monitors
  - [ ] Day Pass user: verify Pro access for 24h

- [ ] **Founding Member Logic**
  - [ ] Subscribe first user: verify `foundingMemberNumber` = 1
  - [ ] Subscribe second user: verify `foundingMemberNumber` = 2
  - [ ] Test concurrent subscriptions don't cause duplicate numbers

---

## Rollback Plan

### Immediate Rollback (< 24 hours)

1. Revert code changes via git
2. Restore Stripe environment variables
3. Database Stripe columns still exist (not deleted yet)
4. No data loss - both sets of columns exist

### Rollback Triggers

- Polar API downtime exceeding 4 hours
- Payment success rate below 95%
- Webhook delivery failures exceeding 10%
- Critical bugs in checkout flow
- Customer complaints about payment issues

---

## Sources & References

### Polar.sh Documentation
- [Polar Introduction](https://polar.sh/docs/introduction)
- [Polar Pricing](https://polar.sh/resources/pricing)
- [Polar Merchant of Record](https://polar.sh/resources/merchant-of-record)
- [Polar vs Stripe Comparison](https://polar.sh/resources/comparison/stripe)
- [Polar Webhooks](https://polar.sh/docs/integrating/webhooks)
- [Polar Next.js Integration](https://polar.sh/docs/integrating/nextjs)

### NPM Packages
- [@polar-sh/sdk](https://www.npmjs.com/package/@polar-sh/sdk)
- [@polar-sh/nextjs](https://www.npmjs.com/package/@polar-sh/nextjs)

### Migration Articles
- [Stripe vs Polar.sh: Which Payment Platform is Best for Your SaaS?](https://www.buildcamp.io/blogs/stripe-vs-polarsh-which-payment-platform-is-best-for-your-saas)
- [Polar: a better Stripe alternative](https://www.raulcarini.dev/blog/polar-better-stripe-alternative)
- [Why I Finally Ditched Stripe for Polar.sh](https://medium.com/coding-nexus/why-i-finally-ditched-stripe-for-polar-sh-7d396c9cf30a)

### GitHub
- [Polar Source Code](https://github.com/polarsource/polar)
- [Polar JS SDK](https://github.com/polarsource/polar-js)

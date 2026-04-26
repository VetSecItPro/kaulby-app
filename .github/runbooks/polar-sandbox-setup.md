# Polar Sandbox Setup

This runbook walks through creating a Polar sandbox environment so the seat-addon
lifecycle (purchase, cancel, revoke-at-period-end) can be tested end-to-end without
real money. **One-time setup, ~30 minutes.**

## Why sandbox

Polar runs two completely separate backends:
- `https://api.polar.sh` (production - real money, real customers)
- `https://sandbox-api.polar.sh` (sandbox - test cards, no real money)

The two have **separate accounts, separate access tokens, separate orgs, separate
products, separate webhooks**. A production access token cannot be used to call
sandbox endpoints (and vice versa).

The Kaulby SDK reads `POLAR_ENV` to pick which backend to call. Setting
`POLAR_ENV=sandbox` plus sandbox values for the other Polar env vars routes
all checkouts and webhooks through the sandbox - no production data touched.

## Step 1: Create a sandbox account

1. Visit https://sandbox.polar.sh (note the `sandbox.` subdomain - distinct from polar.sh).
2. Sign up with the same email used for the production VetSecItPro account
   (Polar treats sandbox as a separate account but using the same email keeps
   things tidy).
3. Create a sandbox organization. Suggested slug: `vetsecitpro-sandbox`.

## Step 2: Create the 7 sandbox products

Mirror the production catalog. For each product, set price + billing interval,
and copy the product ID afterward (you'll paste them into env vars in Step 4).

| Product name           | Price          | Recurrence | Notes                                 |
|------------------------|----------------|------------|---------------------------------------|
| Solo Monthly           | $39/mo         | monthly    | Solo tier, monthly billing            |
| Solo Annual            | $390/yr        | yearly     | Solo tier, annual billing             |
| Scale Monthly          | $79/mo         | monthly    | Scale tier, monthly billing           |
| Scale Annual           | $790/yr        | yearly     | Scale tier, annual billing            |
| Growth Monthly         | $149/mo        | monthly    | Growth tier, monthly billing          |
| Growth Annual          | $1490/yr       | yearly     | Growth tier, annual billing           |
| Growth Seat Monthly    | $20/mo         | monthly    | Per-seat add-on, monthly              |
| Growth Seat Annual     | $200/yr        | yearly     | Per-seat add-on, annual               |
| Day Pass               | $15            | one-time   | One-time 24h Scale-level access       |

Note: Polar's sandbox lets you skip Stripe Connect setup; products work
without a connected payout method.

## Step 3: Generate a sandbox access token

1. In sandbox dashboard, go to Settings -> Personal Access Tokens
2. Create a token with the scopes: `checkouts:write`, `subscriptions:read`,
   `subscriptions:write`, `customer_sessions:write`, `customers:read`,
   `webhooks:write`
3. Copy the token (shown once). This is your `POLAR_ACCESS_TOKEN` for sandbox.

## Step 4: Configure webhook endpoint

Polar will POST events (checkout.created, subscription.canceled, subscription.revoked,
etc.) to whatever URL you point it at. For sandbox testing you have two options:

### Option A - Vercel preview deploy (recommended)

1. Push any branch to GitHub - Vercel auto-creates a preview URL
   like `https://kaulby-<hash>-vetsecitpro.vercel.app`
2. In Vercel project settings, set **Preview environment variables** to use
   the sandbox values from this runbook (POLAR_ENV=sandbox, sandbox token,
   sandbox product IDs, sandbox webhook secret)
3. In sandbox.polar.sh, add a webhook endpoint:
   `https://kaulby-<hash>-vetsecitpro.vercel.app/api/webhooks/polar`
4. Subscribe to events: `checkout.created`, `subscription.created`,
   `subscription.updated`, `subscription.canceled`, `subscription.revoked`,
   `subscription.active`, `order.refunded`
5. Polar shows a webhook secret on creation. This is your `POLAR_WEBHOOK_SECRET`
   for sandbox.

### Option B - Local with ngrok

1. Run `pnpm dev` (or whatever local dev command)
2. In another terminal: `ngrok http 8888` (or whatever port)
3. Copy the ngrok HTTPS URL: `https://<random>.ngrok.io`
4. Add webhook in sandbox.polar.sh pointing at
   `https://<random>.ngrok.io/api/webhooks/polar`
5. Same event subscriptions as Option A

## Step 5: Provide me the sandbox env vars

Once Steps 1-4 are done, paste these values back to me (or set them directly
on Vercel preview env if you prefer):

```bash
POLAR_ENV=sandbox
POLAR_ACCESS_TOKEN=<sandbox-token-from-step-3>
POLAR_WEBHOOK_SECRET=<sandbox-webhook-secret-from-step-4>
POLAR_ORG_ID=<sandbox-org-id-from-dashboard>

# Product IDs from Step 2 (sandbox versions of each)
POLAR_SOLO_MONTHLY_PRODUCT_ID=
POLAR_SOLO_ANNUAL_PRODUCT_ID=
POLAR_SCALE_MONTHLY_PRODUCT_ID=
POLAR_SCALE_ANNUAL_PRODUCT_ID=
POLAR_GROWTH_MONTHLY_PRODUCT_ID=
POLAR_GROWTH_ANNUAL_PRODUCT_ID=
POLAR_GROWTH_SEAT_MONTHLY_PRODUCT_ID=
POLAR_GROWTH_SEAT_ANNUAL_PRODUCT_ID=
POLAR_DAY_PASS_PRODUCT_ID=
```

## Step 6: Run the end-to-end test

I'll run this against the sandbox once env vars are configured:

1. Sign up a test user
2. Subscribe to Growth tier (test card `4242 4242 4242 4242`)
3. Verify `users.subscriptionStatus` becomes `growth` and `workspaces.seatLimit` is 3
4. Buy 2 extra seats
5. Verify `seatLimit` becomes 5 (3 baseline + 2 paid)
6. Click "Remove one extra seat" in team settings
7. Verify response says "scheduled for removal at period end"
8. Manually fire `subscription.revoked` event for the seat-addon (Polar dashboard
   has a "Send test event" feature, or wait for the actual period to end)
9. Verify `seatLimit` decremented to 4
10. Repeat for the second seat addon - verify floor at 3 (cannot drop below baseline)

## Test card numbers (sandbox)

Polar uses Stripe under the hood, so standard Stripe test cards work:
- `4242 4242 4242 4242` - succeeds
- `4000 0000 0000 9995` - declines (insufficient funds)
- `4000 0000 0000 0002` - declines (generic)

Any future expiry, any CVC, any ZIP.

## Cleanup (when sandbox testing is done)

Sandbox accounts persist forever and don't cost anything. Leave it set up so
future billing changes can be sandbox-tested first.

If you ever want to clean test data, sandbox.polar.sh has a "Reset organization"
button under Settings that deletes all subscriptions/customers/orders without
touching products or webhooks.

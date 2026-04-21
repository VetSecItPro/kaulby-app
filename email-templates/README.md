# Kaulby Email Templates

Professional, branded email templates embedded directly in the codebase using Resend.

## Setup

### 1. Get Resend API Key

1. Go to [Resend](https://resend.com) and create an account
2. Navigate to **API Keys** and create a new key
3. Add to your `.env.local`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 2. Verify Your Domain (Production)

For production, verify your domain in Resend:
1. Go to **Domains** in the Resend dashboard
2. Add `kaulbyapp.com`
3. Add the DNS records they provide
4. Once verified, emails will be sent from `alerts@kaulbyapp.com`

## Email Functions

All email functions are in `src/lib/email.ts`:

| Function | Purpose | When Sent |
|----------|---------|-----------|
| `sendWelcomeEmail` | Welcome new users | User signup (Clerk webhook) |
| `sendAlertEmail` | Instant alert notification | New results match monitor criteria |
| `sendDigestEmail` | Daily/weekly summary | Scheduled (9 AM UTC) |
| `sendSubscriptionEmail` | Plan upgrade confirmation | Stripe checkout success |
| `sendPaymentFailedEmail` | Payment failure notice | Stripe payment failed |

## Usage Example

```typescript
import { sendWelcomeEmail } from "@/lib/email";

await sendWelcomeEmail({
  email: "user@example.com",
  name: "John"
});
```

## Template Customization

Templates are embedded as HTML functions in `src/lib/email.ts`:
- `getWelcomeEmailHtml()`
- `getAlertEmailHtml()`
- `getDigestEmailHtml()`
- `getSubscriptionEmailHtml()`
- `getPaymentFailedEmailHtml()`

### Colors Used
- Primary (black): `#18181b`
- Muted text: `#71717a`
- Body text: `#3f3f46`
- Background: `#f4f4f5`
- Card background: `#ffffff`
- Success green: `#166534` / `#dcfce7`
- Error red: `#dc2626` / `#fef2f2`
- AI purple gradient: `#f0f9ff` → `#faf5ff`

## Preview

The standalone HTML templates in this directory can be opened directly in a browser to preview the designs.

## Testing

Send a test email in development:

```typescript
// In a server action or API route
import { sendWelcomeEmail } from "@/lib/email";

await sendWelcomeEmail({
  email: "your-email@example.com",
  name: "Test User"
});
```

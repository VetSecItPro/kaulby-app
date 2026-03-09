import { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400; // ISR: revalidate every 24 hours

export const metadata: Metadata = {
  title: "Zapier, Make.com & n8n Integrations | Kaulby",
  description:
    "Connect Kaulby to 5,000+ apps via Zapier, Make.com, or n8n. Send monitoring results, crisis alerts, and digest summaries to any automation platform using webhooks.",
  openGraph: {
    title: "Zapier, Make.com & n8n Integrations | Kaulby",
    description:
      "Connect Kaulby to 5,000+ apps via Zapier, Make.com, or n8n using webhooks.",
    url: "https://kaulbyapp.com/docs/integrations",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/docs/integrations",
  },
};

/* ------------------------------------------------------------------ */
/* Reusable components scoped to this page                             */
/* ------------------------------------------------------------------ */

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-4 rounded-md overflow-x-auto">
      <pre>{children}</pre>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="text-2xl font-semibold mb-4 scroll-mt-20">
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function IntegrationsDocsPage() {
  return (
    <div className="container max-w-5xl py-16">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Webhook Integrations
        </h1>
        <p className="text-lg text-muted-foreground">
          Connect Kaulby to 5,000+ apps via Zapier, Make.com, or n8n.
          Kaulby sends real-time webhook events whenever new mentions are
          found, AI analysis completes, a crisis is detected, or a digest
          summary is ready.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-sm">
          <span className="font-medium">Team Plan Required</span>
          <span className="text-amber-500">-</span>
          <span>Webhook integrations are available on Team plans</span>
        </div>
      </div>

      {/* Table of contents */}
      <nav className="mb-12 rounded-lg border p-4">
        <h3 className="font-medium mb-3">On this page</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
          </li>
          <li>
            <a href="#events" className="hover:text-foreground">
              Supported events
            </a>
          </li>
          <li>
            <a href="#payload" className="hover:text-foreground">
              Webhook payload format
            </a>
          </li>
          <li>
            <a href="#zapier" className="hover:text-foreground">
              Setup: Zapier
            </a>
          </li>
          <li>
            <a href="#make" className="hover:text-foreground">
              Setup: Make.com
            </a>
          </li>
          <li>
            <a href="#n8n" className="hover:text-foreground">
              Setup: n8n
            </a>
          </li>
          <li>
            <a href="#security" className="hover:text-foreground">
              Security &amp; verification
            </a>
          </li>
          <li>
            <a href="#examples" className="hover:text-foreground">
              Example automations
            </a>
          </li>
        </ul>
      </nav>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="how-it-works">How it works</SectionHeading>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-muted-foreground">
          <p>
            Kaulby monitors 17 platforms for your keywords around the clock.
            When something happens, Kaulby sends an HTTP POST request (a
            &quot;webhook&quot;) to a URL you provide. Your automation platform
            receives the JSON payload and triggers whatever workflow you have
            configured &mdash; no polling required.
          </p>
          <div className="font-mono text-sm bg-zinc-900 text-zinc-100 p-3 rounded-md">
            Kaulby &rarr; POST https://your-webhook-url &rarr; Zapier / Make / n8n &rarr; 5,000+ apps
          </div>
          <p>
            You can register multiple webhook endpoints, each subscribing to
            different event types. Kaulby retries failed deliveries with
            exponential backoff (up to 5 attempts over 4 hours).
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Supported events                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="events">Supported events</SectionHeading>
        <div className="rounded-lg border p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Event</th>
                <th className="text-left py-2 font-medium">Description</th>
                <th className="text-left py-2 font-medium">When it fires</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">mention.new</td>
                <td className="py-2">
                  A new mention was found on a monitored platform
                </td>
                <td className="py-2">
                  Immediately after a platform scan finds new results
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">mention.analyzed</td>
                <td className="py-2">
                  AI analysis (sentiment, category, summary) is complete
                </td>
                <td className="py-2">
                  After the AI pipeline finishes processing a mention
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">crisis.detected</td>
                <td className="py-2">
                  A spike in negative sentiment or volume was detected
                </td>
                <td className="py-2">
                  When crisis detection thresholds are breached
                </td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">digest.ready</td>
                <td className="py-2">
                  A daily, weekly, or monthly digest summary is ready
                </td>
                <td className="py-2">
                  On the configured digest schedule
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground mt-3">
            Subscribe to all events with{" "}
            <span className="font-mono bg-muted px-1 rounded">*</span>, or
            pick specific ones when creating a webhook in{" "}
            <span className="font-mono bg-muted px-1 rounded">
              Settings &rarr; Webhooks
            </span>
            .
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Payload format                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="payload">Webhook payload format</SectionHeading>
        <p className="text-muted-foreground mb-4">
          Every webhook delivery is an HTTP POST with a JSON body. The
          top-level structure is always the same:
        </p>
        <CodeBlock>
          {`{
  "event": "mention.new",
  "timestamp": "2026-03-08T14:30:00.000Z",
  "data": {
    "mentionId": "a1b2c3d4-...",
    "monitorId": "e5f6g7h8-...",
    "monitorName": "Brand Mentions",
    "platform": "reddit",
    "title": "Has anyone tried Acme for monitoring?",
    "content": "I've been looking for a community monitoring tool...",
    "sourceUrl": "https://reddit.com/r/SaaS/comments/...",
    "author": "techfounder42",
    "postedAt": "2026-03-08T13:15:00.000Z",
    "sentiment": "positive",
    "sentimentScore": 0.87,
    "painPointCategory": "solution_request",
    "conversationCategory": "advice_request",
    "aiSummary": "User is evaluating community monitoring tools and asking for recommendations.",
    "engagement": 24,
    "commentCount": 8
  }
}`}
        </CodeBlock>

        <div className="mt-6">
          <h3 className="font-medium mb-2">HTTP headers</h3>
          <div className="rounded-lg border p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Header</th>
                  <th className="text-left py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 font-mono text-xs">Content-Type</td>
                  <td className="py-2">
                    Always <code>application/json</code>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono text-xs">
                    X-Webhook-Event
                  </td>
                  <td className="py-2">
                    The event type (e.g.{" "}
                    <code>mention.new</code>)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono text-xs">
                    X-Webhook-Delivery-Id
                  </td>
                  <td className="py-2">
                    Unique delivery ID for deduplication
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-mono text-xs">
                    X-Webhook-Signature
                  </td>
                  <td className="py-2">
                    HMAC-SHA256 signature (if a secret is configured)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Zapier setup                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="zapier">Setup: Zapier</SectionHeading>
        <p className="text-muted-foreground mb-4">
          Use the &quot;Webhooks by Zapier&quot; trigger to receive Kaulby
          events. No custom Zapier app needed.
        </p>
        <div className="rounded-lg border bg-muted/30 p-4">
          <StepList
            steps={[
              "In Zapier, create a new Zap and choose \"Webhooks by Zapier\" as the trigger.",
              "Select \"Catch Hook\" as the trigger event.",
              "Zapier gives you a unique webhook URL (e.g. https://hooks.zapier.com/hooks/catch/...).",
              "Copy that URL.",
              "In Kaulby, go to Settings \u2192 Webhooks and click \"Add Webhook\".",
              "Paste the Zapier URL, give it a name (e.g. \"Zapier - New Mentions\"), and select the events you want to receive.",
              "Click \"Test\" to send a sample payload to Zapier.",
              "Back in Zapier, click \"Test trigger\" \u2014 you should see the test payload with all fields.",
              "Add your action steps (Google Sheets, Slack, email, CRM, etc.) and publish the Zap.",
            ]}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Make.com setup                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="make">Setup: Make.com</SectionHeading>
        <p className="text-muted-foreground mb-4">
          Use a Custom Webhook module as the trigger in your Make.com
          scenario.
        </p>
        <div className="rounded-lg border bg-muted/30 p-4">
          <StepList
            steps={[
              "Create a new scenario in Make.com.",
              "Add a \"Custom webhook\" module as the trigger.",
              "Click \"Add\" to create a new webhook and copy the generated URL.",
              "In Kaulby, go to Settings \u2192 Webhooks and click \"Add Webhook\".",
              "Paste the Make.com webhook URL and select your desired events.",
              "Click \"Test\" to send a sample payload.",
              "Back in Make.com, click \"Re-determine data structure\" \u2014 Make will auto-detect all fields from the test payload.",
              "Add your action modules (Google Sheets, Airtable, Slack, HubSpot, etc.) and activate the scenario.",
            ]}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* n8n setup                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="n8n">Setup: n8n</SectionHeading>
        <p className="text-muted-foreground mb-4">
          Use the Webhook node as the trigger in your n8n workflow.
        </p>
        <div className="rounded-lg border bg-muted/30 p-4">
          <StepList
            steps={[
              "Create a new workflow in n8n.",
              "Add a \"Webhook\" node as the trigger.",
              "Set the HTTP method to POST and note the generated webhook URL (production or test URL).",
              "In Kaulby, go to Settings \u2192 Webhooks and add a new webhook with the n8n URL.",
              "Select your desired events and click \"Test\" to send a sample payload.",
              "Back in n8n, you\u2019ll see the test payload. Use it to configure downstream nodes.",
              "Add action nodes (spreadsheet, HTTP request, IF conditions, etc.) and activate the workflow.",
            ]}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Security                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="security">
          Security &amp; verification
        </SectionHeading>
        <p className="text-muted-foreground mb-4">
          When you add a secret to your webhook, Kaulby signs every
          delivery with an HMAC-SHA256 signature so you can verify it came
          from us.
        </p>
        <CodeBlock>
          {`// Verify the signature in your endpoint (Node.js example)
const crypto = require("crypto");

function verifySignature(payload, signature, secret) {
  const expected = "sha256=" +
    crypto.createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your handler:
const sig = req.headers["x-webhook-signature"];
const isValid = verifySignature(req.rawBody, sig, YOUR_SECRET);`}
        </CodeBlock>
        <p className="text-sm text-muted-foreground mt-3">
          The signature is sent in the{" "}
          <span className="font-mono bg-muted px-1 rounded">
            X-Webhook-Signature
          </span>{" "}
          header. If you are using Zapier or Make.com, you can skip
          verification &mdash; those platforms use unique, unguessable
          URLs.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Example automations                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12">
        <SectionHeading id="examples">Example automations</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">
              Send mentions to Google Sheets
            </h3>
            <p className="text-sm text-muted-foreground">
              Subscribe to <code>mention.analyzed</code>. In Zapier or
              Make.com, map the mention fields to spreadsheet columns for a
              live database of every community mention.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">
              Post to Slack when crisis detected
            </h3>
            <p className="text-sm text-muted-foreground">
              Subscribe to <code>crisis.detected</code>. Route the webhook
              to a Slack channel with a formatted message including severity,
              mention count, and top negative mentions.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">
              Create HubSpot deal from high-intent lead
            </h3>
            <p className="text-sm text-muted-foreground">
              Subscribe to <code>mention.analyzed</code>. Add a filter for{" "}
              <code>conversationCategory == &quot;solution_request&quot;</code>{" "}
              and <code>sentiment == &quot;positive&quot;</code>, then create
              a HubSpot deal with the mention details.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">
              Weekly digest to email or Notion
            </h3>
            <p className="text-sm text-muted-foreground">
              Subscribe to <code>digest.ready</code>. Forward the summary,
              sentiment breakdown, and top mentions to an email or append to
              a Notion database.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Related links                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Related</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>
            <Link
              href="/docs/api"
              className="text-primary hover:underline"
            >
              REST API Documentation
            </Link>{" "}
            &mdash; programmatic access to monitors and results
          </li>
          <li>
            <a
              href="mailto:support@kaulbyapp.com"
              className="text-primary hover:underline"
            >
              support@kaulbyapp.com
            </a>{" "}
            &mdash; need help with your integration?
          </li>
        </ul>
      </section>
    </div>
  );
}

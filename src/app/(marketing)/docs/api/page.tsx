import { Metadata } from "next";

export const revalidate = 86400; // Revalidate every day

export const metadata: Metadata = {
  title: "API Documentation | Kaulby",
  description: "Programmatic access to your Kaulby monitors and results. Build integrations, automate workflows, and analyze data with our REST API.",
};

export default function ApiDocsPage() {
  return (
    <div className="container max-w-5xl py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">API Documentation</h1>
        <p className="text-lg text-muted-foreground">
          Access your Kaulby data programmatically. Build integrations, automate workflows, and analyze your community mentions.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-sm">
          <span className="font-medium">Team Plan Required</span>
          <span className="text-amber-500">-</span>
          <span>API access is available on Team plans</span>
        </div>
      </div>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground mb-3">
              1. Go to <span className="font-mono bg-muted px-1 rounded">Settings → API Keys</span> to generate your API key
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              2. Include your API key in every request using one of these headers:
            </p>
            <div className="font-mono text-sm bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
              <pre>{`Authorization: Bearer kaulby_live_xxxxxxxxxxxx
# or
X-API-Key: kaulby_live_xxxxxxxxxxxx`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Base URL */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Base URL</h2>
        <div className="font-mono text-sm bg-zinc-900 text-zinc-100 p-3 rounded-md">
          https://kaulbyapp.com/api/v1
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Rate Limits</h2>
        <div className="rounded-lg border p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Plan</th>
                <th className="text-left py-2 font-medium">Daily Limit</th>
                <th className="text-left py-2 font-medium">Reset</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2">Team</td>
                <td className="py-2">10,000 requests/day</td>
                <td className="py-2">Midnight UTC</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground mt-3">
            When you exceed the rate limit, you&apos;ll receive a <span className="font-mono bg-muted px-1 rounded">429 Too Many Requests</span> response.
          </p>
        </div>
      </section>

      {/* Authentication */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
        <p className="text-muted-foreground mb-4">
          All API requests require authentication using an API key. You can generate API keys from your dashboard settings.
        </p>
        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <h3 className="font-medium mb-2">API Key Format</h3>
            <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
              kaulby_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Request Headers</h3>
            <div className="font-mono text-sm bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
              <pre>{`curl https://kaulbyapp.com/api/v1/monitors \\
  -H "Authorization: Bearer kaulby_live_your_api_key"`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Endpoints</h2>

        {/* GET /monitors */}
        <div className="rounded-lg border mb-6">
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
            <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium rounded">GET</span>
            <span className="font-mono text-sm">/monitors</span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-muted-foreground">List all monitors for your account.</p>

            <div>
              <h4 className="font-medium mb-2">Query Parameters</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Parameter</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">limit</td>
                    <td className="py-2">integer</td>
                    <td className="py-2">Max results to return (default: 50, max: 100)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">offset</td>
                    <td className="py-2">integer</td>
                    <td className="py-2">Number of results to skip (default: 0)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs">active</td>
                    <td className="py-2">boolean</td>
                    <td className="py-2">Filter by active status</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-medium mb-2">Response</h4>
              <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
                <pre>{`{
  "monitors": [
    {
      "id": "uuid",
      "name": "Brand Mentions",
      "keywords": ["acme", "acme corp"],
      "platforms": ["reddit", "hackernews"],
      "isActive": true,
      "lastCheckedAt": "2025-01-24T12:00:00Z",
      "newMatchCount": 5,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-24T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* POST /monitors */}
        <div className="rounded-lg border mb-6">
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
            <span className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium rounded">POST</span>
            <span className="font-mono text-sm">/monitors</span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-muted-foreground">Create a new monitor.</p>

            <div>
              <h4 className="font-medium mb-2">Request Body</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Field</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Required</th>
                    <th className="text-left py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">name</td>
                    <td className="py-2">string</td>
                    <td className="py-2">Yes</td>
                    <td className="py-2">Display name for the monitor</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">keywords</td>
                    <td className="py-2">string[]</td>
                    <td className="py-2">Yes</td>
                    <td className="py-2">Keywords to track</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs">platforms</td>
                    <td className="py-2">string[]</td>
                    <td className="py-2">Yes</td>
                    <td className="py-2">Platforms to monitor</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-medium mb-2">Available Platforms</h4>
              <div className="flex flex-wrap gap-2">
                {["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazonreviews", "indiehackers", "github", "hashnode"].map((p) => (
                  <span key={p} className="px-2 py-1 bg-muted text-xs font-mono rounded">{p}</span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Example Request</h4>
              <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
                <pre>{`curl -X POST https://kaulbyapp.com/api/v1/monitors \\
  -H "Authorization: Bearer kaulby_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Competitor Tracking",
    "keywords": ["competitor", "vs acme"],
    "platforms": ["reddit", "hackernews", "producthunt"]
  }'`}</pre>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Response (201 Created)</h4>
              <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
                <pre>{`{
  "monitor": {
    "id": "uuid",
    "name": "Competitor Tracking",
    "keywords": ["competitor", "vs acme"],
    "platforms": ["reddit", "hackernews", "producthunt"],
    "isActive": true,
    "createdAt": "2025-01-24T12:00:00Z"
  }
}`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* GET /results */}
        <div className="rounded-lg border mb-6">
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
            <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium rounded">GET</span>
            <span className="font-mono text-sm">/results</span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-muted-foreground">Fetch results from your monitors with filtering and pagination.</p>

            <div>
              <h4 className="font-medium mb-2">Query Parameters</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Parameter</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">limit</td>
                    <td className="py-2">integer</td>
                    <td className="py-2">Max results to return (default: 50, max: 100)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">offset</td>
                    <td className="py-2">integer</td>
                    <td className="py-2">Number of results to skip (default: 0)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">monitor_id</td>
                    <td className="py-2">string</td>
                    <td className="py-2">Filter by specific monitor</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">platform</td>
                    <td className="py-2">string</td>
                    <td className="py-2">Filter by platform</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">sentiment</td>
                    <td className="py-2">string</td>
                    <td className="py-2">Filter by sentiment (positive, negative, neutral)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-mono text-xs">from</td>
                    <td className="py-2">ISO date</td>
                    <td className="py-2">Filter results from this date</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs">to</td>
                    <td className="py-2">ISO date</td>
                    <td className="py-2">Filter results until this date</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-medium mb-2">Example Request</h4>
              <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
                <pre>{`curl "https://kaulbyapp.com/api/v1/results?sentiment=negative&limit=20" \\
  -H "Authorization: Bearer kaulby_live_your_api_key"`}</pre>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Response</h4>
              <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
                <pre>{`{
  "results": [
    {
      "id": "uuid",
      "monitorId": "uuid",
      "platform": "reddit",
      "sourceUrl": "https://reddit.com/r/startup/...",
      "title": "Post Title",
      "content": "Post content...",
      "author": "username",
      "postedAt": "2025-01-24T10:00:00Z",
      "sentiment": "negative",
      "sentimentScore": 0.85,
      "painPointCategory": "pricing_concern",
      "conversationCategory": "pain_point",
      "aiSummary": "User expressing frustration about...",
      "createdAt": "2025-01-24T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* GET /usage */}
        <div className="rounded-lg border mb-6">
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
            <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium rounded">GET</span>
            <span className="font-mono text-sm">/usage</span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-muted-foreground">Get usage statistics and plan limits for your account.</p>

            <div>
              <h4 className="font-medium mb-2">Response</h4>
              <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
                <pre>{`{
  "usage": {
    "monitors": {
      "count": 5,
      "limit": 30
    },
    "results": {
      "countThisMonth": 1250
    },
    "aiCalls": {
      "countThisMonth": 450
    }
  },
  "plan": {
    "name": "enterprise",
    "limits": {
      "monitors": 30,
      "keywords": 35,
      "resultsVisible": -1,
      "refreshHours": 2
    },
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-02-01T00:00:00Z"
  }
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error Responses */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Error Responses</h2>
        <div className="rounded-lg border p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Status Code</th>
                <th className="text-left py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="py-2 font-mono">400</td>
                <td className="py-2">Bad Request - Invalid parameters or request body</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono">401</td>
                <td className="py-2">Unauthorized - Invalid or missing API key</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono">403</td>
                <td className="py-2">Forbidden - API access not available on your plan</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono">404</td>
                <td className="py-2">Not Found - Resource not found</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono">429</td>
                <td className="py-2">Too Many Requests - Rate limit exceeded</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">500</td>
                <td className="py-2">Internal Server Error</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <h4 className="font-medium mb-2">Error Response Format</h4>
            <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
              <pre>{`{
  "error": "Error message describing what went wrong"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* SDK & Libraries */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">SDKs & Libraries</h2>
        <p className="text-muted-foreground mb-4">
          Official SDKs are coming soon. In the meantime, you can use any HTTP client to interact with the API.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">JavaScript / TypeScript</h3>
            <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
              <pre>{`const response = await fetch(
  "https://kaulbyapp.com/api/v1/monitors",
  {
    headers: {
      "Authorization": "Bearer " + API_KEY
    }
  }
);
const data = await response.json();`}</pre>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-2">Python</h3>
            <div className="font-mono text-xs bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto">
              <pre>{`import requests

response = requests.get(
    "https://kaulbyapp.com/api/v1/monitors",
    headers={"Authorization": f"Bearer {API_KEY}"}
)
data = response.json()`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Support */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Need Help?</h2>
        <p className="text-muted-foreground">
          If you have questions about the API or need help with your integration, reach out to us at{" "}
          <a href="mailto:support@kaulby.com" className="text-primary hover:underline">
            support@kaulby.com
          </a>
        </p>
      </section>
    </div>
  );
}

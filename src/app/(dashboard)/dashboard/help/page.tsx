import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Bell,
  Brain,
  CreditCard,
  Zap,
  Mail,
  MessageSquare,
  Globe,
  Key,
  Users,
  BarChart3,
  Webhook,
  Download,
  Settings,
  Shield,
  HelpCircle,
  Lightbulb,
  FolderOpen,
} from "lucide-react";

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground mt-1">
          Everything you need to know about using Kaulby effectively.
        </p>
      </div>

      {/* Table of Contents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Quick Navigation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <a href="#quick-start" className="text-primary hover:underline">→ Quick Start Guide</a>
            <a href="#monitors" className="text-primary hover:underline">→ Creating Monitors</a>
            <a href="#audiences" className="text-primary hover:underline">→ Audiences</a>
            <a href="#platforms" className="text-primary hover:underline">→ Supported Platforms</a>
            <a href="#ai-analysis" className="text-primary hover:underline">→ AI Analysis</a>
            <a href="#analytics" className="text-primary hover:underline">→ Analytics & Insights</a>
            <a href="#alerts" className="text-primary hover:underline">→ Alerts & Notifications</a>
            <a href="#slack-discord" className="text-primary hover:underline">→ Slack & Discord Setup</a>
            <a href="#webhooks" className="text-primary hover:underline">→ Webhooks</a>
            <a href="#api-access" className="text-primary hover:underline">→ API Access</a>
            <a href="#data-export" className="text-primary hover:underline">→ Data Export</a>
            <a href="#team" className="text-primary hover:underline">→ Team Management</a>
            <a href="#account" className="text-primary hover:underline">→ Account Settings</a>
            <a href="#plans" className="text-primary hover:underline">→ Plan Comparison</a>
            <a href="#troubleshooting" className="text-primary hover:underline">→ Troubleshooting</a>
            <a href="#faq" className="text-primary hover:underline">→ FAQ</a>
            <a href="#contact" className="text-primary hover:underline">→ Contact Support</a>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card id="quick-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>
            Get up and running in under 2 minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <h3 className="font-medium mb-1">Create a Monitor</h3>
              <p className="text-sm text-muted-foreground">
                Click &quot;New Monitor&quot; and add keywords you want to track. Select which platforms to monitor.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <h3 className="font-medium mb-1">Review Results</h3>
              <p className="text-sm text-muted-foreground">
                See matching conversations with AI-powered sentiment analysis, categorization, and summaries.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-primary">3</span>
              </div>
              <h3 className="font-medium mb-1">Set Up Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Get notified via email, Slack, or Discord when new mentions appear. Never miss important conversations.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm">
              <strong>Pro tip:</strong> Start with 2-3 specific keywords to see how Kaulby works, then expand your monitoring as you learn what generates the most valuable insights.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Creating Monitors */}
      <Card id="monitors">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Creating Monitors
          </CardTitle>
          <CardDescription>Track conversations that matter to your business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Monitors are the core of Kaulby. Each monitor tracks specific keywords or phrases across your chosen platforms.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">What to Monitor</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li><strong>Your brand name:</strong> &quot;YourCompany&quot; or &quot;your-product&quot;</li>
              <li><strong>Competitor names:</strong> Track what people say about alternatives</li>
              <li><strong>Industry keywords:</strong> &quot;best CRM for startups&quot;, &quot;project management tool&quot;</li>
              <li><strong>Pain points:</strong> &quot;frustrated with&quot;, &quot;looking for alternative&quot;</li>
              <li><strong>Feature requests:</strong> Track what users want in your space</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Keyword Tips</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Use quotes for exact phrases: <code className="px-1 py-0.5 bg-muted rounded text-xs">&quot;your brand name&quot;</code></li>
              <li>Be specific to reduce noise—&quot;Notion alternative&quot; vs just &quot;alternative&quot;</li>
              <li>Include common misspellings of your brand</li>
              <li>Monitor competitor names to find potential customers</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>Limits by plan:</strong> Free: 3 keywords/monitor · Pro: 20 keywords/monitor · Team: 35 keywords/monitor
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Audiences */}
      <Card id="audiences">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Audiences
          </CardTitle>
          <CardDescription>Organize monitors into logical groups</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Audiences help you organize multiple monitors into meaningful groups. This is useful when tracking different aspects of your business.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">Use Cases</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li><strong>By product:</strong> Group monitors for each product line</li>
              <li><strong>By competitor:</strong> Track each competitor separately</li>
              <li><strong>By market:</strong> Different audiences for different regions or segments</li>
              <li><strong>By team:</strong> Marketing monitors vs. Product monitors</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">How to Create an Audience</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Go to <strong>Audiences</strong> in the sidebar</li>
              <li>Click <strong>Create Audience</strong></li>
              <li>Give it a name and optional description</li>
              <li>Add existing monitors or create new ones within the audience</li>
            </ol>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>Tip:</strong> Audiences make it easier to share specific monitoring data with different teams or stakeholders.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Platforms */}
      <Card id="platforms">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Supported Platforms
          </CardTitle>
          <CardDescription>Where we find conversations about your brand</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">We monitor 9 platforms where your audience discusses products and services:</p>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Reddit</Badge>
              <p className="text-xs text-muted-foreground">Discussions across thousands of communities and subreddits</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Hacker News</Badge>
              <p className="text-xs text-muted-foreground">Tech-focused discussions from the startup community</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Product Hunt</Badge>
              <p className="text-xs text-muted-foreground">Product launches and tech tool discussions</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Google Reviews</Badge>
              <p className="text-xs text-muted-foreground">Business reviews and customer feedback</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Trustpilot</Badge>
              <p className="text-xs text-muted-foreground">Consumer reviews and brand reputation</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">App Store</Badge>
              <p className="text-xs text-muted-foreground">iOS app reviews and ratings</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Play Store</Badge>
              <p className="text-xs text-muted-foreground">Android app reviews and ratings</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Quora</Badge>
              <p className="text-xs text-muted-foreground">Q&A discussions and recommendations</p>
            </div>
            <div className="p-3 rounded-lg border">
              <Badge variant="outline" className="mb-2">Dev.to</Badge>
              <p className="text-xs text-muted-foreground">Developer community posts and discussions</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>Platform availability:</strong> Free users have Reddit access. Pro and Team users can monitor all 9 platforms.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis */}
      <Card id="ai-analysis">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Analysis
          </CardTitle>
          <CardDescription>Understand conversations at scale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Our AI automatically analyzes every result to help you quickly understand the conversation and take action.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">What AI Provides</h4>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              <li>
                <strong>Sentiment Analysis:</strong> Positive, negative, or neutral tone with confidence score
              </li>
              <li>
                <strong>Conversation Categories:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Pain Point – User expressing frustration</li>
                  <li>Solution Request – Looking for recommendations</li>
                  <li>Feature Request – Wanting specific functionality</li>
                  <li>Competitor Mention – Discussing alternatives</li>
                  <li>Positive Feedback – Praise or recommendation</li>
                </ul>
              </li>
              <li>
                <strong>Summary:</strong> Key points extracted from longer discussions
              </li>
              <li>
                <strong>Engagement Score:</strong> How active/popular the conversation is
              </li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>AI access:</strong> Free users see AI analysis on the first result only (others are blurred). Pro and Team users get unlimited AI analysis.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Analytics & Insights */}
      <Card id="analytics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics & Insights
          </CardTitle>
          <CardDescription>Track trends and measure impact</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The Analytics dashboard helps you understand trends over time and measure the impact of your monitoring efforts.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">Analytics Features</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li><strong>Mention Volume:</strong> Track how often you&apos;re mentioned over time</li>
              <li><strong>Sentiment Trends:</strong> See if sentiment is improving or declining</li>
              <li><strong>Platform Breakdown:</strong> Which platforms generate the most mentions</li>
              <li><strong>Top Keywords:</strong> Which keywords are triggering the most results</li>
              <li><strong>Category Distribution:</strong> Pain points vs. praise vs. questions</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights
            </h4>
            <p className="text-sm text-muted-foreground">
              The Insights page provides AI-generated summaries of trends, highlighting:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Emerging topics and themes in your mentions</li>
              <li>Sudden spikes in activity (viral moments)</li>
              <li>Common pain points users are expressing</li>
              <li>Opportunities for engagement or outreach</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card id="alerts">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts & Notifications
          </CardTitle>
          <CardDescription>Stay informed without constant checking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set up alerts to be notified when new mentions appear, so you can respond quickly to important conversations.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">Notification Options</h4>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
              <li>
                <strong>Email Digest:</strong> Daily summary sent at 9 AM in your timezone with all new mentions
              </li>
              <li>
                <strong>Slack/Discord:</strong> Instant notifications to your team channel (Pro+)
              </li>
              <li>
                <strong>Webhooks:</strong> Send data to any URL for custom integrations (Team)
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Setting Up Alerts</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Go to any monitor&apos;s settings page</li>
              <li>Scroll to the &quot;Alerts&quot; section</li>
              <li>Enable the notification channels you want</li>
              <li>Configure frequency (instant, daily digest, etc.)</li>
              <li>Save your settings</li>
            </ol>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>Tip:</strong> Start with daily digests to avoid notification fatigue, then switch to instant alerts for high-priority monitors.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Slack/Discord Setup */}
      <Card id="slack-discord">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Slack & Discord Setup
          </CardTitle>
          <CardDescription>Step-by-step guide to connect your workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slack Setup */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#4A154B] flex items-center justify-center text-white text-xs font-bold">S</span>
              Slack Setup
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener" className="text-primary hover:underline">api.slack.com/apps</a> and click &quot;Create New App&quot;</li>
              <li>Select &quot;From scratch&quot; and name it (e.g., &quot;Kaulby Alerts&quot;)</li>
              <li>Choose your Slack workspace</li>
              <li>In the left sidebar, click &quot;Incoming Webhooks&quot;</li>
              <li>Toggle &quot;Activate Incoming Webhooks&quot; to On</li>
              <li>Click &quot;Add New Webhook to Workspace&quot;</li>
              <li>Select the channel where you want alerts</li>
              <li>Copy the Webhook URL (starts with <code className="px-1 py-0.5 bg-muted rounded text-xs">https://hooks.slack.com/...</code>)</li>
              <li>Paste it in Kaulby: Settings → Notifications → Slack Webhook URL</li>
            </ol>
          </div>

          {/* Discord Setup */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">D</span>
              Discord Setup
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Open Discord and go to your server settings</li>
              <li>Click &quot;Integrations&quot; → &quot;Webhooks&quot;</li>
              <li>Click &quot;New Webhook&quot;</li>
              <li>Give it a name and select the target channel</li>
              <li>Click &quot;Copy Webhook URL&quot;</li>
              <li><strong>Important:</strong> Add <code className="px-1 py-0.5 bg-muted rounded text-xs">/slack</code> to the end of the URL</li>
              <li>Example: <code className="px-1 py-0.5 bg-muted rounded text-xs break-all">https://discord.com/api/webhooks/123.../abc.../slack</code></li>
              <li>Paste this modified URL in Kaulby Settings → Notifications</li>
            </ol>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mt-4">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Why /slack?</strong> Discord supports Slack-compatible webhooks. Adding <code>/slack</code> to the URL enables this compatibility mode so Kaulby&apos;s Slack-formatted messages display correctly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card id="webhooks">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
            <Badge variant="secondary" className="ml-2">Team Plan</Badge>
          </CardTitle>
          <CardDescription>Send data to your own systems</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Webhooks allow you to receive real-time notifications when new results are found, enabling custom integrations with your own tools.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">Setting Up Webhooks</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Go to <strong>Webhooks</strong> in the sidebar</li>
              <li>Click <strong>Add Webhook</strong></li>
              <li>Enter your endpoint URL (must be HTTPS)</li>
              <li>Select which events to receive</li>
              <li>Optionally add a secret for signature verification</li>
              <li>Save and test the webhook</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Webhook Payload</h4>
            <p className="text-sm text-muted-foreground">Each webhook delivers a JSON payload with:</p>
            <div className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto">
              <pre>{`{
  "event": "new_result",
  "monitor_id": "...",
  "result": {
    "id": "...",
    "platform": "reddit",
    "title": "...",
    "content": "...",
    "sentiment": "positive",
    "url": "...",
    "created_at": "..."
  }
}`}</pre>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Use Cases</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Send mentions to your CRM (HubSpot, Salesforce)</li>
              <li>Create tickets in your support system</li>
              <li>Trigger Zapier/Make automations</li>
              <li>Store data in your own database</li>
              <li>Send to custom Slack/Teams bots</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* API Access */}
      <Card id="api-access">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
            <Badge variant="secondary" className="ml-2">Team Plan</Badge>
          </CardTitle>
          <CardDescription>Integrate Kaulby with your own applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Getting Your API Key</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Go to <strong>Settings</strong> → scroll to <strong>API Access</strong></li>
              <li>Click <strong>Create API Key</strong></li>
              <li>Give your key a descriptive name (e.g., &quot;Production App&quot;, &quot;Zapier&quot;)</li>
              <li><strong>Copy the key immediately</strong> — it won&apos;t be shown again</li>
              <li>Store it securely in your environment variables</li>
            </ol>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Authentication</h3>
            <p className="text-sm text-muted-foreground">
              Include your API key in the Authorization header:
            </p>
            <div className="p-3 rounded-lg bg-muted font-mono text-xs space-y-2">
              <p className="text-muted-foreground"># Recommended method</p>
              <p>Authorization: Bearer kaulby_live_your_key_here</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Available Endpoints</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg border">
                <p className="font-medium font-mono">GET /api/v1/monitors</p>
                <p className="text-muted-foreground text-xs mt-1">List all your monitors. Supports <code>?limit</code>, <code>?offset</code>, <code>?active</code> query parameters.</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium font-mono">POST /api/v1/monitors</p>
                <p className="text-muted-foreground text-xs mt-1">Create a new monitor. Body: <code>{`{ "name": "...", "keywords": [...], "platforms": [...] }`}</code></p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium font-mono">GET /api/v1/results</p>
                <p className="text-muted-foreground text-xs mt-1">List results. Supports <code>?monitor_id</code>, <code>?platform</code>, <code>?sentiment</code>, <code>?from</code>, <code>?to</code> filters.</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium font-mono">GET /api/v1/usage</p>
                <p className="text-muted-foreground text-xs mt-1">Get your current usage statistics and plan limits.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Rate Limits</h3>
            <p className="text-sm text-muted-foreground">
              API access is limited to <strong>10,000 requests per day</strong>. The limit resets at midnight UTC.
              Check your usage anytime with <code className="px-1 py-0.5 bg-muted rounded text-xs">GET /api/v1/usage</code>.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Example: Fetch Recent Results</h3>
            <div className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto">
              <pre>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://kaulbyapp.com/api/v1/results?limit=10&sentiment=negative"`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card id="data-export">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Export
          </CardTitle>
          <CardDescription>Download your data anytime</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export your monitoring data for analysis, reporting, or backup purposes.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">Export Options</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li><strong>Full Export (JSON):</strong> Complete data including monitors, results, and settings</li>
              <li><strong>Results Only (CSV):</strong> Spreadsheet-friendly format for analysis in Excel/Sheets</li>
              <li><strong>Monitors Only (JSON):</strong> Just your monitor configurations</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">How to Export</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Go to <strong>Settings</strong></li>
              <li>Scroll to <strong>Your Data</strong> section</li>
              <li>Click <strong>Export Data</strong></li>
              <li>Select the format you need</li>
              <li>Download starts automatically</li>
            </ol>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>Note:</strong> CSV export is available for Pro and Team plans. Free users can export their data in JSON format.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Team Management */}
      <Card id="team">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
            <Badge variant="secondary" className="ml-2">Team Plan</Badge>
          </CardTitle>
          <CardDescription>Collaborate with your team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Team plan includes 5 seats with the ability to add more. Share monitors and collaborate on responses.
          </p>

          <div className="space-y-3">
            <h4 className="font-medium">Creating a Workspace</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Go to <strong>Settings</strong> → <strong>Team</strong></li>
              <li>Click <strong>Create Workspace</strong></li>
              <li>Enter a name for your workspace</li>
              <li>You&apos;ll be set as the workspace owner</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Inviting Team Members</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>In the Team section, enter their email address</li>
              <li>Click <strong>Invite</strong></li>
              <li>They&apos;ll receive an email with a link to join</li>
              <li>Once accepted, they have access to all workspace monitors</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Roles</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li><strong>Owner:</strong> Full access, can manage billing and members</li>
              <li><strong>Member:</strong> Can view and manage monitors, but cannot access billing</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs">
              <strong>Pricing:</strong> Team plan includes 5 seats. Additional seats are $15/user/month.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card id="account">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Account Settings
          </CardTitle>
          <CardDescription>Manage your account preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium">Available Settings</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li><strong>Timezone:</strong> Set your timezone for email digest delivery (9 AM your time)</li>
              <li><strong>Email Preferences:</strong> Configure which emails you receive</li>
              <li><strong>Plan & Billing:</strong> View current plan, upgrade, or manage subscription</li>
              <li><strong>Data Export:</strong> Download all your data</li>
              <li><strong>Delete Account:</strong> Permanently remove your account and data</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Changing Your Plan</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>Go to <strong>Settings</strong></li>
              <li>Scroll to <strong>Subscription Plans</strong></li>
              <li>Click <strong>Upgrade</strong> on the plan you want</li>
              <li>Complete checkout (14-day free trial for Pro/Team)</li>
            </ol>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Cancellation:</strong> You can cancel anytime from Settings. You&apos;ll keep access until the end of your billing period.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card id="plans">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Plan Comparison
          </CardTitle>
          <CardDescription>
            Choose the right plan for your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 font-medium">Feature</th>
                  <th className="text-center py-3 px-4 font-medium">Free</th>
                  <th className="text-center py-3 px-4 font-medium bg-primary/5">Pro</th>
                  <th className="text-center py-3 px-4 font-medium">Team</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-3 pr-4">Monitors</td>
                  <td className="text-center py-3 px-4">1</td>
                  <td className="text-center py-3 px-4 bg-primary/5">10</td>
                  <td className="text-center py-3 px-4">30</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Keywords per monitor</td>
                  <td className="text-center py-3 px-4">3</td>
                  <td className="text-center py-3 px-4 bg-primary/5">20</td>
                  <td className="text-center py-3 px-4">35</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Platforms</td>
                  <td className="text-center py-3 px-4">Reddit only</td>
                  <td className="text-center py-3 px-4 bg-primary/5">All 9</td>
                  <td className="text-center py-3 px-4">All 9</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">History retention</td>
                  <td className="text-center py-3 px-4">3 days</td>
                  <td className="text-center py-3 px-4 bg-primary/5">90 days</td>
                  <td className="text-center py-3 px-4">1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Refresh cycle</td>
                  <td className="text-center py-3 px-4">24 hours</td>
                  <td className="text-center py-3 px-4 bg-primary/5">4 hours</td>
                  <td className="text-center py-3 px-4">2 hours</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">AI analysis</td>
                  <td className="text-center py-3 px-4">First result only</td>
                  <td className="text-center py-3 px-4 bg-primary/5">Unlimited</td>
                  <td className="text-center py-3 px-4">Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Email digest</td>
                  <td className="text-center py-3 px-4">—</td>
                  <td className="text-center py-3 px-4 bg-primary/5">Daily</td>
                  <td className="text-center py-3 px-4">Configurable</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Slack/Discord</td>
                  <td className="text-center py-3 px-4">—</td>
                  <td className="text-center py-3 px-4 bg-primary/5">✓</td>
                  <td className="text-center py-3 px-4">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">CSV Export</td>
                  <td className="text-center py-3 px-4">—</td>
                  <td className="text-center py-3 px-4 bg-primary/5">✓</td>
                  <td className="text-center py-3 px-4">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Webhooks</td>
                  <td className="text-center py-3 px-4">—</td>
                  <td className="text-center py-3 px-4 bg-primary/5">—</td>
                  <td className="text-center py-3 px-4">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">API access</td>
                  <td className="text-center py-3 px-4">—</td>
                  <td className="text-center py-3 px-4 bg-primary/5">—</td>
                  <td className="text-center py-3 px-4">✓</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Team members</td>
                  <td className="text-center py-3 px-4">—</td>
                  <td className="text-center py-3 px-4 bg-primary/5">—</td>
                  <td className="text-center py-3 px-4">5 included</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-foreground">Price</td>
                  <td className="text-center py-3 px-4 font-medium text-foreground">$0</td>
                  <td className="text-center py-3 px-4 font-medium text-foreground bg-primary/5">$29/mo</td>
                  <td className="text-center py-3 px-4 font-medium text-foreground">$99/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            All paid plans include a 14-day free trial. Annual billing saves 2 months.
          </p>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card id="troubleshooting">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Troubleshooting
          </CardTitle>
          <CardDescription>Common issues and solutions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-2">No results appearing for my monitor</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Keywords may be too specific—try broader terms</li>
                <li>• New monitors can take up to 24 hours for first results</li>
                <li>• Check that the platforms you selected are active</li>
                <li>• Verify your plan supports the platforms you chose</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Slack/Discord notifications not working</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Verify the webhook URL is correct and complete</li>
                <li>• For Discord, make sure you added <code className="px-1 py-0.5 bg-muted rounded text-xs">/slack</code> to the end</li>
                <li>• Check that the Slack app has permission to post to the channel</li>
                <li>• Try the &quot;Test&quot; button in Settings to verify the connection</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-2">API key not working</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Ensure you&apos;re on the Team plan (API is Team-only)</li>
                <li>• Check the Authorization header format: <code className="px-1 py-0.5 bg-muted rounded text-xs">Bearer kaulby_live_xxx</code></li>
                <li>• Verify the key hasn&apos;t been revoked in Settings</li>
                <li>• Check if you&apos;ve hit the daily rate limit (10,000 requests)</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Email digest not arriving</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Check your spam/junk folder</li>
                <li>• Verify your timezone is set correctly in Settings</li>
                <li>• Digests only send if there are new results</li>
                <li>• Add <code className="px-1 py-0.5 bg-muted rounded text-xs">noreply@kaulbyapp.com</code> to your contacts</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-2">Results seem outdated</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Free plan has 24-hour delay; Pro refreshes every 4 hours; Team every 2 hours</li>
                <li>• Click the refresh icon on a monitor to trigger an immediate scan</li>
                <li>• Some platforms have inherent delays in indexing new content</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card id="faq">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How often are results updated?</h4>
              <p className="text-sm text-muted-foreground">
                Free: 24-hour delay. Pro: every 4 hours. Team: every 2 hours.
                You can also manually refresh any monitor.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How many keywords can I track?</h4>
              <p className="text-sm text-muted-foreground">
                Free: 3 per monitor. Pro: 20 per monitor. Team: 35 per monitor.
                Use quotes for exact phrase matching.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How long are results stored?</h4>
              <p className="text-sm text-muted-foreground">
                Free: 3 days. Pro: 90 days. Team: 1 year.
                Export your data anytime from Settings.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Can I cancel anytime?</h4>
              <p className="text-sm text-muted-foreground">
                Yes. Cancel from Settings and keep access until your billing period ends.
                No questions asked.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Is there a free trial?</h4>
              <p className="text-sm text-muted-foreground">
                Pro and Team plans include a 14-day free trial.
                No charge until the trial ends.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Can I add more team members?</h4>
              <p className="text-sm text-muted-foreground">
                Team plan includes 5 seats. Additional members are $15/user/month.
                Contact us for larger teams.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How accurate is the AI analysis?</h4>
              <p className="text-sm text-muted-foreground">
                Very accurate for sentiment and categorization. We use advanced LLMs
                and continuously improve based on feedback.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Can I export my data?</h4>
              <p className="text-sm text-muted-foreground">
                Yes. All plans can export JSON. Pro/Team can also export CSV.
                Team has full API access for custom integrations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card id="contact">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Need More Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Can&apos;t find what you&apos;re looking for? Our team is here to help.
          </p>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Email Support</p>
                <a
                  href="mailto:support@kaulbyapp.com"
                  className="text-sm text-primary hover:underline"
                >
                  support@kaulbyapp.com
                </a>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We typically respond within 24 hours. Team customers receive priority support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

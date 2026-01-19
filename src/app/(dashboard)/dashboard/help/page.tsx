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

      {/* Quick Start */}
      <Card>
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
                Add keywords you want to track and select platforms.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <h3 className="font-medium mb-1">Review Results</h3>
              <p className="text-sm text-muted-foreground">
                See matching conversations with AI-powered analysis.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-primary">3</span>
              </div>
              <h3 className="font-medium mb-1">Set Up Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Get notified via email or Slack when mentions appear.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monitors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5" />
              Creating Monitors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Monitors track specific keywords or phrases across platforms. Each monitor can have:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Multiple keywords (use quotes for exact phrases)</li>
              <li>One or more platforms to monitor</li>
              <li>Custom filters for sentiment or categories</li>
            </ul>
            <div className="p-3 rounded-lg bg-muted/50 mt-4">
              <p className="text-xs">
                <strong>Tip:</strong> Use specific keywords to reduce noise. &quot;your-brand-name&quot; is better than generic terms.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Platforms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Supported Platforms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We monitor 9 platforms where your audience discusses products:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">Reddit</Badge>
              <Badge variant="outline">Hacker News</Badge>
              <Badge variant="outline">Product Hunt</Badge>
              <Badge variant="outline">Google Reviews</Badge>
              <Badge variant="outline">Trustpilot</Badge>
              <Badge variant="outline">App Store</Badge>
              <Badge variant="outline">Play Store</Badge>
              <Badge variant="outline">Quora</Badge>
              <Badge variant="outline">Dev.to</Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 mt-4">
              <p className="text-xs">
                Platform availability varies by plan. Free users have Reddit access.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Our AI analyzes each result to provide:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Sentiment:</strong> Positive, negative, or neutral</li>
              <li><strong>Categories:</strong> Pain point, feature request, question, etc.</li>
              <li><strong>Summary:</strong> Key points from the discussion</li>
            </ul>
            <div className="p-3 rounded-lg bg-muted/50 mt-4">
              <p className="text-xs">
                Pro and Team users get unlimited AI analysis. Free users see analysis on the first result.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" />
              Alerts & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Stay informed with multiple notification options:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Email Digest:</strong> Daily summaries at 9 AM your time</li>
              <li><strong>Slack:</strong> Instant notifications to your channel</li>
              <li><strong>Webhooks:</strong> Custom integrations (Team)</li>
            </ul>
            <div className="p-3 rounded-lg bg-muted/50 mt-4">
              <p className="text-xs">
                Configure alerts in each monitor&apos;s settings or in Settings → Notifications.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQs */}
      <Card>
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
                Pro users get results every 4 hours. Team users get results every 2 hours.
                Free users have a 24-hour delay.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How many keywords can I track?</h4>
              <p className="text-sm text-muted-foreground">
                Free: 3 keywords per monitor. Pro: 20 keywords.
                Team: 35 keywords. Use quotes for exact phrases.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How long are results stored?</h4>
              <p className="text-sm text-muted-foreground">
                Free: 3 days. Pro: 90 days. Team: 1 year.
                Export anytime from Settings to keep a permanent copy.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How does billing work?</h4>
              <p className="text-sm text-muted-foreground">
                All paid plans are billed monthly. Cancel anytime and keep
                access until the end of your billing period.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Can I add team members?</h4>
              <p className="text-sm text-muted-foreground">
                Team plan includes 5 team seats (+$15/user after).
                Go to Settings → Team to invite members.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Can I export my data?</h4>
              <p className="text-sm text-muted-foreground">
                Pro and Team users can export to CSV. Team
                also has API access for custom integrations.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How accurate is the AI?</h4>
              <p className="text-sm text-muted-foreground">
                Highly accurate for sentiment and categorization, but review
                manually for important decisions. AI improves over time.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">How do I delete my account?</h4>
              <p className="text-sm text-muted-foreground">
                Settings → Data & Storage → Delete Account. Export your
                data first if you want to keep a copy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <Card>
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
                  <th className="text-center py-3 px-4 font-medium">Pro</th>
                  <th className="text-center py-3 px-4 font-medium">Team</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-3 pr-4">Monitors</td>
                  <td className="text-center py-3 px-4">1</td>
                  <td className="text-center py-3 px-4">10</td>
                  <td className="text-center py-3 px-4">30</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Keywords per monitor</td>
                  <td className="text-center py-3 px-4">3</td>
                  <td className="text-center py-3 px-4">20</td>
                  <td className="text-center py-3 px-4">35</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Platforms</td>
                  <td className="text-center py-3 px-4">Reddit only</td>
                  <td className="text-center py-3 px-4">All 9</td>
                  <td className="text-center py-3 px-4">All 9</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">History</td>
                  <td className="text-center py-3 px-4">3 days</td>
                  <td className="text-center py-3 px-4">90 days</td>
                  <td className="text-center py-3 px-4">1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Refresh rate</td>
                  <td className="text-center py-3 px-4">24hr delay</td>
                  <td className="text-center py-3 px-4">4 hours</td>
                  <td className="text-center py-3 px-4">2 hours</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">AI analysis</td>
                  <td className="text-center py-3 px-4">First result</td>
                  <td className="text-center py-3 px-4">Full</td>
                  <td className="text-center py-3 px-4">Full + Ask AI</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Email alerts</td>
                  <td className="text-center py-3 px-4">-</td>
                  <td className="text-center py-3 px-4">Daily digest</td>
                  <td className="text-center py-3 px-4">Configurable</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Slack integration</td>
                  <td className="text-center py-3 px-4">-</td>
                  <td className="text-center py-3 px-4">Yes</td>
                  <td className="text-center py-3 px-4">Yes</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 pr-4">Team members</td>
                  <td className="text-center py-3 px-4">-</td>
                  <td className="text-center py-3 px-4">-</td>
                  <td className="text-center py-3 px-4">5 included</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Price</td>
                  <td className="text-center py-3 px-4 font-medium text-foreground">$0</td>
                  <td className="text-center py-3 px-4 font-medium text-foreground">$29/mo</td>
                  <td className="text-center py-3 px-4 font-medium text-foreground">$99/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Need More Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="mb-4">
            Can&apos;t find what you&apos;re looking for? We&apos;re here to help.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:support@kaulbyapp.com"
              className="text-primary hover:underline"
            >
              support@kaulbyapp.com
            </a>
            <p className="text-xs">
              Team customers get priority support with faster response times.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

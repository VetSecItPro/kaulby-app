"use client";

import { useCallback, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Lightbulb,
  FolderOpen,
  BookOpen,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from "lucide-react";
import { submitSupportTicket } from "./actions";

// Section navigation data
const sections = [
  { id: "faq", title: "Quick Answers", icon: HelpCircle },
  { id: "getting-started", title: "Getting Started", icon: Zap },
  { id: "monitors", title: "Monitors", icon: Radio },
  { id: "platforms", title: "Platforms", icon: Globe },
  { id: "results", title: "Results & Analysis", icon: Brain },
  { id: "alerts", title: "Alerts & Notifications", icon: Bell },
  { id: "api", title: "API Access", icon: Key, badge: "Team" },
  { id: "billing", title: "Billing & Plans", icon: CreditCard },
  { id: "team", title: "Team Management", icon: Users, badge: "Team" },
  { id: "account", title: "Account & Settings", icon: Settings },
  { id: "troubleshooting", title: "Troubleshooting", icon: Shield },
  { id: "contact", title: "Contact Support", icon: Mail },
];

// FAQ data - common questions users ask
const faqs = [
  {
    question: "How long until I see my first results?",
    answer: "New monitors typically find results within 2-24 hours depending on your plan. Free plans scan every 24 hours, Pro every 4 hours, and Team every 2 hours. If your keywords are very specific or niche, it may take longer to find matching conversations.",
  },
  {
    question: "Why am I not seeing any results?",
    answer: "Several things to check: (1) Your keywords might be too specific - try broader terms. (2) The topic might have low discussion volume online. (3) Free users only have Reddit access - upgrade for more platforms. (4) New monitors need time for the first scan to complete.",
  },
  {
    question: "What's the difference between platforms that need a URL vs. keyword-based?",
    answer: "Reddit, Hacker News, Product Hunt, and Quora search by keywords across the entire platform. Review platforms (Google Reviews, Trustpilot, G2, Yelp, Amazon, App Store, Play Store) and YouTube require your specific business/product URL because they monitor reviews for that exact listing.",
  },
  {
    question: "Can I monitor my competitors?",
    answer: "Yes! Create a separate monitor with your competitor's brand name as the keyword. You'll see what people are saying about them, complaints they have, and users looking for alternatives - all potential opportunities for you.",
  },
  {
    question: "Why is some AI analysis locked or blurred?",
    answer: "Free users get AI analysis on their first result only. This lets you see the value before upgrading. Pro and Team plans include unlimited AI analysis on all results, plus enhanced insights like pain point detection and category classification.",
  },
  {
    question: "How do I get notified about new mentions?",
    answer: "Go to Settings → Notifications. You can enable daily email digests (sent at 9 AM your timezone), or connect Slack/Discord for instant notifications (Pro+). Team plans also support custom webhooks for integrations.",
  },
  {
    question: "What happens to my data if I downgrade or cancel?",
    answer: "Your data is retained for 30 days after cancellation, giving you time to export or resubscribe. If you downgrade, monitors beyond your new limit are paused (not deleted) and results remain accessible within your new plan's history limit.",
  },
  {
    question: "Can multiple people on my team access Kaulby?",
    answer: "Team plan includes 5 seats with shared access to all monitors and results. Additional members are $15/user/month. Each member can set their own notification preferences while sharing the same monitoring data.",
  },
];

export default function HelpPage() {
  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Support form state
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<{
    category: string;
    subject: string;
    message: string;
  }>({
    category: "",
    subject: "",
    message: "",
  });
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Handle smooth scroll to section
  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();

    const element = document.getElementById(sectionId);
    if (!element) {
      return;
    }

    // Use native scrollIntoView - works with any scroll container
    // The scroll-mt-20 class on sections handles the header offset
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Handle support form submission
  const handleSubmitTicket = () => {
    setSubmitStatus({ type: null, message: "" });

    startTransition(async () => {
      const result = await submitSupportTicket(formState);

      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: "Your message has been sent! We'll get back to you within 24 hours.",
        });
        setFormState({ category: "", subject: "", message: "" });
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Something went wrong. Please try again.",
        });
      }
    });
  };

  return (
    <div className="space-y-12 max-w-4xl pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground mt-2">
          Everything you need to know about using Kaulby to monitor online conversations and grow your business.
        </p>
      </div>

      {/* Table of Contents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Documentation
          </CardTitle>
          <CardDescription>
            Click any section to jump directly to it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => scrollToSection(e, section.id)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors group"
                >
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm group-hover:text-primary transition-colors">{section.title}</span>
                  {section.badge && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {section.badge}
                    </Badge>
                  )}
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ==================== SECTION 0: QUICK ANSWERS (FAQ) ==================== */}
      <section id="faq" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Quick Answers</h2>
            <p className="text-muted-foreground">Common questions answered instantly</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
            <CardDescription>
              Click any question to expand the answer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm pr-4">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground border-t bg-muted/30">
                    <p className="pt-3">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 1: GETTING STARTED ==================== */}
      <section id="getting-started" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Getting Started</h2>
            <p className="text-muted-foreground">Set up your first monitor in under 2 minutes</p>
          </div>
        </div>

        {/* Article: Quick Start Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Start Guide</CardTitle>
            <CardDescription>
              Follow these three steps to start monitoring online conversations about your brand
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="relative p-4 rounded-lg border bg-card">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  1
                </div>
                <h4 className="font-semibold mt-2 mb-2">Create a Monitor</h4>
                <p className="text-sm text-muted-foreground">
                  Click <strong>&quot;New Monitor&quot;</strong> in the sidebar. Enter your brand or company name, add optional keywords, and select which platforms to track.
                </p>
              </div>
              <div className="relative p-4 rounded-lg border bg-card">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  2
                </div>
                <h4 className="font-semibold mt-2 mb-2">Review Results</h4>
                <p className="text-sm text-muted-foreground">
                  Within hours, you&apos;ll see matching conversations. Each result includes AI-powered sentiment analysis, categorization, and a summary of the discussion.
                </p>
              </div>
              <div className="relative p-4 rounded-lg border bg-card">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  3
                </div>
                <h4 className="font-semibold mt-2 mb-2">Set Up Alerts</h4>
                <p className="text-sm text-muted-foreground">
                  Configure email digests or connect Slack/Discord to get notified when new mentions appear. Never miss an important conversation again.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Pro Tip</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start with just your brand name as the primary search term. Kaulby will automatically find variations and related mentions. Add specific keywords later to narrow down results for particular topics like &quot;pricing&quot; or &quot;customer service.&quot;
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Article: What to Expect */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What to Expect</CardTitle>
            <CardDescription>
              Realistic expectations for your first week using Kaulby
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <div>
                  <p className="font-medium text-sm">First Few Hours</p>
                  <p className="text-sm text-muted-foreground">
                    Your monitor is created and queued for scanning. Depending on your plan, the first scan runs within 2-24 hours. You may see results immediately if there are recent discussions about your keywords.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div>
                  <p className="font-medium text-sm">Days 1-3</p>
                  <p className="text-sm text-muted-foreground">
                    Results start flowing in. You might see anywhere from a handful to hundreds of mentions depending on how often your brand is discussed. Use this time to refine your keywords — too many irrelevant results means your terms are too broad.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <div>
                  <p className="font-medium text-sm">Week 1 and Beyond</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll develop a rhythm. Most users check their dashboard once daily or rely on email digests. The AI analysis helps you quickly spot which conversations need your attention vs. which are just informational.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Not seeing results?</strong> This could mean: (1) your brand isn&apos;t being discussed much publicly yet — which is valuable information, (2) your keywords are too specific, or (3) you need to wait for the next scan cycle. Check the Troubleshooting section for more help.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Understanding Your Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Understanding Your Dashboard</CardTitle>
            <CardDescription>
              A tour of the main areas you&apos;ll use daily
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The dashboard is designed to give you a quick overview of your monitoring activity and help you take action on important conversations.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <BarChart3 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Overview</p>
                  <p className="text-sm text-muted-foreground">
                    Your home base showing total mentions, sentiment breakdown, and recent activity across all monitors. Great for a daily health check.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Radio className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Monitors</p>
                  <p className="text-sm text-muted-foreground">
                    Manage your tracking configurations. Each monitor can target different keywords, platforms, and audiences. Create separate monitors for your brand, competitors, or industry topics.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <MessageSquare className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Results</p>
                  <p className="text-sm text-muted-foreground">
                    Browse all discovered mentions with powerful filtering. See the full conversation, AI analysis, and engagement metrics. Save important results or hide irrelevant ones.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Insights</p>
                  <p className="text-sm text-muted-foreground">
                    AI-generated summaries of trends across your monitoring data. Discover emerging topics, sentiment shifts, and actionable opportunities without reading every result.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 2: MONITORS ==================== */}
      <section id="monitors" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Radio className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Monitors</h2>
            <p className="text-muted-foreground">Track conversations that matter to your business</p>
          </div>
        </div>

        {/* Article: Creating Monitors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Creating Monitors</CardTitle>
            <CardDescription>
              How to set up effective monitoring for your brand, competitors, or industry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A monitor is a saved search configuration that continuously scans selected platforms for conversations matching your criteria. Think of it as a persistent, intelligent Google Alert that works across communities, forums, and review sites — and tells you not just <em>what</em> people are saying, but <em>how they feel</em> about it.
            </p>

            <div className="space-y-4">
              <h4 className="font-medium">Creating a New Monitor</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                <li>Click <strong>Monitors</strong> in the sidebar, then <strong>New Monitor</strong></li>
                <li>Enter a descriptive <strong>Monitor Name</strong> (e.g., &quot;Brand Mentions&quot;, &quot;Competitor X Feedback&quot;)</li>
                <li>Enter your <strong>Company/Brand Name</strong> — this is the primary search term</li>
                <li>Optionally add <strong>Additional Keywords</strong> to narrow results (e.g., &quot;pricing&quot;, &quot;support&quot;)</li>
                <li>Select which <strong>Platforms</strong> to monitor (Reddit is available on Free; all 12 platforms on Pro/Team)</li>
                <li>Click <strong>Create Monitor</strong></li>
              </ol>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">
                <strong>Plan limits:</strong> Free: 1 monitor, 3 keywords · Pro: 10 monitors, 20 keywords each · Team: 30 monitors, 35 keywords each
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Two Types of Platforms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Understanding Platform Types</CardTitle>
            <CardDescription>
              Keyword-based vs. URL-based platforms work differently
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kaulby monitors two types of platforms, and it&apos;s important to understand the difference to set up your monitors correctly.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2 text-sm">Keyword-Based Platforms</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  These platforms are searched by keywords. Kaulby scans the entire platform for posts, comments, and discussions that mention your terms.
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">Reddit</Badge>
                  <Badge variant="outline" className="text-xs">Hacker News</Badge>
                  <Badge variant="outline" className="text-xs">Product Hunt</Badge>
                  <Badge variant="outline" className="text-xs">Quora</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  <strong>Best for:</strong> Brand mentions, competitor tracking, industry trends, finding people asking questions you can answer.
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2 text-sm">URL-Based Platforms (Reviews)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  These require your specific business or product URL. Kaulby monitors reviews on that exact listing.
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">Google Reviews</Badge>
                  <Badge variant="outline" className="text-xs">Trustpilot</Badge>
                  <Badge variant="outline" className="text-xs">G2</Badge>
                  <Badge variant="outline" className="text-xs">Yelp</Badge>
                  <Badge variant="outline" className="text-xs">Amazon</Badge>
                  <Badge variant="outline" className="text-xs">App Store</Badge>
                  <Badge variant="outline" className="text-xs">Play Store</Badge>
                  <Badge variant="outline" className="text-xs">YouTube</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  <strong>Best for:</strong> Monitoring your own product reviews, tracking customer feedback, responding to negative reviews quickly.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Setting Up Review Monitoring</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    When you select a URL-based platform, you&apos;ll see an input field asking for the URL. Copy your exact business URL from that platform. For example, for Google Reviews, copy your Google Maps business URL. For Amazon, copy your product page URL.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Article: Keywords and Search Queries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Keywords and Search Queries</CardTitle>
            <CardDescription>
              Best practices for effective keyword selection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The keywords you choose determine what conversations Kaulby finds. Your company/brand name is always the primary search term — additional keywords help you find specific types of mentions.
            </p>

            <div className="space-y-4">
              <h4 className="font-medium">What to Monitor</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Your Brand</p>
                  <p className="text-xs text-muted-foreground">
                    Company name, product names, common misspellings, abbreviations users might use
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Competitors</p>
                  <p className="text-xs text-muted-foreground">
                    Competitor names to find users comparing options or looking for alternatives
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Pain Points</p>
                  <p className="text-xs text-muted-foreground">
                    &quot;frustrated with&quot;, &quot;looking for alternative&quot;, &quot;any recommendations for&quot;
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Industry Topics</p>
                  <p className="text-xs text-muted-foreground">
                    Category keywords like &quot;best CRM&quot;, &quot;project management tool&quot;, &quot;email marketing&quot;
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Keyword Tips</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>Be specific:</strong> &quot;Notion alternative for teams&quot; finds better leads than just &quot;alternative&quot;</li>
                <li><strong>Include variations:</strong> Add both &quot;YourBrand&quot; and &quot;Your Brand&quot; if users spell it both ways</li>
                <li><strong>Think like your customers:</strong> What would someone type when they have a problem you solve?</li>
                <li><strong>Monitor competitors:</strong> &quot;switching from Competitor&quot; or &quot;Competitor vs&quot; finds comparison shoppers</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Avoid overly broad keywords.</strong> Terms like &quot;app&quot;, &quot;software&quot;, or &quot;tool&quot; alone will generate too much noise. Combine them with your brand or specific context.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Audiences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Organizing with Audiences
            </CardTitle>
            <CardDescription>
              Group monitors for better organization and reporting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Audiences let you organize multiple monitors into logical groups. This is especially useful when you&apos;re tracking different aspects of your business or managing monitoring for multiple products.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Use Cases for Audiences</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>By product:</strong> Separate audiences for each product in your suite</li>
                <li><strong>By competitor:</strong> Track each competitor with their own audience</li>
                <li><strong>By team:</strong> Marketing monitors vs. Product monitors vs. Support monitors</li>
                <li><strong>By market segment:</strong> Enterprise vs. SMB vs. Consumer audiences</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Creating an Audience</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Go to <strong>Audiences</strong> in the sidebar</li>
                <li>Click <strong>Create Audience</strong></li>
                <li>Give it a name and optional description</li>
                <li>Add existing monitors or create new ones within the audience</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 3: PLATFORMS ==================== */}
      <section id="platforms" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Platforms</h2>
            <p className="text-muted-foreground">Where we find conversations about your brand</p>
          </div>
        </div>

        {/* Article: Platform Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supported Platforms Overview</CardTitle>
            <CardDescription>
              Kaulby monitors 12 platforms where your audience discusses products and services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Each platform has unique characteristics and audience demographics. Understanding these helps you prioritize which platforms matter most for your business.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Reddit</Badge>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Free</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  The &quot;front page of the internet&quot; with thousands of niche communities. Excellent for B2C products and technical discussions. Users are highly engaged and vocal.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Hacker News</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tech-savvy audience of developers, founders, and investors. Ideal for SaaS, dev tools, and startups. Conversations are high-quality and influential.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Product Hunt</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Where new products launch and get discovered. Perfect for tracking competitor launches, finding early adopters, and understanding product positioning.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Google Reviews</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Critical for local businesses and B2B services. Monitor what customers say about your Google Business listing and respond to feedback.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Trustpilot</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Major consumer review platform. Essential for e-commerce and service businesses. Shoppers frequently check Trustpilot before purchasing.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">App Store</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  iOS app reviews directly from Apple&apos;s App Store. Track user sentiment, feature requests, and bugs reported by your mobile users.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Play Store</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Android app reviews from Google Play. Often has different feedback than iOS — important to monitor both if you have a mobile app.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Quora</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Q&A platform where people seek recommendations. Great for finding users actively looking for solutions — high-intent leads.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">YouTube</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Video comments and discussions. Great for consumer products, tech reviews, and brand mentions in video content.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">G2</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  B2B software reviews and ratings. Essential for SaaS companies to track customer feedback and competitive positioning.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Yelp</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Local business reviews. Critical for restaurants, retail, and service businesses to monitor customer experiences.
                </p>
              </div>

              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Amazon Reviews</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Pro</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Product reviews on Amazon. Essential for e-commerce brands to track customer sentiment and product feedback.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Platform availability:</strong> Free users can monitor Reddit only. Pro and Team plans include access to all 12 platforms.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Which Platforms to Prioritize */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Which Platforms Should You Monitor?</CardTitle>
            <CardDescription>
              Recommendations based on your business type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You don&apos;t need to monitor all 12 platforms. Focus on where your customers actually spend time. Here are recommendations by business type:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">B2B SaaS / Software</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Start with: <strong>Reddit, Hacker News, G2, Product Hunt</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Tech-savvy buyers research heavily on these platforms. G2 is especially critical for enterprise sales — buyers often check G2 reviews before demos.
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">E-commerce / Consumer Products</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Start with: <strong>Reddit, Amazon Reviews, Trustpilot, YouTube</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Amazon reviews directly impact sales. YouTube for product mentions in reviews and unboxings. Trustpilot for brand credibility.
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Local Business / Services</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Start with: <strong>Google Reviews, Yelp, Trustpilot</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Google Reviews is #1 — it appears directly in search results. Yelp matters for restaurants and local services. Trustpilot for service businesses.
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Mobile Apps</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Start with: <strong>App Store, Play Store, Reddit, Product Hunt</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  App store reviews are critical — they affect your rating and downloads. Reddit for community feedback. Product Hunt for launches.
                </p>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Startups / New Businesses</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Start with: <strong>Reddit, Hacker News, Quora, Product Hunt</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Focus on discovery platforms where people ask &quot;what&apos;s the best tool for X&quot; — these are your best leads. Add review platforms once you have customers.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Start Small, Then Expand</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Begin with 2-3 platforms where you know your audience exists. Add more platforms once you&apos;ve established a workflow for handling results. Quality engagement on a few platforms beats scattered attention across many.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 4: RESULTS & ANALYSIS ==================== */}
      <section id="results" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Results & Analysis</h2>
            <p className="text-muted-foreground">Understanding and acting on discovered conversations</p>
          </div>
        </div>

        {/* Article: Understanding Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Understanding Results</CardTitle>
            <CardDescription>
              What each result contains and how to use it
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When Kaulby finds a conversation matching your monitor, it captures the content and runs AI analysis to help you quickly understand the context and decide whether to engage.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Each Result Includes</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Title & Content</p>
                  <p className="text-xs text-muted-foreground">
                    The post title and body text, with your keywords highlighted for easy scanning
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Source Link</p>
                  <p className="text-xs text-muted-foreground">
                    Direct link to the original conversation so you can read full context and engage
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">AI Sentiment</p>
                  <p className="text-xs text-muted-foreground">
                    Positive, negative, or neutral classification with confidence score
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Category</p>
                  <p className="text-xs text-muted-foreground">
                    Pain point, solution request, praise, competitor mention, or feature request
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">AI Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Brief summary of the key points for quick understanding without reading everything
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">Engagement Metrics</p>
                  <p className="text-xs text-muted-foreground">
                    Upvotes, comments, and other platform-specific engagement signals
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Article: AI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Sentiment & Categorization</CardTitle>
            <CardDescription>
              How our AI helps you prioritize and understand conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Every result is analyzed by our AI to extract actionable insights. This helps you quickly identify which conversations need attention versus which are just informational.
            </p>

            <div className="space-y-4">
              <h4 className="font-medium">Sentiment Analysis</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="font-medium text-sm text-green-800 dark:text-green-200">Positive</p>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    User is happy, recommending, or sharing success. Great for testimonials and social proof.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowRight className="h-4 w-4 text-yellow-600" />
                    <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200">Neutral</p>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Factual discussion, comparison, or question without strong emotion. Good context.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <p className="font-medium text-sm text-red-800 dark:text-red-200">Negative</p>
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    User frustrated, complaining, or having issues. High priority for support engagement.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Categories</h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                <li><strong>Pain Point:</strong> User expressing frustration with a problem your product could solve</li>
                <li><strong>Solution Request:</strong> User actively looking for product recommendations</li>
                <li><strong>Feature Request:</strong> User wanting specific functionality — valuable product feedback</li>
                <li><strong>Competitor Mention:</strong> Discussion comparing you to alternatives</li>
                <li><strong>Positive Feedback:</strong> Praise, recommendations, or success stories</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>AI access:</strong> Free users see AI analysis on the first result only. Pro and Team users get unlimited AI analysis on all results.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Filtering and Managing Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtering and Managing Results
            </CardTitle>
            <CardDescription>
              Find what matters and keep your feed organized
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              As your monitors accumulate results, filtering and organization become essential. Kaulby provides several ways to focus on what matters.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Filter Options</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>By Monitor:</strong> View results from a specific monitor only</li>
                <li><strong>By Platform:</strong> See only Reddit, only Hacker News, etc.</li>
                <li><strong>By Sentiment:</strong> Focus on negative mentions that need attention</li>
                <li><strong>By Category:</strong> Find all solution requests or pain points</li>
                <li><strong>By Date:</strong> Look at recent results or a specific time range</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Managing Results</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>Save:</strong> Bookmark important results to review later or share with your team</li>
                <li><strong>Hide:</strong> Remove irrelevant results from your feed (they&apos;re still stored)</li>
                <li><strong>Export:</strong> Download results as CSV for analysis in Excel or Google Sheets (Pro/Team)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Article: Acting on Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Taking Action on Results</CardTitle>
            <CardDescription>
              What to do with different types of conversations you discover
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Finding conversations is just the beginning. The real value comes from engaging thoughtfully. Here&apos;s how to respond to different types of results:
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Positive Mentions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Thank them publicly</strong> — a simple &quot;Thanks for the kind words!&quot; builds community</li>
                  <li>• <strong>Ask for permission</strong> to use their feedback as a testimonial</li>
                  <li>• <strong>Share internally</strong> with your team to boost morale</li>
                  <li>• <strong>Add to marketing</strong> — screenshots of genuine praise are powerful social proof</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Negative Mentions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Respond quickly</strong> — speed matters. Aim to reply within hours, not days</li>
                  <li>• <strong>Be empathetic</strong> — acknowledge their frustration before offering solutions</li>
                  <li>• <strong>Take it offline</strong> — offer to continue the conversation via email or DM</li>
                  <li>• <strong>Follow up publicly</strong> — when resolved, post an update so others can see you care</li>
                  <li>• <strong>Log the feedback</strong> — track recurring complaints for product improvements</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Solution Requests / People Looking for Help</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Be helpful first</strong> — answer their question genuinely, don&apos;t just pitch</li>
                  <li>• <strong>Disclose your affiliation</strong> — &quot;Full disclosure: I work at [Company]&quot; builds trust</li>
                  <li>• <strong>Offer a trial or demo</strong> — make it easy to try your solution</li>
                  <li>• <strong>Respect the community</strong> — some subreddits have rules against self-promotion</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Competitor Comparisons</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Stay professional</strong> — never badmouth competitors</li>
                  <li>• <strong>Highlight differences</strong> — focus on what makes you unique, not what&apos;s wrong with them</li>
                  <li>• <strong>Let customers speak</strong> — share relevant case studies or testimonials</li>
                  <li>• <strong>Learn from it</strong> — competitor praise reveals what customers value</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Feature Requests</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Acknowledge the request</strong> — even if you can&apos;t build it, say you&apos;ve heard it</li>
                  <li>• <strong>Track frequency</strong> — requests mentioned multiple times deserve attention</li>
                  <li>• <strong>Share your roadmap</strong> — if you&apos;re planning to build it, let them know</li>
                  <li>• <strong>Suggest workarounds</strong> — sometimes there&apos;s an existing way to solve their problem</li>
                </ul>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Golden rule:</strong> Be a helpful community member first, a marketer second. People can tell the difference between genuine engagement and spam. The best responses add value to the conversation regardless of whether the person becomes a customer.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 5: ALERTS & NOTIFICATIONS ==================== */}
      <section id="alerts" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Alerts & Notifications</h2>
            <p className="text-muted-foreground">Stay informed without constant checking</p>
          </div>
        </div>

        {/* Article: Email Digest */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Digest</CardTitle>
            <CardDescription>
              Daily summary of new mentions delivered to your inbox
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Email digests are the easiest way to stay on top of new mentions without constantly checking the dashboard. Configure them once and get a daily summary at your preferred time.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Setting Up Email Digest</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Go to <strong>Settings</strong></li>
                <li>Scroll to <strong>Notifications</strong> section</li>
                <li>Toggle <strong>Email Digest</strong> on</li>
                <li>Select your preferred delivery time (based on your timezone)</li>
                <li>Save changes</li>
              </ol>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Digests only send when there are new results to report. If no new mentions were found, you won&apos;t receive an email — no spam.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Slack & Discord */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Slack & Discord Integration
              <Badge variant="secondary" className="ml-2">Pro</Badge>
            </CardTitle>
            <CardDescription>
              Get instant notifications in your team&apos;s chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Connect Kaulby to Slack or Discord to receive instant notifications when new mentions appear. Perfect for teams who want to respond quickly to customer conversations.
            </p>

            {/* Slack Setup */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-[#4A154B] flex items-center justify-center text-white text-xs font-bold">S</span>
                Slack Setup
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">api.slack.com/apps <ExternalLink className="h-3 w-3" /></a></li>
                <li>Click <strong>&quot;Create New App&quot;</strong> → <strong>&quot;From scratch&quot;</strong></li>
                <li>Name it (e.g., &quot;Kaulby Alerts&quot;) and select your workspace</li>
                <li>Go to <strong>Incoming Webhooks</strong> in the sidebar and toggle it <strong>On</strong></li>
                <li>Click <strong>&quot;Add New Webhook to Workspace&quot;</strong> and select a channel</li>
                <li>Copy the Webhook URL (starts with <code className="px-1 py-0.5 bg-muted rounded text-xs">https://hooks.slack.com/...</code>)</li>
                <li>In Kaulby, go to <strong>Settings → Notifications</strong> and paste the URL</li>
              </ol>
            </div>

            {/* Discord Setup */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">D</span>
                Discord Setup
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                <li>Open Discord and go to your server <strong>Settings</strong></li>
                <li>Click <strong>Integrations</strong> → <strong>Webhooks</strong> → <strong>New Webhook</strong></li>
                <li>Name it and select the target channel</li>
                <li>Click <strong>&quot;Copy Webhook URL&quot;</strong></li>
                <li><strong>Important:</strong> Add <code className="px-1 py-0.5 bg-muted rounded text-xs">/slack</code> to the end of the URL</li>
                <li>Example: <code className="px-1 py-0.5 bg-muted rounded text-xs text-[10px]">https://discord.com/api/webhooks/.../slack</code></li>
                <li>Paste this modified URL in Kaulby Settings</li>
              </ol>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Why /slack?</strong> Discord supports Slack-compatible webhooks. Adding <code>/slack</code> enables compatibility mode so our messages display correctly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Article: Webhooks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks
              <Badge variant="secondary" className="ml-2">Team</Badge>
            </CardTitle>
            <CardDescription>
              Send data to your own systems for custom integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Webhooks allow you to receive real-time data when new results are found, enabling custom integrations with your CRM, support system, or internal tools.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Setting Up Webhooks</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Go to <strong>Settings → Webhooks</strong></li>
                <li>Click <strong>Add Webhook</strong></li>
                <li>Enter your endpoint URL (must be HTTPS)</li>
                <li>Select which events to receive</li>
                <li>Optionally add a secret for signature verification</li>
                <li>Save and use the &quot;Test&quot; button to verify</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Webhook Payload</h4>
              <div className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto">
                <pre>{`{
  "event": "new_result",
  "monitor_id": "mon_abc123",
  "result": {
    "id": "res_xyz789",
    "platform": "reddit",
    "title": "Looking for alternatives to...",
    "sentiment": "neutral",
    "category": "solution_request",
    "url": "https://reddit.com/...",
    "created_at": "2024-01-15T10:30:00Z"
  }
}`}</pre>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Use Cases</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Create leads in your CRM (HubSpot, Salesforce) when someone asks for recommendations</li>
                <li>Create support tickets when negative sentiment is detected</li>
                <li>Trigger Zapier or Make automations</li>
                <li>Feed data into your analytics pipeline</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 6: API ACCESS ==================== */}
      <section id="api" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              API Access
              <Badge variant="secondary">Team Plan</Badge>
            </h2>
            <p className="text-muted-foreground">Build custom integrations with the Kaulby API</p>
          </div>
        </div>

        {/* Article: Getting Started with API */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Getting Your API Key</CardTitle>
            <CardDescription>
              Generate and manage API keys for programmatic access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              <li>Go to <strong>Settings</strong> → scroll to <strong>API Access</strong></li>
              <li>Click <strong>Create API Key</strong></li>
              <li>Give your key a descriptive name (e.g., &quot;Production App&quot;, &quot;Zapier Integration&quot;)</li>
              <li><strong>Copy the key immediately</strong> — it won&apos;t be shown again</li>
              <li>Store it securely in your environment variables — never commit it to code</li>
            </ol>

            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Security:</strong> Treat your API key like a password. If compromised, revoke it immediately in Settings and create a new one.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: API Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Endpoints</CardTitle>
            <CardDescription>
              Available endpoints and how to use them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">Authentication</h4>
              <p className="text-sm text-muted-foreground">Include your API key in the Authorization header:</p>
              <div className="p-3 rounded-lg bg-muted font-mono text-xs">
                Authorization: Bearer kaulby_live_your_key_here
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Endpoints</h4>
              <div className="space-y-2">
                <div className="p-3 rounded-lg border">
                  <p className="font-mono text-sm font-medium">GET /api/v1/monitors</p>
                  <p className="text-xs text-muted-foreground mt-1">List all monitors. Supports <code>?limit</code>, <code>?offset</code>, <code>?active</code></p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-mono text-sm font-medium">POST /api/v1/monitors</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a new monitor</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-mono text-sm font-medium">GET /api/v1/results</p>
                  <p className="text-xs text-muted-foreground mt-1">List results. Supports <code>?monitor_id</code>, <code>?platform</code>, <code>?sentiment</code>, <code>?from</code>, <code>?to</code></p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-mono text-sm font-medium">GET /api/v1/usage</p>
                  <p className="text-xs text-muted-foreground mt-1">Get your current usage statistics and limits</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Rate Limits</h4>
              <p className="text-sm text-muted-foreground">
                API access is limited to <strong>10,000 requests per day</strong>. The limit resets at midnight UTC. Check your remaining quota via the usage endpoint.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Example Request</h4>
              <div className="p-3 rounded-lg bg-muted font-mono text-xs overflow-x-auto">
                <pre>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://kaulbyapp.com/api/v1/results?limit=10&sentiment=negative"`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 7: BILLING & PLANS ==================== */}
      <section id="billing" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Billing & Plans</h2>
            <p className="text-muted-foreground">Understand pricing and manage your subscription</p>
          </div>
        </div>

        {/* Article: Plan Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan Comparison</CardTitle>
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
                    <td className="text-center py-3 px-4 bg-primary/5">All 12</td>
                    <td className="text-center py-3 px-4">All 12</td>
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
                    <td className="py-3 pr-4">Slack/Discord</td>
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
              All paid plans include a 14-day free trial. Annual billing saves 2 months. Additional team members are $15/user/month.
            </p>
          </CardContent>
        </Card>

        {/* Article: Day Pass */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Day Pass
            </CardTitle>
            <CardDescription>
              24-hour access to Pro features without a subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Need Pro features for a quick project? The Day Pass gives you 24 hours of Pro-level access for a one-time fee — no subscription required.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">What&apos;s Included</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Up to 10 monitors during your 24-hour window</li>
                <li>Access to all 12 platforms</li>
                <li>Unlimited AI analysis</li>
                <li>20 keywords per monitor</li>
                <li>CSV export</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Best for:</strong> One-time competitor research, pre-launch brand monitoring setup, or trying Pro features before committing to a subscription.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Article: Managing Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Managing Your Subscription</CardTitle>
            <CardDescription>
              Upgrade, downgrade, or cancel anytime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">Upgrading</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Go to <strong>Settings</strong></li>
                <li>Find your current plan in the <strong>Subscription</strong> section</li>
                <li>Click <strong>Upgrade</strong> on the plan you want</li>
                <li>Complete checkout — new features are available immediately</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Downgrading or Canceling</h4>
              <p className="text-sm text-muted-foreground">
                You can cancel anytime from Settings. Your subscription remains active until the end of your billing period. If you downgrade, features beyond your new plan&apos;s limits become read-only (you won&apos;t lose data).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> If you have more monitors than your new plan allows, the excess monitors will be paused (not deleted). You can reactivate them if you upgrade again.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 8: TEAM MANAGEMENT ==================== */}
      <section id="team" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              Team Management
              <Badge variant="secondary">Team Plan</Badge>
            </h2>
            <p className="text-muted-foreground">Collaborate with your team on monitoring</p>
          </div>
        </div>

        {/* Article: Team Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setting Up Your Workspace</CardTitle>
            <CardDescription>
              Create a shared workspace for your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The Team plan allows multiple people to access your Kaulby account. All team members share monitors, results, and settings — perfect for marketing, product, and support teams working together.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Creating a Workspace</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Upgrade to the Team plan (or start a trial)</li>
                <li>Go to <strong>Settings</strong> → <strong>Team</strong></li>
                <li>Your workspace is automatically created</li>
                <li>Start inviting team members</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Article: Inviting Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inviting Team Members</CardTitle>
            <CardDescription>
              Add colleagues to your workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">How to Invite</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Go to <strong>Settings</strong> → <strong>Team</strong></li>
                <li>Enter the email address of the person you want to invite</li>
                <li>Click <strong>Invite</strong></li>
                <li>They&apos;ll receive an email with a link to join</li>
                <li>Once they accept, they have access to all monitors and results</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Roles</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>Owner:</strong> Full access including billing, member management, and account deletion</li>
                <li><strong>Member:</strong> Can view and manage monitors and results, but cannot access billing or manage other members</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Seats:</strong> Team plan includes 5 seats. Additional members are $15/user/month. Remove members anytime from the Team settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 9: ACCOUNT & SETTINGS ==================== */}
      <section id="account" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Account & Settings</h2>
            <p className="text-muted-foreground">Manage your account preferences and data</p>
          </div>
        </div>

        {/* Article: Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Settings</CardTitle>
            <CardDescription>
              Configure your account preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">Available Settings</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>Timezone:</strong> Set your timezone for email digest delivery (sent at 9 AM your time)</li>
                <li><strong>Email Preferences:</strong> Control which emails you receive</li>
                <li><strong>Profile:</strong> Update your name and profile picture via Clerk</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Article: Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              Data Export
            </CardTitle>
            <CardDescription>
              Download your data anytime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your data belongs to you. Export it anytime for backup, analysis, or migration purposes.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">Export Options</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li><strong>Full Export (JSON):</strong> Complete data including monitors, results, settings, and AI analysis</li>
                <li><strong>Results Only (CSV):</strong> Spreadsheet-friendly format for analysis in Excel or Google Sheets (Pro/Team)</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">How to Export</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Go to <strong>Settings</strong></li>
                <li>Scroll to <strong>Your Data</strong> section</li>
                <li>Click <strong>Export Data</strong></li>
                <li>Select your preferred format</li>
                <li>Download starts automatically</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Article: Account Deletion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Account Deletion
            </CardTitle>
            <CardDescription>
              Permanently delete your account and data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you decide to leave Kaulby, you can request account deletion from Settings. This process is designed to prevent accidents while respecting your right to be forgotten.
            </p>

            <div className="space-y-3">
              <h4 className="font-medium">What Happens When You Delete</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Your request is queued for 7 days (you can cancel during this period)</li>
                <li>After 7 days, ALL your data is permanently deleted</li>
                <li>This includes: monitors, results, AI analysis, settings, API keys, and team data</li>
                <li>Any active subscription is canceled</li>
                <li>This action is irreversible</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Recommendation:</strong> Export your data before requesting deletion. Once deleted, we cannot recover any information.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ==================== SECTION 10: TROUBLESHOOTING ==================== */}
      <section id="troubleshooting" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Troubleshooting</h2>
            <p className="text-muted-foreground">Common issues and how to resolve them</p>
          </div>
        </div>

        {/* Article: Common Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Common Issues</CardTitle>
            <CardDescription>
              Quick solutions to frequent problems
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">No results appearing for my monitor</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Wait for the first scan:</strong> New monitors can take up to 24 hours (Free) or 4 hours (Pro) for first results</li>
                  <li>• <strong>Check your keywords:</strong> May be too specific — try broader terms</li>
                  <li>• <strong>Verify platforms:</strong> Ensure the platforms you selected are active and included in your plan</li>
                  <li>• <strong>Low volume topic:</strong> Some topics simply don&apos;t have many public discussions</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Slack/Discord notifications not working</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Check webhook URL:</strong> Verify it&apos;s correct and complete</li>
                  <li>• <strong>Discord users:</strong> Make sure you added <code className="px-1 py-0.5 bg-muted rounded text-xs">/slack</code> to the end of the URL</li>
                  <li>• <strong>Permissions:</strong> Ensure the webhook has permission to post to the channel</li>
                  <li>• <strong>Test it:</strong> Use the &quot;Test&quot; button in Settings to verify the connection</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">API key not working</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Plan check:</strong> API access requires the Team plan</li>
                  <li>• <strong>Header format:</strong> Use <code className="px-1 py-0.5 bg-muted rounded text-xs">Authorization: Bearer kaulby_live_xxx</code></li>
                  <li>• <strong>Key status:</strong> Verify the key hasn&apos;t been revoked in Settings</li>
                  <li>• <strong>Rate limits:</strong> Check if you&apos;ve hit the daily limit (10,000 requests)</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Email digest not arriving</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Check spam:</strong> Look in your spam/junk folder</li>
                  <li>• <strong>Timezone:</strong> Verify your timezone is correct in Settings</li>
                  <li>• <strong>No new results:</strong> Digests only send when there are new mentions</li>
                  <li>• <strong>Whitelist us:</strong> Add <code className="px-1 py-0.5 bg-muted rounded text-xs">noreply@kaulbyapp.com</code> to your contacts</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Results seem outdated</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Refresh cycles:</strong> Free: 24hr, Pro: 4hr, Team: 2hr — check your plan</li>
                  <li>• <strong>Manual refresh:</strong> Click the refresh icon on a monitor to trigger an immediate scan</li>
                  <li>• <strong>Platform delays:</strong> Some platforms have inherent delays in indexing new content</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Review platform not finding my business</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Correct URL format:</strong> Copy the exact URL from the platform (Google Maps, Trustpilot, G2, etc.)</li>
                  <li>• <strong>Public listing:</strong> Ensure your business listing is publicly visible and not restricted</li>
                  <li>• <strong>Recently created:</strong> New listings may take time to be indexed by the platform</li>
                  <li>• <strong>URL vs keywords:</strong> Review platforms need specific URLs, not keyword searches</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Getting irrelevant results</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Keywords too broad:</strong> &quot;App&quot; or &quot;software&quot; matches too much — be specific</li>
                  <li>• <strong>Common word conflicts:</strong> If your brand name is a common word, add context keywords</li>
                  <li>• <strong>Hide irrelevant:</strong> Click &quot;Hide&quot; on results you don&apos;t want to see — we learn from this</li>
                  <li>• <strong>Use audiences:</strong> Segment monitors by topic to better organize results</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Monitor limit reached</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Free plan:</strong> Limited to 1 monitor — upgrade to Pro (10) or Team (30)</li>
                  <li>• <strong>Delete unused:</strong> Remove monitors you no longer need to make room</li>
                  <li>• <strong>Combine keywords:</strong> One monitor can track multiple keywords (3 Free, 20 Pro, 35 Team)</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Can&apos;t access certain platforms</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Plan restrictions:</strong> Free users only have Reddit access — upgrade for all 12 platforms</li>
                  <li>• <strong>Grayed out:</strong> Platforms showing as locked require Pro or Team plan</li>
                  <li>• <strong>Day Pass:</strong> Need temporary access? Buy a 24-hour Day Pass for $9</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </section>

      {/* ==================== SECTION 11: CONTACT SUPPORT ==================== */}
      <section id="contact" className="scroll-mt-20 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Contact Support</h2>
            <p className="text-muted-foreground">Can&apos;t find what you need? We&apos;re here to help.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Submit a Support Ticket
            </CardTitle>
            <CardDescription>
              Describe your issue and we&apos;ll get back to you within 24 hours. Team customers receive priority support.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {submitStatus.type === "success" ? (
              <div className="p-6 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Message Sent!</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                  {submitStatus.message}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSubmitStatus({ type: null, message: "" })}
                >
                  Submit Another Request
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formState.category}
                    onValueChange={(value) => setFormState({ ...formState, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="What can we help with?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                      <SelectItem value="Billing Question">Billing Question</SelectItem>
                      <SelectItem value="Feature Request">Feature Request</SelectItem>
                      <SelectItem value="Account Help">Account Help</SelectItem>
                      <SelectItem value="Platform/Integration">Platform / Integration</SelectItem>
                      <SelectItem value="General Question">General Question</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={formState.subject}
                    onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or relevant context that might help us assist you faster."
                    className="min-h-[150px]"
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formState.message.length}/5000
                  </p>
                </div>

                {submitStatus.type === "error" && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200">{submitStatus.message}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Or email us directly at{" "}
                    <a href="mailto:support@kaulbyapp.com" className="text-primary hover:underline">
                      support@kaulbyapp.com
                    </a>
                  </p>
                  <Button
                    onClick={handleSubmitTicket}
                    disabled={isPending || !formState.category || !formState.subject || !formState.message}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Before You Contact Us</CardTitle>
            <CardDescription>
              Quick things to check that might resolve your issue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-lg border">
                <p className="font-medium text-sm mb-1">No results appearing?</p>
                <p className="text-xs text-muted-foreground">
                  Wait for the first scan (up to 24hrs on Free), check keywords aren&apos;t too specific, verify platforms match your plan
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium text-sm mb-1">Notifications not working?</p>
                <p className="text-xs text-muted-foreground">
                  Check Settings → Notifications, verify webhook URLs, ensure digests are enabled
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium text-sm mb-1">AI analysis locked?</p>
                <p className="text-xs text-muted-foreground">
                  Free users get analysis on first result only. Upgrade to Pro or Team for unlimited AI insights
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium text-sm mb-1">Billing or subscription issue?</p>
                <p className="text-xs text-muted-foreground">
                  Go to Settings → Subscription to manage your plan, update payment, or view invoices
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

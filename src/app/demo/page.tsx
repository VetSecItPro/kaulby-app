"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  BarChart3,
  Lightbulb,
  PlusCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  Target,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  CircleDollarSign,
  Users,
  BookOpen,
  Zap,
  Settings,
  Bookmark,
  CreditCard,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type DemoView = "overview" | "monitors" | "results" | "insights" | "analytics";

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_BADGES: Record<string, { label: string; color: string }> = {
  reddit: { label: "Reddit", color: "bg-orange-500/10 text-orange-500" },
  hackernews: { label: "Hacker News", color: "bg-amber-500/10 text-amber-500" },
  trustpilot: { label: "Trustpilot", color: "bg-emerald-500/10 text-emerald-500" },
  g2: { label: "G2", color: "bg-red-700/10 text-red-400" },
  googlereviews: { label: "Google Reviews", color: "bg-blue-500/10 text-blue-500" },
  youtube: { label: "YouTube", color: "bg-red-500/10 text-red-500" },
  producthunt: { label: "Product Hunt", color: "bg-red-500/10 text-red-400" },
  x: { label: "X (Twitter)", color: "bg-zinc-800/10 text-zinc-300" },
  github: { label: "GitHub", color: "bg-gray-200/10 text-gray-300" },
};

const NAV_ITEMS = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "monitors" as const, label: "Monitors", icon: Radio },
  { id: "results" as const, label: "Results", icon: MessageSquare },
  { id: "insights" as const, label: "Insights", icon: Lightbulb },
  { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
];

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_MONITORS = [
  {
    id: "mon-1",
    name: "Brand Mentions",
    keywords: ["kaulby", "kaulby.com", "kaulby app"],
    platforms: ["reddit", "hackernews", "trustpilot", "g2", "youtube"],
    isActive: true,
    lastCheckedAt: "12 minutes ago",
    newMatchCount: 14,
  },
  {
    id: "mon-2",
    name: "Competitor Watch",
    keywords: ["mention", "brand24", "brandwatch"],
    platforms: ["reddit", "producthunt", "g2", "x"],
    isActive: true,
    lastCheckedAt: "28 minutes ago",
    newMatchCount: 7,
  },
  {
    id: "mon-3",
    name: "Industry Pain Points",
    keywords: ["social listening tool", "monitor brand mentions", "track online reviews"],
    platforms: ["reddit", "hackernews", "googlereviews", "trustpilot"],
    isActive: true,
    lastCheckedAt: "1 hour ago",
    newMatchCount: 3,
  },
  {
    id: "mon-4",
    name: "Review Monitoring",
    keywords: ["monitoring software review", "best monitoring tool"],
    platforms: ["trustpilot", "g2", "googlereviews", "youtube"],
    isActive: false,
    lastCheckedAt: "3 hours ago",
    newMatchCount: 0,
  },
];

const DEMO_RESULTS = [
  {
    id: "res-1",
    platform: "reddit",
    title: "What's the best tool for monitoring brand mentions across Reddit and review sites?",
    author: "u/saas_founder_22",
    postedAt: "2 hours ago",
    sentiment: "neutral" as const,
    conversationCategory: "solution_request" as const,
    leadScore: 82,
    aiSummary: "Founder looking for comprehensive brand monitoring. Currently using Google Alerts but frustrated with lack of Reddit coverage. Budget: $50-100/mo. Evaluating 3 tools this week.",
    isViewed: false,
    monitor: "Brand Mentions",
  },
  {
    id: "res-2",
    platform: "trustpilot",
    title: "Great tool but pricing is confusing - 3 stars",
    author: "Sarah M.",
    postedAt: "5 hours ago",
    sentiment: "negative" as const,
    conversationCategory: "pain_point" as const,
    leadScore: 35,
    aiSummary: "User loves the platform detection but finds tier pricing confusing. Specifically mentions wanting a middle-ground between free and pro plans. Competitor comparison to Brand24.",
    isViewed: true,
    monitor: "Brand Mentions",
  },
  {
    id: "res-3",
    platform: "hackernews",
    title: "Show HN: I built an open-source alternative to Mention.com",
    author: "techbuilder",
    postedAt: "8 hours ago",
    sentiment: "positive" as const,
    conversationCategory: "hot_discussion" as const,
    leadScore: 45,
    aiSummary: "HN post about open-source monitoring tool getting traction. 47 comments, mostly positive. Several users comparing features to commercial tools. Good competitive intelligence.",
    isViewed: true,
    monitor: "Competitor Watch",
  },
  {
    id: "res-4",
    platform: "g2",
    title: "Best social listening tool for small teams - detailed comparison",
    author: "Verified User",
    postedAt: "1 day ago",
    sentiment: "positive" as const,
    conversationCategory: "money_talk" as const,
    leadScore: 91,
    aiSummary: "Detailed G2 review comparing 5 social listening tools. Mentions budget allocation of $200/mo for team of 8. High buying intent — requesting demos from top 2 picks.",
    isViewed: false,
    monitor: "Industry Pain Points",
  },
  {
    id: "res-5",
    platform: "googlereviews",
    title: "Amazing customer support but needs more integrations",
    author: "Mike Johnson",
    postedAt: "1 day ago",
    sentiment: "positive" as const,
    conversationCategory: "advice_request" as const,
    leadScore: 28,
    aiSummary: "Google review praising support team responsiveness. Feature request for Slack and Zapier integrations. Mentions switching from a competitor due to poor support.",
    isViewed: true,
    monitor: "Review Monitoring",
  },
  {
    id: "res-6",
    platform: "youtube",
    title: "Top 5 Brand Monitoring Tools in 2026 (Honest Review)",
    author: "TechReviewer Pro",
    postedAt: "2 days ago",
    sentiment: "positive" as const,
    conversationCategory: "hot_discussion" as const,
    leadScore: 55,
    aiSummary: "YouTube video review covering top monitoring tools. 12K views, 340 comments. Positive sentiment in comments about AI-powered features. Mentions Kaulby at #3 position.",
    isViewed: false,
    monitor: "Brand Mentions",
  },
  {
    id: "res-7",
    platform: "x",
    title: "Tired of paying $300/mo for Brand24. Anyone know a cheaper alternative that actually works?",
    author: "@startup_maya",
    postedAt: "3 days ago",
    sentiment: "negative" as const,
    conversationCategory: "solution_request" as const,
    leadScore: 88,
    aiSummary: "Strong buying signal. User actively looking to switch from Brand24 due to pricing. 23 replies with various suggestions. Direct engagement opportunity.",
    isViewed: false,
    monitor: "Competitor Watch",
  },
  {
    id: "res-8",
    platform: "producthunt",
    title: "Just launched: AI-powered review aggregator for SaaS companies",
    author: "Alex Chen",
    postedAt: "3 days ago",
    sentiment: "neutral" as const,
    conversationCategory: "hot_discussion" as const,
    leadScore: 40,
    aiSummary: "Product Hunt launch of competitor tool. 180 upvotes, 34 comments. Feature comparison shows overlap in review monitoring but lacks multi-platform support.",
    isViewed: true,
    monitor: "Competitor Watch",
  },
];

const DEMO_PAIN_POINTS = [
  {
    category: "pricing_concern",
    label: "Pricing & Value",
    description: "Users find pricing tiers confusing or too expensive compared to competitors",
    severity: 85,
    count: 18,
    trend: "rising" as const,
    platforms: ["Reddit", "Trustpilot", "G2"],
    keywords: ["expensive", "pricing", "cost", "free tier", "budget"],
  },
  {
    category: "feature_request",
    label: "Missing Integrations",
    description: "Strong demand for Slack, Zapier, and webhook integrations for real-time alerts",
    severity: 72,
    count: 14,
    trend: "rising" as const,
    platforms: ["Reddit", "Hacker News", "G2"],
    keywords: ["slack integration", "zapier", "webhook", "notifications"],
  },
  {
    category: "support_need",
    label: "Onboarding Friction",
    description: "New users struggle with initial setup, especially keyword configuration and platform selection",
    severity: 60,
    count: 9,
    trend: "stable" as const,
    platforms: ["Trustpilot", "Google Reviews"],
    keywords: ["setup", "confusing", "hard to use", "documentation"],
  },
  {
    category: "competitor_mention",
    label: "Competitor Comparisons",
    description: "Frequent mentions of Brand24, Mention.com, and Brandwatch in comparison discussions",
    severity: 55,
    count: 22,
    trend: "stable" as const,
    platforms: ["Reddit", "G2", "Product Hunt"],
    keywords: ["brand24", "mention", "brandwatch", "alternative"],
  },
  {
    category: "negative_experience",
    label: "Data Accuracy",
    description: "Some users report missing mentions or delayed results from specific platforms",
    severity: 45,
    count: 6,
    trend: "falling" as const,
    platforms: ["Reddit", "Trustpilot"],
    keywords: ["missing results", "delayed", "inaccurate", "not found"],
  },
];

const DEMO_RECOMMENDATIONS = [
  {
    title: "Launch Slack Integration to Address Top Pain Point",
    description: "14 mentions requesting Slack integration in the last 30 days. This is your highest-impact feature gap.",
    priority: "critical" as const,
    category: "product",
    impact: "Could reduce churn by ~15% and convert 8 identified leads requesting this feature",
    effort: "moderate" as const,
    actions: [
      "Build Slack webhook notification channel",
      "Add Slack OAuth for workspace-level alerts",
      "Create channel-specific alert routing",
    ],
  },
  {
    title: "Simplify Pricing Page with Comparison Table",
    description: "18 mentions about pricing confusion. Users can't quickly determine which plan fits their needs.",
    priority: "high" as const,
    category: "pricing",
    impact: "Expected 20% improvement in free-to-paid conversion rate",
    effort: "quick_win" as const,
    actions: [
      "Add interactive pricing comparison table",
      "Show feature differences visually",
      "Add 'recommended' badge to Pro tier",
    ],
  },
  {
    title: "Create Video Onboarding Series",
    description: "9 reviews mention onboarding friction. Short walkthrough videos could significantly reduce support tickets.",
    priority: "medium" as const,
    category: "documentation",
    impact: "Reduce support tickets by ~30% and improve Day 1 retention",
    effort: "moderate" as const,
    actions: [
      "Record 3-minute quickstart video",
      "Add interactive setup wizard tips",
      "Create platform-specific configuration guides",
    ],
  },
];

const DEMO_TRENDING_TOPICS = [
  {
    topic: "AI-powered monitoring",
    platforms: ["Reddit", "Hacker News", "Product Hunt"],
    sentiment: { positive: 65, negative: 10, neutral: 25 },
    trend: "rising" as const,
    resultCount: 28,
  },
  {
    topic: "Review management tools",
    platforms: ["G2", "Trustpilot", "Google Reviews"],
    sentiment: { positive: 40, negative: 35, neutral: 25 },
    trend: "stable" as const,
    resultCount: 19,
  },
  {
    topic: "Brand reputation crisis",
    platforms: ["Reddit", "X (Twitter)", "YouTube"],
    sentiment: { positive: 15, negative: 60, neutral: 25 },
    trend: "rising" as const,
    resultCount: 12,
  },
  {
    topic: "Social listening ROI",
    platforms: ["Reddit", "Hacker News"],
    sentiment: { positive: 50, negative: 20, neutral: 30 },
    trend: "falling" as const,
    resultCount: 8,
  },
];

const ANALYTICS_DAILY_DATA = [
  { day: "Mon", count: 18 },
  { day: "Tue", count: 24 },
  { day: "Wed", count: 31 },
  { day: "Thu", count: 22 },
  { day: "Fri", count: 42 },
  { day: "Sat", count: 15 },
  { day: "Sun", count: 12 },
];

const ANALYTICS_PLATFORMS = [
  { platform: "Reddit", count: 38, color: "bg-orange-500" },
  { platform: "Trustpilot", count: 22, color: "bg-emerald-500" },
  { platform: "G2", count: 18, color: "bg-red-500" },
  { platform: "Hacker News", count: 15, color: "bg-amber-500" },
  { platform: "Google Reviews", count: 12, color: "bg-blue-500" },
  { platform: "YouTube", count: 9, color: "bg-red-400" },
  { platform: "X (Twitter)", count: 7, color: "bg-zinc-400" },
  { platform: "Product Hunt", count: 5, color: "bg-red-600" },
];

// ============================================================================
// CONVERSATION CATEGORY STYLES
// ============================================================================

const categoryStyles: Record<string, { bg: string; text: string; label: string; Icon: typeof Target }> = {
  solution_request: { bg: "bg-green-900/30", text: "text-green-300", label: "Looking for Solution", Icon: Target },
  money_talk: { bg: "bg-amber-900/30", text: "text-amber-300", label: "Budget Talk", Icon: DollarSign },
  pain_point: { bg: "bg-red-900/30", text: "text-red-300", label: "Pain Point", Icon: AlertTriangle },
  advice_request: { bg: "bg-blue-900/30", text: "text-blue-300", label: "Seeking Advice", Icon: HelpCircle },
  hot_discussion: { bg: "bg-purple-900/30", text: "text-purple-300", label: "Trending", Icon: TrendingUp },
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-red-500 text-white", label: "Critical" },
  high: { color: "bg-orange-500 text-white", label: "High" },
  medium: { color: "bg-yellow-500 text-black", label: "Medium" },
  low: { color: "bg-blue-500 text-white", label: "Low" },
};

const effortLabels: Record<string, string> = {
  quick_win: "Quick Win",
  moderate: "Moderate Effort",
  significant: "Significant Effort",
};

const categoryIcons: Record<string, { Icon: typeof ShieldAlert; color: string }> = {
  negative_experience: { Icon: ShieldAlert, color: "text-red-500" },
  support_need: { Icon: Wrench, color: "text-orange-500" },
  pricing_concern: { Icon: CircleDollarSign, color: "text-yellow-500" },
  competitor_mention: { Icon: Users, color: "text-blue-500" },
  feature_request: { Icon: Lightbulb, color: "text-purple-500" },
  general_discussion: { Icon: MessageSquare, color: "text-gray-500" },
};

const recCategoryIcons: Record<string, { Icon: typeof Users; color: string }> = {
  customer_service: { Icon: Users, color: "text-blue-500" },
  product: { Icon: Wrench, color: "text-purple-500" },
  pricing: { Icon: CircleDollarSign, color: "text-yellow-500" },
  reputation: { Icon: ShieldAlert, color: "text-red-500" },
  competitive: { Icon: Target, color: "text-orange-500" },
  documentation: { Icon: BookOpen, color: "text-green-500" },
};

// ============================================================================
// SENTIMENT ICONS
// ============================================================================

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === "positive") return <ThumbsUp className="h-4 w-4 text-green-500" />;
  if (sentiment === "negative") return <ThumbsDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-500" />;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "rising") return <TrendingUp className="h-4 w-4 text-red-400" />;
  if (trend === "falling") return <TrendingDown className="h-4 w-4 text-green-400" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function LeadScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400 bg-green-900/30 border-green-700/30"
    : score >= 50 ? "text-yellow-400 bg-yellow-900/30 border-yellow-700/30"
    : "text-gray-400 bg-gray-900/30 border-gray-700/30";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", color)}>
      <Zap className="h-3 w-3" />
      {score}
    </span>
  );
}

// ============================================================================
// SIDEBAR (recreated without auth)
// ============================================================================

function DemoSidebar({ activeView, onViewChange }: { activeView: DemoView; onViewChange: (v: DemoView) => void }) {
  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/40">
      {/* Logo */}
      <div className="border-b px-4">
        <div className="flex h-14 items-center">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={28}
                height={28}
                className="object-cover w-full h-full"
                priority
              />
            </div>
            <span className="text-xl gradient-text">Kaulby</span>
          </Link>
        </div>
        {/* Plan badge */}
        <div className="flex items-center gap-1.5 pb-3 -mt-1">
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-teal-500 text-black">
            Pro
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wide rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            DEMO
          </span>
        </div>
      </div>

      {/* User section */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
            D
          </div>
          <span className="text-sm font-medium truncate max-w-[140px]">Demo User</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                data-view={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors text-left",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}

          {/* Extra nav items (non-interactive) */}
          {[
            { icon: Sparkles, label: "Ask Kaulby AI" },
            { icon: Bookmark, label: "Bookmarks" },
            { icon: Settings, label: "Settings" },
          ].map((item) => (
            <span
              key={item.label}
              className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground/50 cursor-default"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </span>
          ))}
        </nav>
      </div>

      {/* Upgrade link */}
      <div className="px-2 pb-2">
        <Link
          href="/pricing"
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Upgrade Plan
        </Link>
      </div>

      {/* CTA */}
      <div className="border-t px-4 py-3">
        <Link href="/sign-up">
          <Button className="w-full gap-2" size="sm">
            <Sparkles className="h-4 w-4" />
            Start Free
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// MOBILE HEADER (for small screens)
// ============================================================================

function DemoMobileHeader({ activeView, onViewChange }: { activeView: DemoView; onViewChange: (v: DemoView) => void }) {
  return (
    <div className="border-b bg-background px-4 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg overflow-hidden bg-black flex items-center justify-center">
            <Image src="/logo.jpg" alt="Kaulby" width={24} height={24} className="object-cover w-full h-full" />
          </div>
          <span className="text-lg font-semibold gradient-text">Kaulby</span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wide rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            DEMO
          </span>
        </div>
        <Link href="/sign-up">
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
            <Sparkles className="h-3 w-3" />
            Sign Up
          </Button>
        </Link>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeView === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// VIEW: OVERVIEW
// ============================================================================

function OverviewView({ onViewChange }: { onViewChange: (v: DemoView) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Monitor conversations about your brand across the web.
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          New Monitor
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">Active Monitors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">Total Results</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">52%</div>
            <p className="text-xs text-muted-foreground">Positive Sentiment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">8</div>
            <p className="text-xs text-muted-foreground">Unread Mentions</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onViewChange("results")}>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="rounded-full bg-blue-500/10 p-3">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">8 Unread Results</p>
              <p className="text-sm text-muted-foreground">3 high-intent leads detected</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onViewChange("insights")}>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="rounded-full bg-purple-500/10 p-3">
              <Lightbulb className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium">5 Pain Points</p>
              <p className="text-sm text-muted-foreground">2 trending this week</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onViewChange("analytics")}>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="rounded-full bg-green-500/10 p-3">
              <BarChart3 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Analytics</p>
              <p className="text-sm text-muted-foreground">Mention volume up 24%</p>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Recent results preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Mentions</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onViewChange("results")}>
            View All <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid gap-3">
          {DEMO_RESULTS.slice(0, 3).map((result) => (
            <ResultCardCompact key={result.id} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW: MONITORS
// ============================================================================

function MonitorsView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Monitors</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Track keywords and topics across 17 platforms.
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          Create Monitor
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {DEMO_MONITORS.map((monitor) => (
          <Card key={monitor.id} className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className={cn("h-4 w-4", monitor.isActive ? "text-green-500" : "text-gray-500")} />
                  <CardTitle className="text-base">{monitor.name}</CardTitle>
                </div>
                <Badge variant={monitor.isActive ? "default" : "secondary"} className="text-xs">
                  {monitor.isActive ? "Active" : "Paused"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Keywords */}
              <div className="flex flex-wrap gap-1.5">
                {monitor.keywords.map((kw) => (
                  <Badge key={kw} variant="outline" className="text-xs font-normal">
                    {kw}
                  </Badge>
                ))}
              </div>

              {/* Platforms */}
              <div className="flex flex-wrap gap-1.5">
                {monitor.platforms.map((p) => {
                  const badge = PLATFORM_BADGES[p];
                  return badge ? (
                    <span key={p} className={cn("px-2 py-0.5 rounded-full text-xs font-medium", badge.color)}>
                      {badge.label}
                    </span>
                  ) : null;
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Last checked: {monitor.lastCheckedAt}</span>
                {monitor.newMatchCount > 0 && (
                  <Badge className="bg-blue-500 text-white text-xs">
                    {monitor.newMatchCount} new
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// VIEW: RESULTS
// ============================================================================

function ResultCardCompact({ result }: { result: typeof DEMO_RESULTS[0] }) {
  const cat = categoryStyles[result.conversationCategory];
  const platBadge = PLATFORM_BADGES[result.platform];
  const CatIcon = cat?.Icon || Target;

  return (
    <Card className={cn("transition-colors", !result.isViewed && "border-l-2 border-l-blue-500")}>
      <CardContent className="py-4 space-y-2">
        {/* Top row: platform, sentiment, category, lead score */}
        <div className="flex items-center gap-2 flex-wrap">
          {platBadge && (
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", platBadge.color)}>
              {platBadge.label}
            </span>
          )}
          <SentimentIcon sentiment={result.sentiment} />
          {cat && (
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cat.bg, cat.text)}>
              <CatIcon className="h-3 w-3" />
              {cat.label}
            </span>
          )}
          <div className="ml-auto">
            <LeadScoreBadge score={result.leadScore} />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-sm leading-snug">{result.title}</h3>

        {/* AI Summary */}
        <p className="text-xs text-muted-foreground leading-relaxed">{result.aiSummary}</p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-2">
            <span>{result.author}</span>
            <span>-</span>
            <span>{result.postedAt}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/70">{result.monitor}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsView() {
  const [filter, setFilter] = useState<"all" | "unread" | "saved">("all");

  const filteredResults = filter === "unread"
    ? DEMO_RESULTS.filter((r) => !r.isViewed)
    : DEMO_RESULTS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            AI-analyzed mentions from across the web.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          { key: "all" as const, label: "All", count: 42 },
          { key: "unread" as const, label: "Unread", count: 8 },
          { key: "saved" as const, label: "Saved", count: 3 },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Results list */}
      <div className="grid gap-3">
        {filteredResults.map((result) => (
          <ResultCardCompact key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// VIEW: INSIGHTS (3-tab)
// ============================================================================

function InsightsView({ defaultTab = "pain-points" }: { defaultTab?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          AI-generated analysis of your monitoring data.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pain-points" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pain Points
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="trending" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Trending Topics
          </TabsTrigger>
        </TabsList>

        {/* Pain Points Tab */}
        <TabsContent value="pain-points" className="mt-4 space-y-4">
          {DEMO_PAIN_POINTS.map((pp) => {
            const catIcon = categoryIcons[pp.category] || { Icon: MessageSquare, color: "text-gray-500" };
            const CatIcon = catIcon.Icon;
            return (
              <Card key={pp.category}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <CatIcon className={cn("h-5 w-5", catIcon.color)} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{pp.label}</h3>
                        <div className="flex items-center gap-2">
                          <TrendIcon trend={pp.trend} />
                          <Badge variant="outline" className="text-xs">{pp.count} mentions</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{pp.description}</p>
                      {/* Severity bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">Severity</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              pp.severity >= 70 ? "bg-red-500" : pp.severity >= 50 ? "bg-yellow-500" : "bg-blue-500"
                            )}
                            style={{ width: `${pp.severity}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{pp.severity}</span>
                      </div>
                      {/* Platforms */}
                      <div className="flex flex-wrap gap-1">
                        {pp.platforms.map((p) => (
                          <span key={p} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="mt-4 space-y-4">
          {DEMO_RECOMMENDATIONS.map((rec) => {
            const recIcon = recCategoryIcons[rec.category] || { Icon: Target, color: "text-gray-500" };
            const RecIcon = recIcon.Icon;
            const priority = priorityConfig[rec.priority] || priorityConfig.medium;
            return (
              <Card key={rec.title}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <RecIcon className={cn("h-5 w-5", recIcon.color)} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium">{rec.title}</h3>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", priority.color)}>
                          {priority.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      <div className="text-sm">
                        <span className="font-medium text-green-400">Impact:</span>{" "}
                        <span className="text-muted-foreground">{rec.impact}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{effortLabels[rec.effort]}</Badge>
                      </div>
                      {/* Action items */}
                      <div className="space-y-1">
                        {rec.actions.map((action, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Trending Topics Tab */}
        <TabsContent value="trending" className="mt-4 space-y-4">
          {DEMO_TRENDING_TOPICS.map((topic) => (
            <Card key={topic.topic}>
              <CardContent className="py-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{topic.topic}</h3>
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={topic.trend} />
                      <Badge variant="outline" className="text-xs">{topic.resultCount} results</Badge>
                    </div>
                  </div>

                  {/* Sentiment breakdown bar */}
                  <div className="space-y-1">
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                      <div className="bg-green-500 transition-all" style={{ width: `${topic.sentiment.positive}%` }} />
                      <div className="bg-red-500 transition-all" style={{ width: `${topic.sentiment.negative}%` }} />
                      <div className="bg-gray-500 transition-all" style={{ width: `${topic.sentiment.neutral}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="text-green-400">{topic.sentiment.positive}% positive</span>
                      <span className="text-red-400">{topic.sentiment.negative}% negative</span>
                      <span>{topic.sentiment.neutral}% neutral</span>
                    </div>
                  </div>

                  {/* Platforms */}
                  <div className="flex flex-wrap gap-1">
                    {topic.platforms.map((p) => (
                      <span key={p} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// VIEW: ANALYTICS
// ============================================================================

function AnalyticsView() {
  const maxCount = Math.max(...ANALYTICS_DAILY_DATA.map((d) => d.count));
  const totalPlatformMentions = ANALYTICS_PLATFORMS.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Track mention trends, sentiment patterns, and platform performance over time.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">164</div>
            <p className="text-xs text-muted-foreground">Total Mentions (30d)</p>
            <p className="text-xs text-green-500 mt-1">+24% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">23.4</div>
            <p className="text-xs text-muted-foreground">Avg. Daily Mentions</p>
            <p className="text-xs text-green-500 mt-1">+18% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">52%</div>
            <p className="text-xs text-muted-foreground">Positive Sentiment</p>
            <p className="text-xs text-red-400 mt-1">-3% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">8</div>
            <p className="text-xs text-muted-foreground">Platforms Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Mention volume chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mention Volume (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-48">
            {ANALYTICS_DAILY_DATA.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{d.count}</span>
                <div
                  className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                  style={{ height: `${(d.count / maxCount) * 160}px` }}
                />
                <span className="text-xs text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sentiment breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sentiment Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Positive */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  <span>Positive</span>
                </div>
                <span className="font-medium text-green-500">52%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: "52%" }} />
              </div>
            </div>
            {/* Negative */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span>Negative</span>
                </div>
                <span className="font-medium text-red-500">28%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "28%" }} />
              </div>
            </div>
            {/* Neutral */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-gray-500" />
                  <span>Neutral</span>
                </div>
                <span className="font-medium text-gray-400">20%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gray-500 rounded-full" style={{ width: "20%" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ANALYTICS_PLATFORMS.map((p) => (
              <div key={p.platform} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{p.platform}</span>
                  <span className="text-muted-foreground">{p.count} ({Math.round((p.count / totalPlatformMentions) * 100)}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", p.color)}
                    style={{ width: `${(p.count / ANALYTICS_PLATFORMS[0].count) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DemoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get("view") as DemoView | null;
  const [activeView, setActiveView] = useState<DemoView>(viewParam || "overview");

  // Sync URL → state
  useEffect(() => {
    if (viewParam && viewParam !== activeView) {
      setActiveView(viewParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParam]);

  // Sync state → URL
  const handleViewChange = (view: DemoView) => {
    setActiveView(view);
    router.replace(`/demo?view=${view}`, { scroll: false });
  };

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return <OverviewView onViewChange={handleViewChange} />;
      case "monitors":
        return <MonitorsView />;
      case "results":
        return <ResultsView />;
      case "insights":
        return <InsightsView defaultTab={searchParams.get("tab") || "pain-points"} />;
      case "analytics":
        return <AnalyticsView />;
    }
  };

  return (
    <>
      {/* Mobile Layout */}
      <div className="flex flex-col min-h-screen bg-background lg:hidden">
        <DemoMobileHeader activeView={activeView} onViewChange={handleViewChange} />
        <main className="flex-1 overflow-auto pb-20 px-4 pt-4">
          {renderView()}
        </main>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        <DemoSidebar activeView={activeView} onViewChange={handleViewChange} />
        <div className="flex-1 flex flex-col overflow-auto">
          <main className="flex-1">
            <div className="container py-6 px-4 md:px-8">
              {renderView()}
            </div>
          </main>
          {/* Footer */}
          <div className="border-t px-6 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              This is a demo with sample data.{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up free
              </Link>{" "}
              to start monitoring your brand.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

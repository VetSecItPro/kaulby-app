import { Metadata } from "next";
import {
  CheckCircle2,
  Loader2,
  Calendar,
  HelpCircle,
  Rocket,
  Brain,
  BarChart3,
  Mail,
  Target,
  FileText,
  Webhook,
  Users,
  Search,
  AlertTriangle,
  Award,
  Share2,
  Shield,
  Eye,
  MessageSquare,
  Zap,
  Palette,
  Globe,
  Smartphone,
  History,
  UserSearch,
  Layers,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Product Roadmap | Kaulby",
  description:
    "See what we've shipped, what we're building, and where Kaulby is headed. Follow our public product roadmap for AI-powered community monitoring.",
  openGraph: {
    title: "Product Roadmap | Kaulby",
    description:
      "See what we've shipped, what we're building, and where Kaulby is headed. Follow our public product roadmap for AI-powered community monitoring.",
    url: "https://kaulbyapp.com/roadmap",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/roadmap",
  },
};

type Status = "shipped" | "in-progress" | "planned" | "considering";

interface RoadmapItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface RoadmapCategory {
  status: Status;
  label: string;
  StatusIcon: LucideIcon;
  items: RoadmapItem[];
}

const statusConfig: Record<
  Status,
  { badge: string; dot: string; border: string; bg: string }
> = {
  shipped: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
    border: "border-emerald-500/20",
    bg: "from-emerald-500/5 to-transparent",
  },
  "in-progress": {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dot: "bg-blue-400",
    border: "border-blue-500/20",
    bg: "from-blue-500/5 to-transparent",
  },
  planned: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
    border: "border-amber-500/20",
    bg: "from-amber-500/5 to-transparent",
  },
  considering: {
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    dot: "bg-zinc-400",
    border: "border-zinc-500/20",
    bg: "from-zinc-500/5 to-transparent",
  },
};

const roadmap: RoadmapCategory[] = [
  {
    status: "shipped",
    label: "Recently Shipped",
    StatusIcon: CheckCircle2,
    items: [
      {
        title: "17-Platform Monitoring",
        description:
          "Track mentions across Reddit, Hacker News, Product Hunt, X/Twitter, YouTube, and 12 more platforms from a single dashboard.",
        icon: Globe,
      },
      {
        title: "AI-Powered Sentiment Analysis",
        description:
          "Automatically classify mentions as positive, negative, or neutral with contextual AI that understands nuance.",
        icon: Brain,
      },
      {
        title: "Email Digests",
        description:
          "Receive daily, weekly, or monthly digest emails summarizing new mentions, sentiment shifts, and key insights.",
        icon: Mail,
      },
      {
        title: "Lead Scoring",
        description:
          "Identify high-intent mentions and score potential leads based on buying signals detected by AI.",
        icon: Target,
      },
      {
        title: "Scheduled PDF Reports",
        description:
          "Generate and schedule professional PDF reports with charts, sentiment breakdowns, and executive summaries.",
        icon: FileText,
      },
      {
        title: "Webhook & API Access",
        description:
          "Integrate Kaulby into your existing workflow with webhooks for real-time events and a full REST API.",
        icon: Webhook,
      },
      {
        title: "Team Workspaces",
        description:
          "Collaborate with your team using shared workspaces, role-based permissions, and unified monitoring.",
        icon: Users,
      },
      {
        title: "Boolean Search Queries",
        description:
          "Build precise keyword monitors using AND, OR, NOT operators and phrase matching for targeted results.",
        icon: Search,
      },
    ],
  },
  {
    status: "in-progress",
    label: "In Progress",
    StatusIcon: Loader2,
    items: [
      {
        title: "Competitor Comparison Dashboard",
        description:
          "Side-by-side competitor analysis with share-of-voice metrics, sentiment comparison, and trend overlays.",
        icon: BarChart3,
      },
      {
        title: "Enhanced Anomaly & Spike Detection",
        description:
          "Get alerted instantly when mention volume or sentiment deviates significantly from your baseline patterns.",
        icon: AlertTriangle,
      },
      {
        title: "Brand Presence & Reputation Scores",
        description:
          "A single composite score reflecting your brand health across all monitored platforms over time.",
        icon: Award,
      },
      {
        title: "Shareable Report Links",
        description:
          "Generate public or password-protected links to share reports with stakeholders who don't have a Kaulby account.",
        icon: Share2,
      },
      {
        title: "Source Authority Badges",
        description:
          "See at a glance whether a mention comes from a high-authority source, verified account, or influential creator.",
        icon: Shield,
      },
    ],
  },
  {
    status: "planned",
    label: "Planned",
    StatusIcon: Calendar,
    items: [
      {
        title: "AI Visibility Monitoring",
        description:
          "Track how and where LLMs like ChatGPT, Gemini, and Claude mention your brand in their responses.",
        icon: Eye,
      },
      {
        title: "Microsoft Teams Integration",
        description:
          "Receive real-time alerts and digests directly in your Microsoft Teams channels.",
        icon: MessageSquare,
      },
      {
        title: "Zapier & Make.com Connector",
        description:
          "Connect Kaulby to 5,000+ apps with native Zapier and Make.com integrations for automated workflows.",
        icon: Zap,
      },
      {
        title: "White-Label Reports",
        description:
          "Customize reports with your own branding, logo, and colors for client-facing deliverables.",
        icon: Palette,
      },
      {
        title: "Industry Monitoring Templates",
        description:
          "Pre-built monitoring templates for specific industries and use cases to help you get started faster.",
        icon: Globe,
      },
    ],
  },
  {
    status: "considering",
    label: "Under Consideration",
    StatusIcon: HelpCircle,
    items: [
      {
        title: "Custom AI Brand Assistant",
        description:
          "A conversational AI trained on your brand data that can answer questions about your online presence.",
        icon: MessageCircle,
      },
      {
        title: "Historical Data Trends",
        description:
          "Analyze long-term trends in brand mentions, sentiment, and share-of-voice over months or years.",
        icon: History,
      },
      {
        title: "Influencer Identification",
        description:
          "Automatically surface key influencers and thought leaders who frequently discuss your brand or industry.",
        icon: UserSearch,
      },
      {
        title: "Keyword Clustering",
        description:
          "Group related keywords and topics automatically to reveal thematic patterns across mentions.",
        icon: Layers,
      },
      {
        title: "Mobile Native App",
        description:
          "A dedicated iOS and Android app for monitoring on the go with push notifications.",
        icon: Smartphone,
      },
    ],
  },
];

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}

export default function RoadmapPage() {
  return (
    <div className="container max-w-5xl py-16 md:py-24">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-4 py-1.5 text-sm text-muted-foreground mb-6">
          <Rocket className="h-4 w-4" />
          Product Roadmap
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Where Kaulby is headed
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Transparency matters. Here&apos;s what we&apos;ve shipped, what
          we&apos;re building right now, and what&apos;s coming next.
        </p>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap justify-center gap-3 mb-16">
        <StatusBadge status="shipped" label="Shipped" />
        <StatusBadge status="in-progress" label="In Progress" />
        <StatusBadge status="planned" label="Planned" />
        <StatusBadge status="considering" label="Considering" />
      </div>

      {/* Timeline */}
      <div className="space-y-20">
        {roadmap.map((category) => {
          const config = statusConfig[category.status];
          const Icon = category.StatusIcon;
          return (
            <section key={category.status}>
              {/* Category header */}
              <div className="flex items-center gap-3 mb-8">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border ${config.border} bg-gradient-to-b ${config.bg}`}
                >
                  <Icon
                    className={`h-5 w-5 ${config.badge.split(" ")[1]}`}
                    {...(category.status === "in-progress"
                      ? { strokeWidth: 2.5 }
                      : {})}
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">
                    {category.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {category.items.length} item
                    {category.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Items grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {category.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className={`group rounded-xl border ${config.border} bg-card/50 p-5 transition-colors hover:bg-card`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                          <ItemIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium leading-snug mb-1">
                            {item.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-24 text-center rounded-2xl border border-border/50 bg-muted/20 p-10">
        <h2 className="text-2xl font-semibold mb-3">
          Have a feature request?
        </h2>
        <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
          We build Kaulby based on what our users need most. Let us know
          what would make your monitoring workflow better.
        </p>
        <a
          href="mailto:feedback@kaulbyapp.com?subject=Feature%20Request"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" />
          Request a Feature
        </a>
      </div>
    </div>
  );
}

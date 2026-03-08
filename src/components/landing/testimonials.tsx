import {
  Globe,
  Brain,
  Clock,
  Shield,
  BarChart3,
  Zap,
} from "lucide-react";

interface ValueProp {
  icon: typeof Globe;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
}

const valueProps: ValueProp[] = [
  {
    icon: Globe,
    title: "17 Platforms, One Dashboard",
    description:
      "Reddit, Hacker News, Product Hunt, YouTube, G2, Trustpilot, and 11 more — all monitored from a single view.",
    stat: "17",
    statLabel: "platforms tracked",
  },
  {
    icon: Brain,
    title: "AI That Understands Context",
    description:
      "Sentiment analysis, pain point detection, and lead scoring powered by AI — not just keyword matching.",
    stat: "5",
    statLabel: "AI analysis dimensions",
  },
  {
    icon: Clock,
    title: "Mentions Found in Hours, Not Days",
    description:
      "Automated scans every 2-4 hours so you can respond while conversations are still active.",
    stat: "2hr",
    statLabel: "fastest refresh cycle",
  },
  {
    icon: Shield,
    title: "Crisis Detection Built In",
    description:
      "Automatic alerts when negative sentiment spikes or a viral post threatens your reputation.",
    stat: "24/7",
    statLabel: "monitoring uptime",
  },
  {
    icon: BarChart3,
    title: "Reports That Prove ROI",
    description:
      "Scheduled PDF reports with sentiment trends, platform breakdowns, and AI-generated insights.",
    stat: "3",
    statLabel: "report frequencies",
  },
  {
    icon: Zap,
    title: "Set Up in Under 2 Minutes",
    description:
      "Enter your brand name, pick your platforms, and start monitoring. No API keys or technical setup required.",
    stat: "30s",
    statLabel: "to first monitor",
  },
];

const gradients = [
  "from-indigo-500 to-cyan-500",
  "from-teal-500 to-emerald-500",
  "from-violet-500 to-fuchsia-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
];

function ValuePropCard({
  prop,
  index,
}: {
  prop: ValueProp;
  index: number;
}) {
  const Icon = prop.icon;
  return (
    <div className="group relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 transition-all hover:border-white/20 hover:bg-white/[0.08]">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br ${gradients[index % gradients.length]} flex items-center justify-center`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="text-right ml-auto">
          <p className="text-2xl font-bold text-foreground leading-none">
            {prop.stat}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {prop.statLabel}
          </p>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-2">
        {prop.title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {prop.description}
      </p>
    </div>
  );
}

/**
 * Value proposition section for the homepage.
 * Replaces testimonials until real user feedback is available.
 */
export function TestimonialSection() {
  return (
    <section className="py-16 md:py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-border text-foreground mb-3 md:mb-4">
            Why Kaulby
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
            Everything you need to protect your brand
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Monitor every conversation, detect threats early, and turn mentions
            into opportunities — all on autopilot.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {valueProps.map((prop, i) => (
            <ValuePropCard key={prop.title} prop={prop} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Compact value proposition strip for the pricing page.
 */
export function TestimonialStrip() {
  return (
    <div className="mt-20 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">
        Why teams choose Kaulby
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {valueProps.slice(0, 3).map((prop, i) => (
          <ValuePropCard key={prop.title} prop={prop} index={i} />
        ))}
      </div>
    </div>
  );
}

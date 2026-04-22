import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Target,
  Zap,
  Globe,
  MessageSquare,
  type LucideIcon,
  Quote,
} from "lucide-react";
import {
  AnimatedSection,
  TextReveal,
} from "@/components/shared/home-animations-lazy";

interface UseCase {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight: string;
  accentFrom: string;
  accentTo: string;
  iconBg: string;
  borderAccent: string;
}

const useCases: UseCase[] = [
  {
    icon: AlertTriangle,
    title: "Find Customer Pain Points Before You Build",
    description:
      "See what users are actually complaining about across Reddit, reviews, and communities. Kaulby clusters recurring complaints by category — pricing concerns, support needs, negative experiences, feature requests — so you know exactly what to fix.",
    highlight: "Stop guessing what customers want. Read what they're already saying.",
    accentFrom: "from-indigo-500/20",
    accentTo: "to-indigo-600/5",
    iconBg: "bg-indigo-500/15 text-indigo-400",
    borderAccent: "border-indigo-500/20",
  },
  {
    icon: Target,
    title: "Track Competitor Complaints and Feature Gaps",
    description:
      "Monitor your competitors' names across 16 platforms. When their users complain about missing features or poor experiences, you'll see it first — and can position your product as the answer.",
    highlight: "Every competitor complaint is your opportunity.",
    accentFrom: "from-teal-500/20",
    accentTo: "to-teal-600/5",
    iconBg: "bg-teal-500/15 text-teal-400",
    borderAccent: "border-teal-500/20",
  },
  {
    icon: Zap,
    title: "Catch Buying-Signal Posts",
    description:
      "Kaulby's AI scores every mention for purchase intent. When someone posts 'looking for an alternative to [competitor]' or 'need a tool that does X', you'll know within hours — not weeks.",
    highlight: "Find people actively looking for solutions like yours.",
    accentFrom: "from-cyan-500/20",
    accentTo: "to-cyan-600/5",
    iconBg: "bg-cyan-500/15 text-cyan-400",
    borderAccent: "border-cyan-500/20",
  },
  {
    icon: Globe,
    title: "Monitor Your Brand Across 16 Platforms",
    description:
      "Reddit, Hacker News, Google Reviews, Trustpilot, G2, YouTube, X, and 10 more — all in one dashboard. Get alerted when your brand is mentioned, whether it's praise, a complaint, or a question that needs a response.",
    highlight: "One dashboard. Every conversation that matters.",
    accentFrom: "from-violet-500/20",
    accentTo: "to-violet-600/5",
    iconBg: "bg-violet-500/15 text-violet-400",
    borderAccent: "border-violet-500/20",
  },
  {
    icon: MessageSquare,
    title: "Validate Positioning Using Real Market Language",
    description:
      "Stop writing copy based on assumptions. See the exact words your potential customers use to describe their problems. Use their language in your marketing, landing pages, and sales outreach.",
    highlight:
      "Your customers already wrote your copy. You just need to find it.",
    accentFrom: "from-emerald-500/20",
    accentTo: "to-emerald-600/5",
    iconBg: "bg-emerald-500/15 text-emerald-400",
    borderAccent: "border-emerald-500/20",
  },
];

function UseCaseCard({
  useCase,
  index,
}: {
  useCase: UseCase;
  index: number;
}) {
  const Icon = useCase.icon;
  const isReversed = index % 2 === 1;

  return (
    <AnimatedSection delay={index * 0.1}>
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center",
          isReversed && "md:[direction:rtl]"
        )}
      >
        {/* Text content */}
        <div className={cn("space-y-5", isReversed && "md:[direction:ltr]")}>
          <div
            className={cn(
              "inline-flex items-center justify-center w-12 h-12 rounded-xl",
              useCase.iconBg
            )}
          >
            <Icon className="h-6 w-6" />
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-foreground">
            {useCase.title}
          </h3>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {useCase.description}
          </p>

          {/* Highlight quote */}
          <div className="flex items-start gap-3 pt-2">
            <Quote className="h-5 w-5 text-muted-foreground/50 mt-0.5 shrink-0" />
            <p className="text-sm sm:text-base font-medium italic text-foreground/80">
              {useCase.highlight}
            </p>
          </div>
        </div>

        {/* Visual accent card */}
        <div className={cn(isReversed && "md:[direction:ltr]")}>
          <Card
            className={cn(
              "relative overflow-hidden border p-8 sm:p-10",
              useCase.borderAccent
            )}
          >
            {/* Gradient background */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-60",
                useCase.accentFrom,
                useCase.accentTo
              )}
            />

            {/* Decorative elements */}
            <div className="relative flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px] gap-6">
              <div
                className={cn(
                  "flex items-center justify-center w-20 h-20 rounded-2xl",
                  useCase.iconBg
                )}
              >
                <Icon className="h-10 w-10" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-foreground/90">
                  {useCase.title.split(" ").slice(0, 3).join(" ")}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full",
                        i === 0 && "w-8",
                        i === 1 && "w-12",
                        i === 2 && "w-6",
                        useCase.iconBg.replace("text-", "bg-").split(" ")[0]
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Corner glow */}
            <div
              className={cn(
                "absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-30",
                useCase.iconBg.replace("text-", "bg-").split(" ")[0]
              )}
            />
          </Card>
        </div>
      </div>
    </AnimatedSection>
  );
}

export function UseCaseBlocks() {
  return (
    <AnimatedSection className="py-16 md:py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-20">
          <TextReveal>
            <Badge variant="outline" className="mb-3 md:mb-4">
              Use Cases
            </Badge>
          </TextReveal>
          <TextReveal delay={0.1}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
              How teams use Kaulby to grow
            </h2>
          </TextReveal>
          <TextReveal delay={0.2}>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              Real workflows that turn public conversations into product,
              marketing, and sales intelligence.
            </p>
          </TextReveal>
        </div>

        {/* Use case blocks */}
        <div className="space-y-16 md:space-y-24">
          {useCases.map((useCase, index) => (
            <UseCaseCard key={useCase.title} useCase={useCase} index={index} />
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

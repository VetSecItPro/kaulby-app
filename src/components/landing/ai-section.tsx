import { Badge } from "@/components/ui/badge";
import { MessageSquare, ExternalLink, History, Wrench } from "lucide-react";
import {
  AnimatedSection,
  TextReveal,
} from "@/components/shared/home-animations-lazy";
import { VideoPlayer } from "./video-player";
import Link from "next/link";

const features = [
  {
    icon: MessageSquare,
    title: "Natural language queries",
    description: "Ask about your data in plain English — no filters or syntax needed.",
  },
  {
    icon: ExternalLink,
    title: "Citation-backed answers",
    description: "Every insight links back to the original mention with source and platform.",
  },
  {
    icon: History,
    title: "Multi-turn conversations",
    description: "Follow up with clarifying questions. Context carries across the conversation.",
  },
  {
    icon: Wrench,
    title: "47 tools at your fingertips",
    description: "Search, analyze sentiment, find trends, score leads — all through chat.",
  },
];

export function AiSection() {
  return (
    <AnimatedSection className="py-16 md:py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10 md:mb-16">
          <TextReveal>
            <Badge variant="outline" className="mb-3 md:mb-4">AI Assistant</Badge>
          </TextReveal>
          <TextReveal delay={0.1}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
              Ask your data anything
            </h2>
          </TextReveal>
          <TextReveal delay={0.2}>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              Kaulby AI turns your monitoring data into a conversation. Get instant, citation-backed answers about sentiment, trends, and leads.
            </p>
          </TextReveal>
        </div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-[55%_45%] gap-8 md:gap-12 items-center">
          {/* Left: Video */}
          <div className="relative">
            {/* Teal glow underneath */}
            <div className="absolute -inset-4 bg-teal-500/10 rounded-3xl blur-2xl -z-10" />
            <VideoPlayer
              mp4Src="/videos/ai-chat-demo.mp4"
              webmSrc="/videos/ai-chat-demo.webm"
              poster="/videos/ai-chat-demo-poster.webp"
              className="shadow-2xl shadow-teal-500/5"
            />
          </div>

          {/* Right: Feature bullets */}
          <div className="space-y-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}

            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Try Kaulby AI
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

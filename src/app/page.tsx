import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Zap,
  Download,
} from "lucide-react";

import { AuthButtons, AuthCTA, HeroCTA } from "@/components/shared/auth-buttons";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import {
  HomeAnimations,
  AnimatedSection,
  AnimatedBadge,
  AnimatedStepCard,
  TextReveal,
} from "@/components/shared/home-animations-lazy";
import { HeroDashboard } from "@/components/landing/hero-dashboard";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { PlatformLogo } from "@/components/landing/platform-logos";
import { PWAInstallButton } from "@/components/shared/pwa-install-button";

// Static generation - revalidate every hour
export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      {/* Background gradient effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* PERF: will-change prevents repaint storms — FIX-324 */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ willChange: 'transform' }} />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s", willChange: 'transform' }} />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s", willChange: 'transform' }} />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 glass border-b safe-area-top">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" prefetch={false}>
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={32}
                height={32}
                className="object-cover w-full h-full"
                priority
              />
            </div>
            <span className="text-xl md:text-2xl font-bold gradient-text">Kaulby</span>
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            <Link
              href="/articles"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
              prefetch={true}
            >
              Articles
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
              prefetch={true}
            >
              Pricing
            </Link>
            <AuthButtons />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <HomeAnimations>
        <section className="pt-16 pb-10 md:pt-24 md:pb-14 lg:pt-32 lg:pb-16 px-4 relative">
          <div className="container mx-auto text-center max-w-5xl">
<h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 md:mb-6 animate-fade-up leading-tight" style={{ animationDelay: "0.1s" }}>
              Your{" "}
              <span className="relative inline-block">
                <span className="relative z-10">Brand</span>
                <span className="absolute -inset-x-1 top-1/3 bottom-0 bg-yellow-400/50 -rotate-2 -z-0 rounded-sm" />
              </span>{" "}
              Is Being Discussed.
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              <span className="gradient-text">Are You Listening?</span>
            </h1>

            <p className="text-base md:text-lg lg:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl mx-auto animate-fade-up px-2" style={{ animationDelay: "0.2s" }}>
              Reddit. Hacker News. Product Hunt. Reviews. One dashboard.
              <br />
              <span className="font-medium text-foreground">Never miss a mention again.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center animate-fade-up px-4 sm:px-0" style={{ animationDelay: "0.3s" }}>
              <HeroCTA />
            </div>

            <div className="mt-12 md:mt-16 lg:mt-20 px-4">
              <HeroDashboard />
            </div>
          </div>
        </section>

        {/* Platforms Section */}
        <AnimatedSection className="py-12 md:py-16 px-4 border-y bg-muted/30">
          <div className="container mx-auto text-center">
            <TextReveal>
              <p className="text-xs md:text-sm text-muted-foreground mb-6 md:mb-8">Monitor conversations across 16 major platforms</p>
            </TextReveal>
            {/* Row 1: 6 platforms */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 items-center mb-6">
              <AnimatedBadge delay={0}>
                <PlatformBadgeItem platform="reddit" name="Reddit" color="text-orange-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.05}>
                <PlatformBadgeItem platform="hackernews" name="Hacker News" color="text-amber-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.1}>
                <PlatformBadgeItem platform="producthunt" name="Product Hunt" color="text-red-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.15}>
                <PlatformBadgeItem platform="googlereviews" name="Google Reviews" color="text-blue-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.2}>
                <PlatformBadgeItem platform="trustpilot" name="Trustpilot" color="text-emerald-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.25}>
                <PlatformBadgeItem platform="youtube" name="YouTube" color="text-red-500" />
              </AnimatedBadge>
            </div>
            {/* Row 2: 5 platforms */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 items-center mb-6">
              <AnimatedBadge delay={0.3}>
                <PlatformBadgeItem platform="github" name="GitHub" color="text-gray-300" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.35}>
                <PlatformBadgeItem platform="indiehackers" name="Indie Hackers" color="text-blue-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.4}>
                <PlatformBadgeItem platform="devto" name="Dev.to" color="text-violet-400" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.45}>
                <PlatformBadgeItem platform="hashnode" name="Hashnode" color="text-blue-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.5}>
                <PlatformBadgeItem platform="quora" name="Quora" color="text-red-600" />
              </AnimatedBadge>
            </div>
            {/* Row 3: 5 platforms */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 items-center">
              <AnimatedBadge delay={0.55}>
                <PlatformBadgeItem platform="appstore" name="App Store" color="text-pink-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.6}>
                <PlatformBadgeItem platform="playstore" name="Play Store" color="text-green-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.65}>
                <PlatformBadgeItem platform="g2" name="G2" color="text-orange-600" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.7}>
                <PlatformBadgeItem platform="yelp" name="Yelp" color="text-red-600" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.75}>
                <PlatformBadgeItem platform="amazon" name="Amazon" color="text-amber-600" />
              </AnimatedBadge>
            </div>
          </div>
        </AnimatedSection>

        {/* Features Section */}
        <AnimatedSection className="py-16 md:py-24 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-10 md:mb-16">
              <TextReveal>
                <Badge variant="outline" className="mb-3 md:mb-4">Features</Badge>
              </TextReveal>
              <TextReveal delay={0.1}>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
                  Everything you need to stay informed
                </h2>
              </TextReveal>
              <TextReveal delay={0.2}>
                <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-4">
                  Set up keyword monitors in seconds and get notified whenever relevant conversations happen.
                </p>
              </TextReveal>
            </div>

            <FeatureTabs />
          </div>
        </AnimatedSection>

        {/* How it works */}
        <AnimatedSection className="py-16 md:py-24 px-4 bg-muted/30">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-10 md:mb-16">
              <TextReveal>
                <Badge variant="outline" className="mb-3 md:mb-4">How it works</Badge>
              </TextReveal>
              <TextReveal delay={0.1}>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
                  Get started in 3 simple steps
                </h2>
              </TextReveal>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
              <AnimatedStepCard delay={0}>
                <StepCard
                  number={1}
                  title="Create a Monitor"
                  description="Add your keywords and select which platforms to track."
                />
              </AnimatedStepCard>
              <AnimatedStepCard delay={0.15}>
                <StepCard
                  number={2}
                  title="We Scan 24/7"
                  description="Our AI continuously monitors and analyzes relevant discussions."
                />
              </AnimatedStepCard>
              <AnimatedStepCard delay={0.3}>
                <StepCard
                  number={3}
                  title="Get Notified"
                  description="Receive alerts and insights when new mentions are found."
                />
              </AnimatedStepCard>
            </div>
          </div>
        </AnimatedSection>

        {/* CTA Section - Split Layout */}
        <AnimatedSection className="py-10 md:py-14 px-4 relative overflow-hidden">
          <div className="absolute inset-0 gradient-primary opacity-95" />
          <div className="container mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-4 md:gap-6 items-center">
              {/* Left: Start Monitoring CTA */}
              <div className="p-6 md:p-8 border-r-0 md:border-r border-white/10">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">
                  Ready to start monitoring?
                </h2>
                <p className="text-sm text-white/80 mb-4 max-w-md">
                  Join companies using Kaulby to track conversations and engage with their communities.
                </p>
                <AuthCTA />
              </div>

              {/* Right: PWA Install Card */}
              <div className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Install the App</h3>
                      <p className="text-sm text-white/70">
                        Add to home screen for the best experience
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <PWAInstallButton />
                      <div className="flex gap-3 text-xs text-white/60">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Fast
                        </span>
                        <span className="flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          Notifications
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </HomeAnimations>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
}

function PlatformBadgeItem({
  platform,
  name,
  color,
}: {
  platform: string;
  name: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 hover-scale cursor-default">
      <span className={color}>
        <PlatformLogo platform={platform} className="h-6 w-6" />
      </span>
      <span className="font-semibold text-foreground">{name}</span>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl gradient-primary flex items-center justify-center text-xl md:text-2xl font-bold text-white mx-auto mb-3 md:mb-4 shadow-glow">
        {number}
      </div>
      <h3 className="text-base md:text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-xs md:text-sm">{description}</p>
    </div>
  );
}

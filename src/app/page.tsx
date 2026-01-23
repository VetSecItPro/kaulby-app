import Link from "next/link";
import Image from "next/image";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Zap,
  Shield,
  Globe,
  MessageSquare,
  TrendingUp,
  Target,
  BarChart3,
  Activity,
  Star,
  Smartphone,
  Code2,
  HelpCircle,
  Download,
} from "lucide-react";

import { AuthButtons, AuthCTA, HeroCTA } from "@/components/shared/auth-buttons";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import {
  HomeAnimations,
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
  AnimatedBadge,
  AnimatedStepCard,
  TextReveal,
} from "@/components/shared/home-animations-lazy";
import { PWAInstallButton } from "@/components/shared/pwa-install-button";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      {/* Background gradient effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
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
          </div>
        </section>

        {/* Platforms Section */}
        <AnimatedSection className="py-12 md:py-16 px-4 border-y bg-muted/30">
          <div className="container mx-auto text-center">
            <TextReveal>
              <p className="text-xs md:text-sm text-muted-foreground mb-6 md:mb-8">Monitor conversations across 9 major platforms</p>
            </TextReveal>
            {/* Row 1: 5 platforms */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 items-center mb-6">
              <AnimatedBadge delay={0}>
                <PlatformBadge icon={MessageSquare} name="Reddit" color="text-orange-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.05}>
                <PlatformBadge icon={TrendingUp} name="Hacker News" color="text-amber-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.1}>
                <PlatformBadge icon={Globe} name="Product Hunt" color="text-red-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.15}>
                <PlatformBadge icon={Star} name="Google Reviews" color="text-blue-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.2}>
                <PlatformBadge icon={Star} name="Trustpilot" color="text-emerald-500" />
              </AnimatedBadge>
            </div>
            {/* Row 2: 4 platforms */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 items-center">
              <AnimatedBadge delay={0.25}>
                <PlatformBadge icon={Smartphone} name="App Store" color="text-pink-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.3}>
                <PlatformBadge icon={Smartphone} name="Play Store" color="text-green-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.35}>
                <PlatformBadge icon={HelpCircle} name="Quora" color="text-red-600" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.4}>
                <PlatformBadge icon={Code2} name="Dev.to" color="text-violet-500" />
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

            <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" staggerDelay={0.08}>
              <StaggerItem>
                <FeatureCard
                  icon={Target}
                  title="Keyword Tracking"
                  description="Monitor any keyword, phrase, or brand name across Reddit, Hacker News, and review sites."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Activity}
                  title="AI-Powered Analysis"
                  description="Automatic sentiment scoring and pain point detection to surface what matters most."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Bell}
                  title="Email Alerts"
                  description="Get daily or weekly digests delivered to your inbox when new mentions are found."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={BarChart3}
                  title="Analytics Dashboard"
                  description="Visualize trends, sentiment over time, and engagement metrics at a glance."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Globe}
                  title="Multi-Platform"
                  description="One dashboard for Reddit, Hacker News, Product Hunt, app stores, and review sites."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Shield}
                  title="Brand Protection"
                  description="Stay ahead of negative sentiment and respond to mentions before they escalate."
                />
              </StaggerItem>
            </StaggerContainer>
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

function PlatformBadge({
  icon: Icon,
  name,
  color,
}: {
  icon: React.ElementType;
  name: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 hover-scale cursor-default">
      <Icon className={`h-6 w-6 ${color}`} />
      <span className="font-semibold text-foreground">{name}</span>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/40 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
      <CardHeader className="space-y-4">
        <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-2">
          <CardTitle className="font-serif text-lg font-normal tracking-wide">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted-foreground/80">{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
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

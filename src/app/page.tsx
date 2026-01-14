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
  Radar,
  Target,
  BarChart3,
  Activity,
  Twitter,
} from "lucide-react";
import { AuthButtons, AuthCTA, HeroCTA } from "@/components/shared/auth-buttons";
import {
  HomeAnimations,
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
  AnimatedBadge,
  AnimatedStepCard,
  TextReveal,
} from "@/components/shared/home-animations";

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
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
            <span className="text-xl md:text-2xl font-bold gradient-text">Kaulby</span>
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Pricing
            </Link>
            <AuthButtons />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <HomeAnimations>
        <section className="py-16 md:py-24 lg:py-32 px-4 relative">
          <div className="container mx-auto text-center max-w-5xl">
            <div className="animate-fade-up">
              <Badge
                variant="outline"
                className="mb-4 md:mb-6 px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm border-primary/30 bg-primary/5"
              >
                <Radar className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1.5 md:mr-2 text-primary" />
                AI-Powered Community Monitoring
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 md:mb-6 animate-fade-up leading-tight" style={{ animationDelay: "0.1s" }}>
              <span className="relative inline-block">
                <span className="relative z-10">Never</span>
                <span className="absolute -inset-x-1 top-1/3 bottom-0 bg-yellow-400/50 -rotate-2 -z-0 rounded-sm" />
              </span>{" "}
              miss a conversation
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              <span className="gradient-text">about your brand</span>
            </h1>

            <p className="text-base md:text-lg lg:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl mx-auto animate-fade-up px-2" style={{ animationDelay: "0.2s" }}>
              Track discussions across Reddit, Hacker News, and Product Hunt.
              Get AI-powered insights and instant alerts when topics you care about are mentioned.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center animate-fade-up px-4 sm:px-0" style={{ animationDelay: "0.3s" }}>
              <HeroCTA />
            </div>

            {/* Trust badges */}
            <div className="mt-10 md:mt-16 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 md:gap-8 text-xs md:text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Real-time monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Secure by design</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Setup in 2 minutes</span>
              </div>
            </div>
          </div>
        </section>

        {/* Platforms Section */}
        <AnimatedSection className="py-12 md:py-16 px-4 border-y bg-muted/30">
          <div className="container mx-auto text-center">
            <TextReveal>
              <p className="text-xs md:text-sm text-muted-foreground mb-6 md:mb-8">Monitor conversations across major platforms</p>
            </TextReveal>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-6 md:gap-12 items-center">
              <AnimatedBadge delay={0}>
                <PlatformBadge icon={MessageSquare} name="Reddit" color="text-orange-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.1}>
                <PlatformBadge icon={TrendingUp} name="Hacker News" color="text-amber-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.2}>
                <PlatformBadge icon={Globe} name="Product Hunt" color="text-red-500" />
              </AnimatedBadge>
              <AnimatedBadge delay={0.3}>
                <PlatformBadge icon={Twitter} name="X" color="text-sky-500" />
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

            <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <StaggerItem>
                <FeatureCard
                  icon={Target}
                  title="Smart Keyword Tracking"
                  description="Track any keyword, phrase, or brand name across multiple platforms simultaneously."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Activity}
                  title="Smart Analysis"
                  description="Automatic sentiment analysis and pain point detection to prioritize important mentions."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Bell}
                  title="Instant Alerts"
                  description="Get real-time notifications via email, Slack, or in-app when keywords are mentioned."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={BarChart3}
                  title="Rich Analytics"
                  description="Visualize trends, sentiment over time, and engagement metrics in beautiful dashboards."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Globe}
                  title="Multi-Platform"
                  description="One dashboard for Reddit, Hacker News, Product Hunt, X, and more platforms."
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={Shield}
                  title="Brand Protection"
                  description="Respond quickly to mentions and manage your brand reputation effectively."
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

        {/* CTA Section */}
        <AnimatedSection className="py-16 md:py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 gradient-primary opacity-95" />

          <div className="container mx-auto text-center relative z-10 px-4">
            <TextReveal>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-white">
                Ready to start monitoring?
              </h2>
            </TextReveal>
            <TextReveal delay={0.1}>
              <p className="text-sm md:text-base text-white/80 mb-8 md:mb-10 max-w-xl mx-auto">
                Join companies using Kaulby to track conversations and engage with their communities.
              </p>
            </TextReveal>
            <TextReveal delay={0.2}>
              <AuthCTA />
            </TextReveal>
          </div>
        </AnimatedSection>
      </HomeAnimations>

      {/* Footer */}
      <footer className="border-t py-8 md:py-12 px-4 bg-background safe-area-bottom">
        <div className="container mx-auto">
          <div className="flex flex-col gap-6 md:gap-0 md:flex-row justify-between items-center">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  <Image
                    src="/logo.jpg"
                    alt="Kaulby"
                    width={28}
                    height={28}
                    className="object-cover"
                  />
                </div>
                <span className="text-xl font-bold gradient-text">Kaulby</span>
              </Link>
              <span className="text-xs sm:text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} All rights reserved.
              </span>
            </div>
            <nav className="flex items-center gap-6 md:gap-8">
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms
              </Link>
            </nav>
          </div>
        </div>
      </footer>
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
    <Card className="group hover-lift border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-glow-sm">
      <CardHeader>
        <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
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

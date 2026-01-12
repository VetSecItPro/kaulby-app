import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Zap, Shield, Globe, MessageSquare, TrendingUp } from "lucide-react";
import { AuthButtons, AuthCTA, HeroCTA } from "@/components/shared/auth-buttons";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Kaulby
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <AuthButtons />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="secondary" className="mb-4">
            Community Monitoring Tool
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Never miss a conversation about your{" "}
            <span className="text-primary">brand or product</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Track discussions across Reddit, Hacker News, and other online communities.
            Get instant alerts when topics you care about are mentioned.
          </p>
          <div className="flex gap-4 justify-center">
            <HeroCTA />
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-6">Monitor conversations across</p>
          <div className="flex flex-wrap justify-center gap-8 items-center text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              <span className="font-semibold">Reddit</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              <span className="font-semibold">Hacker News</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6" />
              <span className="font-semibold">Product Hunt</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6" />
              <span className="font-semibold">Twitter/X</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything you need to stay informed</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Set up keyword monitors in seconds and get notified whenever relevant conversations happen.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Bell className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Real-time Alerts</CardTitle>
                <CardDescription>
                  Get instant notifications via email or in-app when your keywords are mentioned.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Easy Setup</CardTitle>
                <CardDescription>
                  Create monitors in seconds. Just add your keywords and select platforms.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Globe className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Multi-Platform</CardTitle>
                <CardDescription>
                  Track Reddit, Hacker News, Product Hunt, Twitter, and more from one dashboard.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Brand Protection</CardTitle>
                <CardDescription>
                  Respond quickly to mentions, manage reputation, and engage with your community.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start monitoring?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join thousands of companies using Kaulby to track conversations and engage with their communities.
          </p>
          <AuthCTA />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Kaulby. All rights reserved.
          </div>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

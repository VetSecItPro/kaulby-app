"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  ArrowRight,
  Search,
  Bell,
  Brain,
  BarChart3,
  MessageSquare,
  Target,
  Globe,
  Zap,
  Shield,
  Users,
  HelpCircle,
} from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import {
  ToolPageSchema,
  FAQSchema,
  HowToSchema,
  WebPageSchema,
} from "@/lib/seo/structured-data";

// Tool page data for different SEO keywords
const toolPages: Record<string, {
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  features: Array<{
    icon: typeof Search;
    title: string;
    description: string;
  }>;
  useCases: Array<{
    title: string;
    description: string;
  }>;
  platforms: string[];
  ctaText: string;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  howToSteps: Array<{
    name: string;
    text: string;
  }>;
  relatedAlternatives: string[];
}> = {
  "reddit-monitoring": {
    title: "Reddit Monitoring Tool",
    subtitle: "Track brand mentions, competitors, and trends across Reddit",
    description: "Monitor subreddits, track keywords, and get AI-powered insights from Reddit conversations. Find customers, track competitors, and discover market trends.",
    keywords: ["reddit monitoring", "reddit alerts", "subreddit tracking", "reddit brand monitoring"],
    features: [
      {
        icon: Search,
        title: "Keyword Tracking",
        description: "Monitor specific keywords across all of Reddit or targeted subreddits. Get notified when someone mentions your brand.",
      },
      {
        icon: Brain,
        title: "AI Sentiment Analysis",
        description: "Automatically categorize mentions as positive, negative, or neutral. Understand how people feel about your brand.",
      },
      {
        icon: Bell,
        title: "Real-Time Alerts",
        description: "Get instant notifications via email, Slack, or Discord when new mentions appear.",
      },
      {
        icon: Target,
        title: "Pain Point Detection",
        description: "AI automatically identifies posts where users are frustrated or looking for solutions.",
      },
      {
        icon: BarChart3,
        title: "Analytics Dashboard",
        description: "Track mention volume, sentiment trends, and engagement over time with beautiful charts.",
      },
      {
        icon: MessageSquare,
        title: "Conversation Categories",
        description: "AI categorizes posts: Solution Requests, Pain Points, Money Talk, Advice, and Hot Discussions.",
      },
    ],
    useCases: [
      {
        title: "Brand Monitoring",
        description: "Track when people mention your company, product, or founders on Reddit. Respond quickly to feedback and complaints.",
      },
      {
        title: "Competitor Research",
        description: "Monitor competitor mentions to understand their strengths, weaknesses, and customer sentiment.",
      },
      {
        title: "Lead Generation",
        description: "Find Reddit posts where users are actively looking for solutions you provide. Convert conversations into customers.",
      },
      {
        title: "Market Research",
        description: "Discover trends, pain points, and opportunities by monitoring industry-relevant subreddits.",
      },
    ],
    platforms: ["reddit"],
    ctaText: "Start Monitoring Reddit Free",
    faqs: [
      {
        question: "What is Reddit monitoring and why do I need it?",
        answer: "Reddit monitoring is the process of tracking mentions of your brand, products, competitors, or keywords across Reddit's thousands of communities. You need it because Reddit has 52 million daily active users who discuss products, share recommendations, and voice complaints - often before they reach traditional review sites. Monitoring lets you respond to feedback, find potential customers, and understand market sentiment in real-time.",
      },
      {
        question: "How does Kaulby's Reddit monitoring work?",
        answer: "Kaulby continuously scans Reddit for your specified keywords across all subreddits or specific communities you choose. When a match is found, our AI analyzes the sentiment and categorizes the post (pain point, solution request, etc.), then sends you an alert via email, Slack, or webhook. You can view all mentions in a dashboard with filtering and analytics.",
      },
      {
        question: "Can I monitor specific subreddits only?",
        answer: "Yes, you can configure monitors to track keywords within specific subreddits or across all of Reddit. This is useful if you want to focus on industry-specific communities like r/SaaS, r/startups, or r/entrepreneur rather than getting alerts from every corner of Reddit.",
      },
      {
        question: "What's the difference between Kaulby and free Reddit search?",
        answer: "Reddit's native search is manual, one-time, and doesn't provide alerts. Kaulby provides automated monitoring, real-time alerts, AI sentiment analysis, pain point detection, conversation categorization, historical analytics, and team collaboration features. Free Reddit search requires you to check manually; Kaulby brings the mentions to you.",
      },
      {
        question: "How quickly will I get alerts for new Reddit mentions?",
        answer: "Kaulby scans Reddit continuously. Free tier users get daily digest emails, Pro users get mentions within 4 hours, and Team users get mentions within 2 hours. You can also enable real-time Slack or webhook notifications for instant alerts.",
      },
    ],
    howToSteps: [
      {
        name: "Sign up for free",
        text: "Create your Kaulby account in 30 seconds. No credit card required.",
      },
      {
        name: "Create a monitor",
        text: "Enter the keywords you want to track (brand name, competitors, industry terms).",
      },
      {
        name: "Configure alerts",
        text: "Choose how you want to be notified: email digest, Slack, or webhooks.",
      },
      {
        name: "Get insights",
        text: "View your dashboard to see mentions, sentiment trends, and AI-categorized conversations.",
      },
    ],
    relatedAlternatives: ["gummysearch", "f5bot", "syften"],
  },
  "social-listening-for-startups": {
    title: "Social Listening for Startups",
    subtitle: "Affordable social listening built for bootstrapped founders",
    description: "Enterprise-grade social listening at startup-friendly prices. Monitor 12 platforms, get AI insights, and find customers - all without the enterprise price tag.",
    keywords: ["social listening startups", "affordable social listening", "startup monitoring tool"],
    features: [
      {
        icon: Globe,
        title: "12 Platforms, One Dashboard",
        description: "Monitor Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot, App Store, Play Store, Quora, YouTube, G2, Yelp, and Amazon Reviews.",
      },
      {
        icon: Zap,
        title: "Free Forever Tier",
        description: "Start monitoring for free. No credit card required. Upgrade only when you need more.",
      },
      {
        icon: Brain,
        title: "AI-Powered Insights",
        description: "Automatic sentiment analysis, pain point detection, and lead scoring on every mention.",
      },
      {
        icon: Target,
        title: "Find Early Customers",
        description: "Discover posts where people are actively looking for products like yours. Convert conversations to customers.",
      },
      {
        icon: Shield,
        title: "Competitor Intelligence",
        description: "Monitor competitor mentions and understand what customers love or hate about alternatives.",
      },
      {
        icon: Users,
        title: "Team Collaboration",
        description: "Share insights with your team. Assign mentions, track responses, and collaborate on outreach.",
      },
    ],
    useCases: [
      {
        title: "Product-Market Fit Research",
        description: "Listen to what your target customers are saying. Understand their problems and validate your solution.",
      },
      {
        title: "Early Customer Acquisition",
        description: "Find and engage with potential customers where they already hang out - Reddit, HN, and community forums.",
      },
      {
        title: "Reputation Management",
        description: "Track mentions across review sites. Respond to feedback quickly before it impacts your reputation.",
      },
      {
        title: "Content Ideas",
        description: "Discover what questions your audience is asking. Create content that answers their real problems.",
      },
    ],
    platforms: ["reddit", "hackernews", "producthunt", "googlereviews", "trustpilot", "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazonreviews"],
    ctaText: "Start Free Social Listening",
    faqs: [
      {
        question: "What is social listening and why do startups need it?",
        answer: "Social listening is monitoring online conversations about your brand, competitors, and industry across social platforms and communities. Startups need it to find early customers, understand market problems, track competitor sentiment, and manage their online reputation - all crucial for growth without a big marketing budget.",
      },
      {
        question: "How is Kaulby different from enterprise tools like Brandwatch or Mention?",
        answer: "Enterprise tools cost $500-2,000/month and focus on Twitter/Facebook. Kaulby costs $0-79/month and focuses on communities where startups actually get discovered: Reddit, Hacker News, Product Hunt, and review sites. We built Kaulby specifically for bootstrapped founders who need powerful insights without enterprise pricing.",
      },
      {
        question: "Can I really start for free?",
        answer: "Yes, Kaulby has a free forever tier that includes 1 monitor on Reddit. It's not a trial - you can use it indefinitely. When you need more monitors, more platforms, or faster refresh rates, you can upgrade to Pro ($29/mo) or Team ($79/mo).",
      },
      {
        question: "What platforms does Kaulby monitor?",
        answer: "Kaulby monitors 12 platforms: Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot, App Store reviews, Play Store reviews, Quora, YouTube, G2, Yelp, and Amazon Reviews. These are the platforms where startups get discovered and discussed, unlike traditional social listening tools that focus on Twitter and Facebook.",
      },
      {
        question: "How can social listening help me find customers?",
        answer: "Kaulby's AI identifies 'solution request' posts - where people are actively asking for product recommendations. When someone posts 'looking for a tool that does X' and X is what you do, you get an alert. This lets you engage authentically and convert conversations into customers.",
      },
    ],
    howToSteps: [
      {
        name: "Create your free account",
        text: "Sign up in 30 seconds with just your email. No credit card needed.",
      },
      {
        name: "Set up your first monitor",
        text: "Enter keywords related to your product, competitors, or industry problems.",
      },
      {
        name: "Choose your platforms",
        text: "Select which platforms to monitor (Pro tier unlocks all 12 platforms).",
      },
      {
        name: "Configure notifications",
        text: "Set up email digests or Slack notifications to stay informed.",
      },
      {
        name: "Engage and grow",
        text: "Use AI insights to find customers, respond to feedback, and track competitors.",
      },
    ],
    relatedAlternatives: ["brand24", "mention", "awario"],
  },
  "brand-monitoring": {
    title: "Brand Monitoring Tool",
    subtitle: "Track every mention of your brand across the web",
    description: "Know whenever someone talks about your brand. Monitor reviews, social mentions, and community discussions with AI-powered insights.",
    keywords: ["brand monitoring", "brand tracking", "online reputation monitoring"],
    features: [
      {
        icon: Globe,
        title: "Multi-Platform Coverage",
        description: "Monitor 12 platforms including Reddit, review sites, app stores, and more.",
      },
      {
        icon: Bell,
        title: "Instant Alerts",
        description: "Get notified immediately when your brand is mentioned. Never miss important feedback.",
      },
      {
        icon: Brain,
        title: "Sentiment Analysis",
        description: "AI analyzes every mention to tell you if it's positive, negative, or neutral.",
      },
      {
        icon: BarChart3,
        title: "Trend Tracking",
        description: "See how brand perception changes over time. Track the impact of launches and campaigns.",
      },
      {
        icon: MessageSquare,
        title: "Review Monitoring",
        description: "Track reviews on Google, Trustpilot, App Store, and Play Store in one place.",
      },
      {
        icon: Target,
        title: "Competitor Comparison",
        description: "Compare your brand mentions against competitors. Understand your share of voice.",
      },
    ],
    useCases: [
      {
        title: "Crisis Prevention",
        description: "Catch negative sentiment early before it becomes a PR crisis. Respond to complaints quickly.",
      },
      {
        title: "Customer Feedback",
        description: "Aggregate feedback from all platforms. Understand what customers love and what needs improvement.",
      },
      {
        title: "Campaign Tracking",
        description: "Measure the impact of marketing campaigns by tracking mention volume and sentiment.",
      },
      {
        title: "Review Response",
        description: "Stay on top of reviews across all platforms. Respond professionally to build trust.",
      },
    ],
    platforms: ["reddit", "hackernews", "producthunt", "googlereviews", "trustpilot", "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazonreviews"],
    ctaText: "Start Brand Monitoring Free",
    faqs: [
      {
        question: "What is brand monitoring?",
        answer: "Brand monitoring is the process of tracking mentions of your company, products, and executives across the internet. It helps you understand public perception, respond to feedback, prevent PR crises, and gather competitive intelligence. Kaulby monitors 12 platforms including Reddit, review sites, YouTube, G2, Yelp, and Amazon.",
      },
      {
        question: "Why should I monitor my brand online?",
        answer: "92% of consumers read online reviews before making a purchase. If someone complains about your product on Reddit or leaves a negative review, you want to know immediately so you can respond. Brand monitoring also helps you find happy customers to feature as testimonials and understand how you compare to competitors.",
      },
      {
        question: "How does AI sentiment analysis work?",
        answer: "Kaulby's AI reads each mention and determines if the tone is positive, negative, or neutral. It goes beyond simple keyword matching to understand context, sarcasm, and nuance. This lets you quickly filter to negative mentions that need attention or positive mentions you might want to amplify.",
      },
      {
        question: "Can I track multiple brands or products?",
        answer: "Yes, you can create separate monitors for different brands, products, or even executives. Pro tier includes 10 monitors and Team tier includes 30 monitors. Each monitor can track multiple keywords with Boolean operators for precise matching.",
      },
      {
        question: "How is this different from Google Alerts?",
        answer: "Google Alerts only monitors web pages that Google indexes, missing Reddit, app store reviews, and real-time discussions. Kaulby provides AI-powered analysis, sentiment detection, beautiful dashboards, team collaboration, and covers platforms Google Alerts misses entirely.",
      },
    ],
    howToSteps: [
      {
        name: "Sign up for Kaulby",
        text: "Create your account in under a minute. Free tier available.",
      },
      {
        name: "Add your brand keywords",
        text: "Enter your company name, product names, and any variations or misspellings.",
      },
      {
        name: "Select platforms to monitor",
        text: "Choose from 12 platforms: Reddit, review sites, app stores, YouTube, G2, Yelp, Amazon, and more.",
      },
      {
        name: "Configure alert preferences",
        text: "Set up real-time alerts via Slack or daily email digests.",
      },
      {
        name: "Review and respond",
        text: "Use your dashboard to see all mentions, filter by sentiment, and track trends.",
      },
    ],
    relatedAlternatives: ["mention", "brand24", "brandwatch"],
  },
  "competitor-monitoring": {
    title: "Competitor Monitoring Tool",
    subtitle: "Track what customers say about your competitors",
    description: "Monitor competitor mentions across 12 platforms. Understand their strengths, weaknesses, and customer sentiment to gain competitive advantage.",
    keywords: ["competitor monitoring", "competitor tracking", "competitive intelligence"],
    features: [
      {
        icon: Target,
        title: "Track Multiple Competitors",
        description: "Monitor all your competitors in one dashboard. Compare sentiment and mention volume.",
      },
      {
        icon: Brain,
        title: "Sentiment Comparison",
        description: "See how customer sentiment differs between you and competitors. Find your advantages.",
      },
      {
        icon: MessageSquare,
        title: "Feature Requests",
        description: "Discover what features customers are asking competitors for. Build what they can't.",
      },
      {
        icon: Search,
        title: "Pain Point Discovery",
        description: "Find frustrated competitor customers who might switch. Turn their pain into your gain.",
      },
      {
        icon: BarChart3,
        title: "Share of Voice",
        description: "Measure your brand presence compared to competitors. Track progress over time.",
      },
      {
        icon: Bell,
        title: "Competitor Alerts",
        description: "Get notified when competitors launch features, get bad reviews, or face issues.",
      },
    ],
    useCases: [
      {
        title: "Sales Intelligence",
        description: "Find prospects complaining about competitors. Reach out with solutions to their problems.",
      },
      {
        title: "Product Strategy",
        description: "Understand competitor weaknesses. Build features that solve problems they can't.",
      },
      {
        title: "Market Positioning",
        description: "Learn how customers perceive competitors. Position your brand to fill the gaps.",
      },
      {
        title: "Win/Loss Analysis",
        description: "Understand why customers choose competitors. Improve your offering based on real feedback.",
      },
    ],
    platforms: ["reddit", "hackernews", "producthunt", "googlereviews", "trustpilot", "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazonreviews"],
    ctaText: "Start Competitor Monitoring Free",
    faqs: [
      {
        question: "What is competitor monitoring?",
        answer: "Competitor monitoring is tracking what customers say about your competitors across the internet. It reveals their strengths, weaknesses, feature gaps, and customer pain points. This intelligence helps you improve your product, refine your positioning, and find customers who might switch to you.",
      },
      {
        question: "How can competitor monitoring help me win more customers?",
        answer: "When someone complains about a competitor's pricing, missing feature, or poor support on Reddit, you can engage authentically. Kaulby's AI identifies these 'pain point' posts so you can offer your solution to people actively frustrated with alternatives.",
      },
      {
        question: "What platforms should I monitor competitors on?",
        answer: "Reddit and Hacker News are where honest, unfiltered discussions happen. Review sites (Google, Trustpilot, G2) show detailed feedback. App stores reveal mobile experience issues. YouTube comments, Yelp, and Amazon Reviews round out the picture. Kaulby monitors all 12 of these platforms in one dashboard.",
      },
      {
        question: "Can I compare my brand against multiple competitors?",
        answer: "Yes, Kaulby's Share of Voice feature shows your mention volume compared to competitors over time. You can track up to 30 competitors on the Team plan. The analytics dashboard shows sentiment comparison, feature request trends, and pain point categories across all competitors.",
      },
      {
        question: "How do I find competitor customers who might switch?",
        answer: "Kaulby's AI categorizes posts and identifies 'pain points' - posts where people express frustration. Filter by competitor name and pain point category to find users complaining about your competitors. These are warm leads for outreach.",
      },
    ],
    howToSteps: [
      {
        name: "Create your account",
        text: "Sign up free and start in under a minute.",
      },
      {
        name: "Add competitor keywords",
        text: "Enter competitor brand names, product names, and common misspellings.",
      },
      {
        name: "Enable pain point detection",
        text: "Turn on AI analysis to automatically categorize competitor mentions.",
      },
      {
        name: "Set up competitor alerts",
        text: "Get notified when competitors get negative reviews or face issues.",
      },
      {
        name: "Analyze and act",
        text: "Use insights to improve your product and find customers ready to switch.",
      },
    ],
    relatedAlternatives: ["awario", "mention", "brandwatch"],
  },
};

const platformLabels: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  googlereviews: "Google Reviews",
  trustpilot: "Trustpilot",
  appstore: "App Store",
  playstore: "Play Store",
  quora: "Quora",
  youtube: "YouTube",
  g2: "G2",
  yelp: "Yelp",
  amazonreviews: "Amazon Reviews",
};

const alternativeLabels: Record<string, string> = {
  gummysearch: "***",
  f5bot: "F5Bot",
  syften: "Syften",
  brand24: "Brand24",
  mention: "Mention",
  awario: "Awario",
  brandwatch: "Brandwatch",
};

export default function ToolPage() {
  const params = useParams();
  const slug = params.slug as string;

  const defaultTool = toolPages["social-listening-for-startups"];
  const tool = toolPages[slug] || {
    title: "Social Listening Tool",
    subtitle: "Monitor brand mentions across the web",
    description: "Track mentions, analyze sentiment, and discover opportunities with AI-powered social listening.",
    keywords: ["social listening", "brand monitoring"],
    features: defaultTool.features,
    useCases: defaultTool.useCases,
    platforms: ["reddit", "hackernews", "producthunt"],
    ctaText: "Start Monitoring Free",
    faqs: defaultTool.faqs,
    howToSteps: defaultTool.howToSteps,
    relatedAlternatives: ["brand24", "mention"],
  };

  const pageUrl = `https://kaulbyapp.com/tools/${slug}`;
  const breadcrumbs = [
    { name: "Home", url: "https://kaulbyapp.com" },
    { name: "Tools", url: "https://kaulbyapp.com/tools" },
    { name: tool.title, url: pageUrl },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data for SEO & AEO */}
      <ToolPageSchema
        name={tool.title}
        description={tool.description}
        url={pageUrl}
        features={tool.features.map(f => f.title)}
      />
      <FAQSchema faqs={tool.faqs} />
      <HowToSchema
        name={`How to Use ${tool.title}`}
        description={`Step-by-step guide to ${tool.title.toLowerCase()}`}
        steps={tool.howToSteps}
        totalTime="PT5M"
      />
      <WebPageSchema
        title={tool.title}
        description={tool.description}
        url={pageUrl}
        breadcrumbs={breadcrumbs}
      />

      <MarketingHeader />

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          {/* Breadcrumb for SEO */}
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center justify-center gap-2">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li><Link href="/tools/social-listening-for-startups" className="hover:text-foreground">Tools</Link></li>
              <li>/</li>
              <li className="text-foreground">{tool.title}</li>
            </ol>
          </nav>

          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            Free to Start
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            {tool.title}
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto" id="hero-description">
            {tool.subtitle}
          </p>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {tool.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 text-lg px-8">
                {tool.ctaText}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required. Free forever tier available.
          </p>
        </div>
      </section>

      {/* Platforms Covered */}
      <section className="py-12 px-4 border-y bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <p className="text-center text-muted-foreground mb-4">Platforms covered:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {tool.platforms.map((platform) => (
              <Badge key={platform} variant="outline" className="text-sm px-3 py-1">
                {platformLabels[platform] || platform}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4" id="features">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">Features</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Everything you need for effective {tool.title.toLowerCase().replace(" tool", "")}.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tool.features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30" id="how-it-works">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-muted-foreground text-center mb-12">
            Get started with {tool.title.toLowerCase()} in minutes.
          </p>
          <div className="space-y-6">
            {tool.howToSteps.map((step, index) => (
              <div key={step.name} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{step.name}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4" id="use-cases">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">Use Cases</h2>
          <p className="text-muted-foreground text-center mb-12">
            How teams use Kaulby for {tool.title.toLowerCase().replace(" tool", "")}.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {tool.useCases.map((useCase) => (
              <Card key={useCase.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Check className="h-5 w-5 text-green-500" />
                    {useCase.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{useCase.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - Critical for AEO */}
      <section className="py-20 px-4 bg-muted/30" id="faq">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">
              Everything you need to know about {tool.title.toLowerCase()}.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {tool.faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-2">Start Free, Upgrade When Ready</h3>
              <p className="text-muted-foreground mb-6">
                Free tier includes 1 monitor on Reddit. Pro starts at $29/month for full access to all 12 platforms.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/sign-up">
                  <Button size="lg" className="gap-2">
                    Start Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline">
                    Compare Plans
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Internal Links - Related Tools & Alternatives */}
      <section className="py-16 px-4 border-t">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Related Tools */}
            <div>
              <h2 className="text-xl font-bold mb-6">Related Tools</h2>
              <div className="flex flex-wrap gap-3">
                {Object.entries(toolPages)
                  .filter(([key]) => key !== slug)
                  .map(([key, data]) => (
                    <Link key={key} href={`/tools/${key}`}>
                      <Badge variant="outline" className="text-sm px-4 py-2 cursor-pointer hover:bg-muted">
                        {data.title}
                      </Badge>
                    </Link>
                  ))}
              </div>
            </div>

            {/* Compare Alternatives */}
            <div>
              <h2 className="text-xl font-bold mb-6">Compare Alternatives</h2>
              <div className="flex flex-wrap gap-3">
                {tool.relatedAlternatives.map((alt) => (
                  <Link key={alt} href={`/alternatives/${alt}`}>
                    <Badge variant="outline" className="text-sm px-4 py-2 cursor-pointer hover:bg-muted">
                      Kaulby vs {alternativeLabels[alt] || alt}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start {tool.title.replace(" Tool", "")}?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of companies using Kaulby to monitor their online presence.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              {tool.ctaText}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

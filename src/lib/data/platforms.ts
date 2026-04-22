/**
 * Platform metadata for programmatic SEO pages
 *
 * Used by:
 * - src/app/(marketing)/monitor/[platform]/page.tsx
 * - src/app/sitemap.ts
 */

export interface PlatformData {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  tier: "free" | "pro" | "team";
  heroHeadline: string;
  heroDescription: string;
  features: {
    title: string;
    description: string;
  }[];
  useCases: string[];
  exampleKeywords: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const PLATFORMS: PlatformData[] = [
  {
    slug: "reddit",
    name: "Reddit",
    shortName: "Reddit",
    tier: "free",
    description:
      "Monitor Reddit mentions, track brand conversations across subreddits, and analyze sentiment with AI.",
    heroHeadline: "Monitor Reddit Mentions in Real Time",
    heroDescription:
      "Track your brand, competitors, and industry keywords across thousands of subreddits. Get AI-powered sentiment analysis and instant alerts when someone mentions you on Reddit.",
    features: [
      {
        title: "Subreddit-Level Tracking",
        description:
          "Monitor specific subreddits or track keywords across all of Reddit. Filter by subreddit, post type, and comment depth.",
      },
      {
        title: "Comment Thread Analysis",
        description:
          "Kaulby analyzes entire comment threads, not just top-level posts. Catch mentions buried deep in discussions.",
      },
      {
        title: "Pain Point Detection",
        description:
          "AI identifies users expressing frustration or looking for alternatives to competitors - perfect for finding warm leads.",
      },
      {
        title: "Trending Topic Alerts",
        description:
          "Get notified when discussions about your product or industry start trending in relevant subreddits.",
      },
    ],
    useCases: [
      "Track brand mentions across startup and tech subreddits",
      "Find users asking for product recommendations in your niche",
      "Monitor competitor discussions and sentiment shifts",
      "Identify pain points and feature requests from real users",
    ],
    exampleKeywords: [
      "Notion alternative",
      "best CRM for startups",
      "Slack vs Teams",
      "project management tool",
      "customer support software",
    ],
    faqs: [
      {
        question: "How often does Kaulby scan Reddit?",
        answer:
          "Free tier scans every 24 hours, Pro every 4 hours, and Team every 2 hours. This ensures you catch time-sensitive discussions.",
      },
      {
        question: "Can I monitor specific subreddits?",
        answer:
          "Yes. You can target specific subreddits or monitor keywords across all of Reddit. Kaulby supports boolean search operators like AND, OR, and NOT for precise filtering.",
      },
      {
        question: "Does Kaulby track Reddit comments or just posts?",
        answer:
          "Both. Kaulby monitors posts and comments, so you never miss a mention even if it is buried in a discussion thread.",
      },
      {
        question: "Is Reddit monitoring available on the free plan?",
        answer:
          "Yes. Reddit is available on all plans including the free tier. You get 1 monitor with 3 keywords on the free plan.",
      },
    ],
  },
  {
    slug: "hackernews",
    name: "Hacker News",
    shortName: "HN",
    tier: "pro",
    description:
      "Track Hacker News discussions, monitor Show HN posts, and catch mentions of your product in the tech community.",
    heroHeadline: "Monitor Hacker News Mentions",
    heroDescription:
      "Track discussions on Hacker News where developers, founders, and tech leaders share opinions. Catch product mentions, competitor discussions, and industry trends before they go mainstream.",
    features: [
      {
        title: "Show HN & Ask HN Tracking",
        description:
          "Monitor Show HN launches and Ask HN threads to find users discussing your product category or seeking recommendations.",
      },
      {
        title: "Comment Sentiment Analysis",
        description:
          "HN comments are notoriously candid. Kaulby's AI analyzes sentiment to separate genuine feedback from noise.",
      },
      {
        title: "Founder & Developer Insights",
        description:
          "HN attracts decision-makers. Identify when CTOs, founders, or lead developers discuss tools in your space.",
      },
      {
        title: "Trending Story Detection",
        description:
          "Get alerted when stories related to your keywords hit the front page, giving you a window to engage.",
      },
    ],
    useCases: [
      "Track when your product is discussed on HN",
      "Monitor competitor launches and community reactions",
      "Find developers looking for alternatives in your niche",
      "Catch early signals of trending tech topics",
    ],
    exampleKeywords: [
      "Show HN",
      "open source monitoring",
      "AI startup",
      "developer tools",
      "YC company",
    ],
    faqs: [
      {
        question: "Does Kaulby monitor Hacker News comments?",
        answer:
          "Yes. Kaulby tracks both stories and comments on Hacker News, so you catch mentions regardless of where they appear in a thread.",
      },
      {
        question: "How quickly are HN mentions detected?",
        answer:
          "Pro plans scan every 4 hours and Team plans every 2 hours. For fast-moving HN discussions, the Team plan ensures you catch mentions while they are still active.",
      },
      {
        question: "Which plan includes Hacker News monitoring?",
        answer:
          "Hacker News is available on Pro ($29/mo) and Team ($99/mo) plans. It is not included in the free tier.",
      },
    ],
  },
  {
    slug: "producthunt",
    name: "Product Hunt",
    shortName: "PH",
    tier: "pro",
    description:
      "Monitor Product Hunt launches, track competitor products, and find early adopters discussing tools in your space.",
    heroHeadline: "Monitor Product Hunt Mentions",
    heroDescription:
      "Track Product Hunt launches, upvotes, and comments in real time. Know when competitors launch, when your product is discussed, and find early adopters seeking solutions like yours.",
    features: [
      {
        title: "Launch Day Monitoring",
        description:
          "Get instant alerts when competitors launch on Product Hunt. Track upvote velocity, comments, and community sentiment.",
      },
      {
        title: "Category Tracking",
        description:
          "Monitor entire product categories to spot emerging competitors and trends in your market.",
      },
      {
        title: "Comment Analysis",
        description:
          "PH comments reveal genuine user needs. Kaulby categorizes them as feature requests, praise, or pain points.",
      },
      {
        title: "Competitor Launch Alerts",
        description:
          "Know the moment a competitor launches on Product Hunt, along with community reaction analysis.",
      },
    ],
    useCases: [
      "Track competitor Product Hunt launches",
      "Find early adopters interested in your product category",
      "Monitor community reactions to similar products",
      "Identify feature gaps from user comments",
    ],
    exampleKeywords: [
      "launch today",
      "product feedback",
      "SaaS tools",
      "productivity app",
      "workflow automation",
    ],
    faqs: [
      {
        question: "Can Kaulby alert me when a competitor launches on Product Hunt?",
        answer:
          "Yes. Set up a monitor with your competitor's name as a keyword. You will get alerted when they launch or are mentioned in comments.",
      },
      {
        question: "Does Kaulby track Product Hunt upvotes?",
        answer:
          "Kaulby focuses on textual mentions and discussions. It monitors product descriptions, comments, and discussions rather than upvote counts.",
      },
    ],
  },
  {
    slug: "google-reviews",
    name: "Google Reviews",
    shortName: "Google Reviews",
    tier: "pro",
    description:
      "Monitor Google Reviews for your business or competitors. Track ratings, analyze review sentiment, and respond to feedback faster.",
    heroHeadline: "Monitor Google Reviews",
    heroDescription:
      "Track new Google Reviews for your business and competitors in real time. AI-powered sentiment analysis helps you identify trends, catch negative reviews early, and understand what customers love.",
    features: [
      {
        title: "Multi-Location Monitoring",
        description:
          "Track Google Reviews across all your business locations from a single dashboard.",
      },
      {
        title: "Review Sentiment Trends",
        description:
          "See how customer sentiment changes over time. Spot issues before they become a pattern.",
      },
      {
        title: "Competitor Review Analysis",
        description:
          "Monitor competitor Google Reviews to identify their weaknesses and your opportunities.",
      },
      {
        title: "Negative Review Alerts",
        description:
          "Get instantly alerted to negative reviews so you can respond quickly and resolve issues.",
      },
    ],
    useCases: [
      "Track and respond to new reviews across locations",
      "Monitor competitor review ratings and trends",
      "Identify recurring customer complaints",
      "Measure impact of service improvements on reviews",
    ],
    exampleKeywords: [
      "customer service issue",
      "great experience",
      "would not recommend",
      "five star service",
      "needs improvement",
    ],
    faqs: [
      {
        question: "How does Kaulby monitor Google Reviews?",
        answer:
          "Kaulby scans Google Reviews for your specified businesses and keywords. New reviews are analyzed for sentiment and categorized automatically.",
      },
      {
        question: "Can I monitor competitor Google Reviews?",
        answer:
          "Yes. Add competitor business names as keywords to track their reviews and sentiment trends alongside your own.",
      },
    ],
  },
  {
    slug: "youtube",
    name: "YouTube",
    shortName: "YouTube",
    tier: "pro",
    description:
      "Monitor YouTube video mentions, track brand discussions in comments, and analyze sentiment across video content.",
    heroHeadline: "Monitor YouTube Mentions",
    heroDescription:
      "Track when your brand, product, or industry is mentioned in YouTube videos and comments. AI-powered analysis helps you find review videos, competitor comparisons, and customer feedback.",
    features: [
      {
        title: "Video Title & Description Scanning",
        description:
          "Detect when your brand appears in video titles, descriptions, or tags across YouTube.",
      },
      {
        title: "Comment Monitoring",
        description:
          "Track mentions in YouTube comments where real user discussions happen.",
      },
      {
        title: "Review Video Detection",
        description:
          "Find YouTube creators reviewing or comparing products in your category.",
      },
      {
        title: "Sentiment Analysis",
        description:
          "AI analyzes whether mentions are positive reviews, negative complaints, or neutral references.",
      },
    ],
    useCases: [
      "Find YouTubers reviewing your product or competitors",
      "Track brand mentions in video comments",
      "Monitor tutorial and how-to videos in your niche",
      "Identify influencer opportunities",
    ],
    exampleKeywords: [
      "honest review",
      "comparison video",
      "tutorial walkthrough",
      "unboxing",
      "is it worth it",
    ],
    faqs: [
      {
        question: "Does Kaulby monitor YouTube video content or just comments?",
        answer:
          "Both. Kaulby tracks video titles, descriptions, and comments for your keywords. It does not perform speech-to-text analysis of video audio.",
      },
      {
        question: "Can I find YouTube influencers talking about my product?",
        answer:
          "Yes. Set up monitors with your brand and product category keywords to discover creators discussing your space.",
      },
    ],
  },
  {
    slug: "github",
    name: "GitHub",
    shortName: "GitHub",
    tier: "pro",
    description:
      "Monitor GitHub issues, discussions, and repositories. Track open-source projects, competitor repos, and developer sentiment.",
    heroHeadline: "Monitor GitHub Mentions",
    heroDescription:
      "Track mentions of your product in GitHub issues, discussions, and READMEs. Perfect for developer tools, open-source projects, and technical products that developers discuss on GitHub.",
    features: [
      {
        title: "Issue & Discussion Tracking",
        description:
          "Monitor when your product is mentioned in GitHub issues and discussions across any repository.",
      },
      {
        title: "Repository Monitoring",
        description:
          "Track activity in competitor or ecosystem repositories relevant to your product.",
      },
      {
        title: "Developer Sentiment",
        description:
          "Understand how developers feel about your tool based on GitHub discussions and issue reports.",
      },
      {
        title: "Integration Request Detection",
        description:
          "Find when developers request integrations with your product in third-party repositories.",
      },
    ],
    useCases: [
      "Track mentions in developer discussions and issues",
      "Monitor competitor open-source projects",
      "Find integration opportunities from community requests",
      "Gauge developer sentiment about your tools",
    ],
    exampleKeywords: [
      "bug report",
      "feature request",
      "breaking change",
      "migration guide",
      "security vulnerability",
    ],
    faqs: [
      {
        question: "What GitHub content does Kaulby monitor?",
        answer:
          "Kaulby monitors GitHub issues, discussions, and repository metadata. It searches for your keywords across public repositories.",
      },
      {
        question: "Is GitHub monitoring useful for non-developer products?",
        answer:
          "GitHub monitoring is most valuable for developer tools, APIs, and technical products. If your audience is not developers, other platforms may be more relevant.",
      },
    ],
  },
  {
    slug: "trustpilot",
    name: "Trustpilot",
    shortName: "Trustpilot",
    tier: "pro",
    description:
      "Monitor Trustpilot reviews for your brand and competitors. Track review sentiment, star ratings, and customer feedback trends.",
    heroHeadline: "Monitor Trustpilot Reviews",
    heroDescription:
      "Track Trustpilot reviews for your business and competitors. Get AI-powered sentiment analysis, negative review alerts, and competitive intelligence from the world's largest review platform.",
    features: [
      {
        title: "Real-Time Review Alerts",
        description:
          "Get notified immediately when new Trustpilot reviews are posted for your business.",
      },
      {
        title: "Competitor Review Tracking",
        description:
          "Monitor competitor Trustpilot profiles to identify their strengths, weaknesses, and customer complaints.",
      },
      {
        title: "Sentiment Trend Analysis",
        description:
          "Track how your review sentiment changes over time and correlate with product changes or events.",
      },
      {
        title: "Review Categorization",
        description:
          "AI categorizes reviews by topic: product quality, customer service, pricing, shipping, and more.",
      },
    ],
    useCases: [
      "Respond quickly to negative Trustpilot reviews",
      "Monitor competitor review trends and ratings",
      "Identify patterns in customer complaints",
      "Track impact of service improvements",
    ],
    exampleKeywords: [
      "refund problem",
      "excellent support",
      "shipping delay",
      "subscription cancellation",
      "best alternative",
    ],
    faqs: [
      {
        question: "How quickly does Kaulby detect new Trustpilot reviews?",
        answer:
          "Pro plans check every 4 hours and Team plans every 2 hours. This ensures you catch and respond to reviews within hours of posting.",
      },
      {
        question: "Can I track competitor Trustpilot reviews?",
        answer:
          "Yes. Add competitor names as keywords to monitor their Trustpilot reviews alongside your own.",
      },
    ],
  },
  {
    slug: "x-twitter",
    name: "X (Twitter)",
    shortName: "X",
    tier: "pro",
    description:
      "Monitor X/Twitter mentions, track brand conversations, and analyze real-time sentiment on the world's public conversation platform.",
    heroHeadline: "Monitor X (Twitter) Mentions",
    heroDescription:
      "Track brand mentions, competitor discussions, and industry conversations on X/Twitter. Kaulby's AI analyzes tweet sentiment, detects trending discussions, and alerts you to important mentions.",
    features: [
      {
        title: "Real-Time Mention Tracking",
        description:
          "Monitor tweets, replies, and quote tweets mentioning your brand or keywords.",
      },
      {
        title: "Hashtag & Topic Monitoring",
        description:
          "Track specific hashtags and topics relevant to your industry for competitive intelligence.",
      },
      {
        title: "Sentiment Analysis",
        description:
          "AI categorizes tweets as positive, negative, or neutral, helping you gauge public perception.",
      },
      {
        title: "Influencer Detection",
        description:
          "Identify when high-follower accounts discuss your brand or competitors.",
      },
    ],
    useCases: [
      "Track brand mentions and @replies",
      "Monitor competitor Twitter activity",
      "Detect potential PR crises early",
      "Find customer support opportunities",
    ],
    exampleKeywords: [
      "just launched",
      "anyone tried",
      "hot take",
      "thread about",
      "unpopular opinion",
    ],
    faqs: [
      {
        question: "Does Kaulby monitor X/Twitter in real time?",
        answer:
          "Kaulby scans X/Twitter on a schedule: every 4 hours on Pro and every 2 hours on Team. For true real-time monitoring, the Team plan with alerts gives the fastest response.",
      },
      {
        question: "Can I monitor Twitter hashtags?",
        answer:
          "Yes. Add hashtags as keywords in your monitor to track discussions using specific hashtags.",
      },
    ],
  },
  {
    slug: "indie-hackers",
    name: "Indie Hackers",
    shortName: "IH",
    tier: "pro",
    description:
      "Monitor Indie Hackers discussions, product launches, and founder conversations. Find early adopters and track competitor activity.",
    heroHeadline: "Monitor Indie Hackers Mentions",
    heroDescription:
      "Track discussions on Indie Hackers where founders share revenue numbers, product feedback, and tool recommendations. Find potential customers actively seeking solutions in your niche.",
    features: [
      {
        title: "Product Discussion Tracking",
        description:
          "Monitor when founders discuss products in your category or mention your brand on Indie Hackers.",
      },
      {
        title: "Revenue Milestone Posts",
        description:
          "Track milestone posts from founders in your space to identify potential partners or customers.",
      },
      {
        title: "Tool Recommendation Threads",
        description:
          "Find threads where founders ask for tool recommendations - perfect lead generation opportunities.",
      },
      {
        title: "Community Sentiment",
        description:
          "Understand how the indie maker community perceives products in your category.",
      },
    ],
    useCases: [
      "Find founders looking for tools in your niche",
      "Track competitor discussions among indie makers",
      "Identify product recommendation opportunities",
      "Monitor indie maker sentiment about your product",
    ],
    exampleKeywords: [
      "monthly revenue",
      "growth strategy",
      "bootstrapped SaaS",
      "marketing channels",
      "churn reduction",
    ],
    faqs: [
      {
        question: "Why monitor Indie Hackers?",
        answer:
          "Indie Hackers has a highly engaged community of founders and builders who actively discuss tools, share recommendations, and look for solutions. Mentions here often lead to direct conversions.",
      },
      {
        question: "Is Indie Hackers monitoring included in the free plan?",
        answer:
          "No. Indie Hackers monitoring requires a Pro ($29/mo) or Team ($99/mo) plan.",
      },
    ],
  },
  {
    slug: "devto",
    name: "Dev.to",
    shortName: "Dev.to",
    tier: "team",
    description:
      "Monitor Dev.to articles and discussions. Track technical content about your product, developer opinions, and industry trends.",
    heroHeadline: "Monitor Dev.to Mentions",
    heroDescription:
      "Track when developers write about your product, compare tools, or discuss pain points on Dev.to. Catch tutorial content, reviews, and technical discussions relevant to your brand.",
    features: [
      {
        title: "Article Mention Detection",
        description:
          "Find Dev.to articles that mention your product, competitors, or relevant technical topics.",
      },
      {
        title: "Technical Content Tracking",
        description:
          "Monitor tutorials, comparisons, and how-to articles in your product category.",
      },
      {
        title: "Developer Opinion Analysis",
        description:
          "AI analyzes developer sentiment in articles and comments about tools in your space.",
      },
      {
        title: "Trend Detection",
        description:
          "Spot emerging technical trends and shifting developer preferences early.",
      },
    ],
    useCases: [
      "Find articles comparing tools in your space",
      "Track developer tutorials mentioning your product",
      "Monitor technical discussions in your niche",
      "Identify content collaboration opportunities",
    ],
    exampleKeywords: [
      "getting started with",
      "best practices",
      "code review",
      "web development",
      "API integration",
    ],
    faqs: [
      {
        question: "What kind of Dev.to content does Kaulby track?",
        answer:
          "Kaulby monitors Dev.to articles and comments for your specified keywords. This includes tutorials, reviews, opinion pieces, and discussion threads.",
      },
      {
        question: "Which plan includes Dev.to monitoring?",
        answer:
          "Dev.to monitoring is available on the Team plan ($99/mo), which includes all 16 platforms.",
      },
    ],
  },
  {
    slug: "hashnode",
    name: "Hashnode",
    shortName: "Hashnode",
    tier: "team",
    description:
      "Monitor Hashnode blog posts and discussions. Track technical content, developer reviews, and mentions of your product.",
    heroHeadline: "Monitor Hashnode Mentions",
    heroDescription:
      "Track developer blog posts on Hashnode that mention your product or discuss your industry. Catch reviews, comparisons, and technical content from the developer blogging community.",
    features: [
      {
        title: "Blog Post Monitoring",
        description:
          "Detect when developers write Hashnode posts mentioning your product, APIs, or technical stack.",
      },
      {
        title: "Developer Insights",
        description:
          "Understand developer perspectives on your product through their long-form blog content.",
      },
      {
        title: "Comparison Detection",
        description:
          "Find blog posts comparing your product to alternatives in the developer ecosystem.",
      },
      {
        title: "Content Opportunity Alerts",
        description:
          "Identify when developers write about problems your product solves - perfect for outreach.",
      },
    ],
    useCases: [
      "Find developer blog posts about your product",
      "Track technical comparisons and reviews",
      "Monitor developer ecosystem trends",
      "Identify content partnership opportunities",
    ],
    exampleKeywords: [
      "technical deep dive",
      "system design",
      "developer experience",
      "cloud architecture",
      "performance optimization",
    ],
    faqs: [
      {
        question: "Why monitor Hashnode?",
        answer:
          "Hashnode is a popular developer blogging platform. Posts here often rank well in search engines and influence developer tool adoption decisions.",
      },
      {
        question: "Which plan includes Hashnode monitoring?",
        answer:
          "Hashnode monitoring is available on the Team plan ($99/mo), which includes all 16 platforms.",
      },
      {
        question: "How is Hashnode different from Dev.to monitoring?",
        answer:
          "Both are developer blogging platforms, but they have different communities and content styles. Hashnode blogs are often more in-depth technical posts, while Dev.to leans toward tutorials and quick tips. Monitoring both gives you broader coverage of developer content.",
      },
    ],
  },
  {
    slug: "app-store",
    name: "App Store",
    shortName: "App Store",
    tier: "team",
    description:
      "Monitor Apple App Store reviews for your app and competitors. Track ratings, review sentiment, and user feedback trends.",
    heroHeadline: "Monitor App Store Reviews",
    heroDescription:
      "Track Apple App Store reviews for your iOS app and competitors. AI-powered analysis categorizes reviews by sentiment, feature requests, and bug reports to prioritize your product roadmap.",
    features: [
      {
        title: "Review Alert System",
        description:
          "Get notified of new App Store reviews, especially low-rating reviews that need immediate attention.",
      },
      {
        title: "Feature Request Detection",
        description:
          "AI identifies feature requests from user reviews to inform your product roadmap.",
      },
      {
        title: "Competitor App Monitoring",
        description:
          "Track competitor app reviews to find their weaknesses and user pain points.",
      },
      {
        title: "Rating Trend Analysis",
        description:
          "Monitor how your app's rating changes over time and correlate with release updates.",
      },
    ],
    useCases: [
      "Track and respond to negative app reviews",
      "Monitor competitor app review trends",
      "Extract feature requests from user reviews",
      "Correlate review sentiment with app releases",
    ],
    exampleKeywords: [
      "app crashes",
      "battery drain",
      "subscription pricing",
      "missing feature",
      "latest update",
    ],
    faqs: [
      {
        question: "Which App Store is monitored?",
        answer:
          "Kaulby monitors the Apple App Store (iOS). Play Store monitoring is available as a separate platform.",
      },
      {
        question: "Can I monitor competitor apps?",
        answer:
          "Yes. Add competitor app names as keywords to track their reviews alongside your own.",
      },
    ],
  },
  {
    slug: "play-store",
    name: "Google Play Store",
    shortName: "Play Store",
    tier: "team",
    description:
      "Monitor Google Play Store reviews for your Android app. Track ratings, sentiment, and competitive intelligence from user feedback.",
    heroHeadline: "Monitor Play Store Reviews",
    heroDescription:
      "Track Google Play Store reviews for your Android app and competitors. AI analyzes review sentiment, detects bug reports and feature requests, and alerts you to negative feedback.",
    features: [
      {
        title: "Android Review Monitoring",
        description:
          "Track all new Play Store reviews for your app with automatic sentiment analysis.",
      },
      {
        title: "Bug Report Detection",
        description:
          "AI identifies reviews reporting bugs or crashes so your team can prioritize fixes.",
      },
      {
        title: "Cross-Platform Comparison",
        description:
          "Compare Play Store feedback with App Store reviews to identify platform-specific issues.",
      },
      {
        title: "Review Volume Tracking",
        description:
          "Monitor review volume and sentiment trends across app updates.",
      },
    ],
    useCases: [
      "Respond quickly to negative Play Store reviews",
      "Track competitor Android app reviews",
      "Identify platform-specific bugs from user feedback",
      "Monitor review impact of new releases",
    ],
    exampleKeywords: [
      "not working on",
      "too many ads",
      "great app but",
      "needs dark mode",
      "customer support",
    ],
    faqs: [
      {
        question: "Does Kaulby monitor both App Store and Play Store?",
        answer:
          "Yes. Both the Apple App Store and Google Play Store are available as separate monitoring platforms on the Team plan.",
      },
      {
        question: "Can I track Play Store reviews for specific Android versions?",
        answer:
          "Kaulby monitors all reviews regardless of Android version. However, AI analysis can detect when users mention specific device models or OS versions in their feedback, helping you identify platform-specific issues.",
      },
      {
        question: "How does Play Store monitoring help with app development?",
        answer:
          "Play Store reviews are a goldmine for product feedback. Kaulby's AI categorizes reviews into bug reports, feature requests, and general sentiment, giving your development team actionable insights to prioritize fixes and improvements.",
      },
    ],
  },
  // quora entry removed 2026-04-22 — platform deferred, /monitor/quora SEO page no
  // longer generated. See .mdmp/apify-platform-cost-audit-2026-04-21.md.
  {
    slug: "g2",
    name: "G2",
    shortName: "G2",
    tier: "team",
    description:
      "Monitor G2 software reviews for your product and competitors. Track ratings, comparison traffic, and buyer intent signals.",
    heroHeadline: "Monitor G2 Reviews",
    heroDescription:
      "Track G2 reviews for your software product and competitors. G2 is where B2B buyers research tools before purchasing - monitor reviews, comparisons, and category trends.",
    features: [
      {
        title: "B2B Review Monitoring",
        description:
          "Track new G2 reviews for your product with AI-powered sentiment and category analysis.",
      },
      {
        title: "Competitive Intelligence",
        description:
          "Monitor competitor G2 profiles and reviews to identify positioning opportunities.",
      },
      {
        title: "Buyer Intent Signals",
        description:
          "Detect when potential buyers are comparing products in your category on G2.",
      },
      {
        title: "Category Trend Tracking",
        description:
          "Monitor your G2 software category for emerging competitors and shifting buyer preferences.",
      },
    ],
    useCases: [
      "Track and respond to G2 reviews",
      "Monitor competitor review sentiment",
      "Identify buyer intent and comparison patterns",
      "Track your G2 category rankings and trends",
    ],
    exampleKeywords: [
      "ease of use",
      "implementation time",
      "customer support rating",
      "ROI analysis",
      "switching from",
    ],
    faqs: [
      {
        question: "Why monitor G2 specifically?",
        answer:
          "G2 is the leading B2B software review platform. Reviews here directly influence purchasing decisions, making it critical for B2B companies to monitor and respond to feedback.",
      },
      {
        question: "Which plan includes G2 monitoring?",
        answer:
          "G2 monitoring is available on the Team plan ($99/mo), which includes all 16 platforms.",
      },
      {
        question: "Can I track G2 comparison pages?",
        answer:
          "Kaulby monitors G2 reviews and discussions for your keywords. This includes mentions in comparison pages and category listings where buyers evaluate competing products side by side.",
      },
    ],
  },
  {
    slug: "yelp",
    name: "Yelp",
    shortName: "Yelp",
    tier: "team",
    description:
      "Monitor Yelp reviews for your business locations. Track customer feedback, ratings, and competitor review trends.",
    heroHeadline: "Monitor Yelp Reviews",
    heroDescription:
      "Track Yelp reviews for your business and competitors. Get AI-powered analysis of customer sentiment, identify recurring complaints, and respond to feedback faster.",
    features: [
      {
        title: "Multi-Location Tracking",
        description:
          "Monitor Yelp reviews across all your business locations from one dashboard.",
      },
      {
        title: "Negative Review Alerts",
        description:
          "Get instant alerts when negative reviews are posted so you can respond and resolve issues quickly.",
      },
      {
        title: "Competitor Analysis",
        description:
          "Track competitor Yelp reviews to identify their service gaps and your differentiation opportunities.",
      },
      {
        title: "Review Theme Analysis",
        description:
          "AI groups reviews by theme - food quality, service speed, ambiance, pricing - to surface actionable insights.",
      },
    ],
    useCases: [
      "Respond quickly to negative Yelp reviews",
      "Track competitor business reviews",
      "Identify recurring customer complaints by theme",
      "Monitor review trends across locations",
    ],
    exampleKeywords: [
      "wait time",
      "staff was helpful",
      "overpriced",
      "hidden gem",
      "family friendly",
    ],
    faqs: [
      {
        question: "Is Yelp monitoring useful for online businesses?",
        answer:
          "Yelp is most valuable for businesses with physical locations (restaurants, retail, services). For online-only businesses, platforms like G2 or Trustpilot may be more relevant.",
      },
      {
        question: "Can I monitor multiple Yelp business locations?",
        answer:
          "Yes. You can set up separate keywords for each business location. On the Team plan, you get up to 30 monitors, which is plenty for tracking multiple locations and competitors.",
      },
      {
        question: "How does Kaulby categorize Yelp reviews?",
        answer:
          "Kaulby's AI groups Yelp reviews by theme such as food quality, service speed, cleanliness, pricing, and staff behavior. This helps you identify systemic issues rather than one-off complaints.",
      },
    ],
  },
  {
    slug: "amazon-reviews",
    name: "Amazon Reviews",
    shortName: "Amazon",
    tier: "team",
    description:
      "Monitor Amazon product reviews. Track customer feedback, competitor product reviews, and buyer sentiment trends.",
    heroHeadline: "Monitor Amazon Reviews",
    heroDescription:
      "Track Amazon product reviews for your products and competitors. AI-powered analysis identifies common complaints, feature requests, and buyer sentiment to inform product development.",
    features: [
      {
        title: "Product Review Tracking",
        description:
          "Monitor all new reviews for your Amazon products with automated sentiment classification.",
      },
      {
        title: "Competitor Product Analysis",
        description:
          "Track competitor product reviews to identify their weaknesses and your market opportunities.",
      },
      {
        title: "Review Theme Detection",
        description:
          "AI groups Amazon reviews by theme: product quality, packaging, shipping, value, to surface patterns.",
      },
      {
        title: "Rating Trend Alerts",
        description:
          "Get alerted when your product's average rating drops or review volume changes significantly.",
      },
    ],
    useCases: [
      "Track reviews for your Amazon products",
      "Monitor competitor product feedback",
      "Extract product improvement ideas from reviews",
      "Detect quality issues from negative review patterns",
    ],
    exampleKeywords: [
      "stopped working after",
      "great value for money",
      "cheap alternative",
      "build quality",
      "fast shipping",
    ],
    faqs: [
      {
        question: "Does Kaulby monitor Amazon seller feedback?",
        answer:
          "Kaulby focuses on product reviews rather than seller feedback. It tracks reviews mentioning your specified keywords across Amazon product listings.",
      },
      {
        question: "Can I monitor reviews for competitor products on Amazon?",
        answer:
          "Yes. Add competitor product names or category terms as keywords to track their reviews. This helps you identify weaknesses in competing products and opportunities for differentiation.",
      },
      {
        question: "How does Amazon review monitoring help product development?",
        answer:
          "Kaulby's AI categorizes Amazon reviews by theme such as product quality, packaging, value for money, and durability. These insights help product teams prioritize improvements based on real customer feedback patterns.",
      },
    ],
  },
];

/**
 * Lookup map by slug for efficient access
 */
export const PLATFORM_BY_SLUG: Record<string, PlatformData> = Object.fromEntries(
  PLATFORMS.map((p) => [p.slug, p])
);

/**
 * All platform slugs for generateStaticParams() and sitemap
 */
export const ALL_PLATFORM_SLUGS = PLATFORMS.map((p) => p.slug);

/**
 * Use case metadata for programmatic SEO pages
 *
 * Used by:
 * - src/app/(marketing)/use-case/[slug]/page.tsx
 * - src/app/sitemap.ts
 */

export interface UseCaseData {
  slug: string;
  title: string;
  headline: string;
  description: string;
  metaDescription: string;
  features: {
    title: string;
    description: string;
  }[];
  relevantPlatforms: string[];
  exampleKeywords: string[];
  benefits: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const USE_CASES: UseCaseData[] = [
  {
    slug: "brand-monitoring",
    title: "Brand Monitoring Tool",
    headline: "Monitor Your Brand Across 17 Platforms",
    description:
      "Track every mention of your brand across Reddit, Hacker News, Product Hunt, review sites, and more. Know exactly what people are saying about your business in real time.",
    metaDescription:
      "Monitor brand mentions across 16 platforms including Reddit, Hacker News, and review sites. AI-powered sentiment analysis and instant alerts. Free plan available.",
    features: [
      {
        title: "Multi-Platform Coverage",
        description:
          "Track brand mentions across Reddit, Hacker News, Product Hunt, Trustpilot, G2, YouTube, and 11 more platforms from a single dashboard.",
      },
      {
        title: "Sentiment Analysis",
        description:
          "AI automatically classifies mentions as positive, negative, or neutral, helping you understand brand perception at a glance.",
      },
      {
        title: "Instant Alerts",
        description:
          "Get notified via email, Slack, or webhooks the moment someone mentions your brand. Respond to feedback before it gains traction.",
      },
      {
        title: "Historical Trend Analysis",
        description:
          "Track how brand sentiment changes over time. Correlate mention volume with product launches, marketing campaigns, or PR events.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "Product Hunt",
      "X/Twitter",
      "Trustpilot",
      "G2",
      "Google Reviews",
      "YouTube",
    ],
    exampleKeywords: [
      "your brand name",
      "product name",
      "brand misspellings",
      "branded hashtags",
      "CEO or founder name",
    ],
    benefits: [
      "Respond to customer feedback within hours, not days",
      "Catch negative mentions before they go viral",
      "Identify brand advocates and potential ambassadors",
      "Measure the impact of PR campaigns on brand perception",
    ],
    faqs: [
      {
        question: "How many platforms can I monitor for brand mentions?",
        answer:
          "Kaulby monitors up to 16 platforms depending on your plan. The free plan covers Reddit, Pro covers 9 platforms, and Team covers all 17 including review sites and app stores.",
      },
      {
        question: "How quickly will I be notified of new mentions?",
        answer:
          "Scan frequency depends on your plan: every 24 hours (Free), every 4 hours (Pro), or every 2 hours (Team). Team plans also include twice-daily email digests.",
      },
      {
        question: "Can I track misspellings of my brand name?",
        answer:
          "Yes. Add common misspellings as additional keywords in your monitor. You can set up to 20 keywords per monitor on the Team plan.",
      },
    ],
  },
  {
    slug: "competitor-analysis",
    title: "Competitor Analysis Tool",
    headline: "Track What People Say About Your Competitors",
    description:
      "Monitor competitor mentions across community platforms, review sites, and social media. Understand their strengths, weaknesses, and customer sentiment to find your competitive edge.",
    metaDescription:
      "Monitor competitor mentions across 16 platforms. AI-powered sentiment analysis reveals competitor strengths, weaknesses, and customer pain points. Start free.",
    features: [
      {
        title: "Competitor Mention Tracking",
        description:
          "Set up monitors with competitor names as keywords to track every mention across Reddit, HN, review sites, and more.",
      },
      {
        title: "Sentiment Comparison",
        description:
          "Compare sentiment scores between your brand and competitors to understand relative perception.",
      },
      {
        title: "Pain Point Discovery",
        description:
          "AI identifies complaints and frustrations users express about competitors - opportunities for your positioning.",
      },
      {
        title: "Feature Gap Analysis",
        description:
          "Track feature requests made by competitor users to identify unmet needs your product can address.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "G2",
      "Trustpilot",
      "Product Hunt",
      "App Store",
      "Play Store",
    ],
    exampleKeywords: [
      "competitor brand names",
      "competitor product names",
      "\"alternative to [competitor]\"",
      "\"[competitor] vs\"",
      "\"switching from [competitor]\"",
    ],
    benefits: [
      "Identify competitor weaknesses from real user feedback",
      "Spot users actively looking for alternatives",
      "Track competitor launches and community reactions",
      "Inform product positioning with competitor sentiment data",
    ],
    faqs: [
      {
        question: "How do I set up competitor monitoring?",
        answer:
          "Create a monitor and add competitor names as keywords. Kaulby will track all mentions of those keywords across your selected platforms and analyze sentiment automatically.",
      },
      {
        question: "Can I compare my brand sentiment to competitors?",
        answer:
          "Yes. Set up separate monitors for your brand and each competitor. The dashboard shows sentiment breakdowns that you can compare across monitors.",
      },
    ],
  },
  {
    slug: "customer-feedback",
    title: "Customer Feedback Monitoring",
    headline: "Capture Customer Feedback From Every Corner of the Internet",
    description:
      "Stop relying on surveys alone. Monitor what customers say about your product in communities, forums, review sites, and social media where they speak candidly.",
    metaDescription:
      "Monitor customer feedback across Reddit, review sites, and 15 more platforms. AI categorizes feedback as feature requests, complaints, or praise. Start free.",
    features: [
      {
        title: "Unfiltered Feedback Collection",
        description:
          "Capture honest feedback from places where customers speak freely - Reddit threads, review sites, community forums, and social media.",
      },
      {
        title: "Automatic Categorization",
        description:
          "AI categorizes feedback as feature requests, bug reports, praise, complaints, or questions - no manual sorting needed.",
      },
      {
        title: "Feature Request Aggregation",
        description:
          "Track which features are most requested by real users to prioritize your product roadmap with data.",
      },
      {
        title: "Feedback Trend Analysis",
        description:
          "See how feedback themes change over time. Track whether product updates successfully address user concerns.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "G2",
      "Trustpilot",
      "App Store",
      "Play Store",
      "Google Reviews",
      "Yelp",
      "Amazon Reviews",
    ],
    exampleKeywords: [
      "product name",
      "product name + \"wish\"",
      "product name + \"missing\"",
      "product name + \"love\"",
      "product name + \"hate\"",
    ],
    benefits: [
      "Discover feedback you would never get from NPS surveys",
      "Prioritize your roadmap with real user demand data",
      "Reduce churn by addressing complaints faster",
      "Identify your product's most-loved features for marketing",
    ],
    faqs: [
      {
        question: "How is this different from in-app feedback tools?",
        answer:
          "In-app tools like Canny or UserVoice capture solicited feedback. Kaulby captures unsolicited feedback from public platforms where users speak more candidly and in greater detail.",
      },
      {
        question: "Can I export feedback data?",
        answer:
          "Yes. Pro plans include CSV export, and Team plans include full API access for integrating feedback data into your existing tools.",
      },
    ],
  },
  {
    slug: "product-launch",
    title: "Product Launch Monitoring",
    headline: "Monitor Your Product Launch Across the Internet",
    description:
      "Track how your product launch is received across Reddit, Hacker News, Product Hunt, and other platforms. Measure sentiment, engagement, and reach in real time.",
    metaDescription:
      "Monitor product launch reception across Reddit, Hacker News, Product Hunt, and more. Track sentiment, engagement, and community reactions. Start free.",
    features: [
      {
        title: "Launch Day Dashboard",
        description:
          "Track mention volume, sentiment, and engagement across all platforms during your launch window.",
      },
      {
        title: "Platform-Specific Tracking",
        description:
          "Monitor your Product Hunt launch, HN Show HN post, and Reddit submissions simultaneously.",
      },
      {
        title: "Sentiment Tracking",
        description:
          "Gauge community reaction to your launch in real time. Catch negative sentiment early and address it.",
      },
      {
        title: "Post-Launch Analysis",
        description:
          "Review comprehensive analytics on your launch performance across platforms after the initial buzz.",
      },
    ],
    relevantPlatforms: [
      "Product Hunt",
      "Hacker News",
      "Reddit",
      "X/Twitter",
      "Indie Hackers",
      "Dev.to",
    ],
    exampleKeywords: [
      "product name",
      "launch tagline keywords",
      "founder name",
      "Show HN: product name",
    ],
    benefits: [
      "Track launch reception across multiple platforms at once",
      "Respond to questions and feedback during the critical launch window",
      "Measure launch success with sentiment and volume metrics",
      "Learn from community feedback to iterate quickly post-launch",
    ],
    faqs: [
      {
        question: "Should I set up monitoring before my launch?",
        answer:
          "Absolutely. Create your monitors 24-48 hours before launch so Kaulby is already scanning when discussions start. This ensures you catch the earliest mentions.",
      },
      {
        question: "Which platforms are most important for launch monitoring?",
        answer:
          "For tech products, Product Hunt, Hacker News, and Reddit are the most critical. For B2B, add G2 and LinkedIn mentions. For consumer products, add review sites.",
      },
    ],
  },
  {
    slug: "lead-generation",
    title: "Lead Generation from Community Discussions",
    headline: "Find Warm Leads in Online Discussions",
    description:
      "Identify potential customers actively discussing problems your product solves. Turn community conversations into qualified leads with AI-powered pain point detection.",
    metaDescription:
      "Find warm leads from Reddit, Hacker News, and community discussions. AI detects users looking for solutions your product provides. Start free.",
    features: [
      {
        title: "Pain Point Detection",
        description:
          "AI identifies users expressing frustration or actively seeking solutions - your warmest leads.",
      },
      {
        title: "\"Alternative to\" Tracking",
        description:
          "Find users searching for alternatives to competitors. These users are actively evaluating and ready to switch.",
      },
      {
        title: "Recommendation Request Alerts",
        description:
          "Get alerted when someone asks for tool recommendations in your product category.",
      },
      {
        title: "Lead Scoring",
        description:
          "Kaulby scores mentions by purchase intent, helping you prioritize the highest-value leads.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "Quora",
      "Indie Hackers",
      "Product Hunt",
      "X/Twitter",
    ],
    exampleKeywords: [
      "\"looking for\"",
      "\"alternative to [competitor]\"",
      "\"recommend a\"",
      "\"best tool for\"",
      "\"help me find\"",
    ],
    benefits: [
      "Find buyers already looking for your type of product",
      "Engage prospects in natural, non-spammy conversations",
      "Reduce customer acquisition cost vs. paid ads",
      "Build genuine relationships with potential customers",
    ],
    faqs: [
      {
        question: "How do I use Kaulby for lead generation?",
        answer:
          "Set up monitors with keywords like \"looking for [your category]\", \"alternative to [competitor]\", and \"recommend a [tool type]\". Kaulby will alert you when someone posts these phrases, giving you a natural opportunity to engage.",
      },
      {
        question: "Is this spammy?",
        answer:
          "No. Kaulby helps you find conversations where your product is genuinely relevant. You respond helpfully to real questions rather than blasting promotional messages.",
      },
    ],
  },
  {
    slug: "reputation-management",
    title: "Online Reputation Management",
    headline: "Protect and Manage Your Online Reputation",
    description:
      "Monitor mentions across review sites, forums, and social platforms. Catch negative sentiment early, respond to criticism, and protect your brand's reputation.",
    metaDescription:
      "Monitor and manage your online reputation across 16 platforms. AI-powered sentiment alerts help you catch and address negative mentions early. Start free.",
    features: [
      {
        title: "Negative Mention Alerts",
        description:
          "Get instant alerts when negative mentions of your brand appear, giving you time to respond before issues escalate.",
      },
      {
        title: "Review Site Monitoring",
        description:
          "Track reviews on Trustpilot, G2, Google Reviews, Yelp, App Store, Play Store, and Amazon Reviews.",
      },
      {
        title: "Sentiment Trend Dashboard",
        description:
          "Visualize how your brand sentiment changes over time across all monitored platforms.",
      },
      {
        title: "Crisis Detection",
        description:
          "AI detects unusual spikes in negative sentiment, alerting you to potential reputation crises early.",
      },
    ],
    relevantPlatforms: [
      "Trustpilot",
      "G2",
      "Google Reviews",
      "Yelp",
      "Reddit",
      "X/Twitter",
      "App Store",
      "Play Store",
    ],
    exampleKeywords: [
      "brand name",
      "product name",
      "CEO name",
      "brand + \"scam\"",
      "brand + \"terrible\"",
    ],
    benefits: [
      "Respond to negative reviews within hours instead of weeks",
      "Prevent small issues from becoming viral PR crises",
      "Track reputation recovery after addressing issues",
      "Build trust by showing responsiveness to feedback",
    ],
    faqs: [
      {
        question: "How does Kaulby help with reputation management?",
        answer:
          "Kaulby continuously monitors 16 platforms for mentions of your brand. AI analyzes sentiment and categorizes mentions, alerting you immediately when negative content appears so you can respond quickly.",
      },
      {
        question: "Can Kaulby remove negative reviews?",
        answer:
          "No. Kaulby is a monitoring tool, not a review removal service. It helps you detect negative reviews quickly so you can respond, resolve issues, and improve your ratings over time.",
      },
    ],
  },
  {
    slug: "market-research",
    title: "Market Research Tool",
    headline: "Research Your Market Through Real Community Discussions",
    description:
      "Understand your market by monitoring what real people say about your industry, competitors, and product category across online communities.",
    metaDescription:
      "Conduct market research using real community discussions. Monitor industry trends, competitor sentiment, and customer needs across 16 platforms. Start free.",
    features: [
      {
        title: "Industry Trend Monitoring",
        description:
          "Track industry-specific keywords to identify emerging trends, shifting preferences, and market opportunities.",
      },
      {
        title: "Customer Language Analysis",
        description:
          "Learn how real users describe their problems and needs - invaluable for messaging and positioning.",
      },
      {
        title: "Competitive Landscape Mapping",
        description:
          "Monitor all competitors in your space to understand market positioning and user preferences.",
      },
      {
        title: "Demand Signal Detection",
        description:
          "Identify unmet needs and underserved market segments from community discussions.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "Quora",
      "Product Hunt",
      "G2",
      "Indie Hackers",
      "X/Twitter",
    ],
    exampleKeywords: [
      "industry category terms",
      "\"need a tool for\"",
      "product category + \"frustrating\"",
      "\"wish there was\"",
      "competitor names",
    ],
    benefits: [
      "Get unbiased market intelligence from real user discussions",
      "Identify market gaps before competitors do",
      "Validate product ideas with real demand signals",
      "Understand how users talk about your product category",
    ],
    faqs: [
      {
        question: "How is this better than traditional market research?",
        answer:
          "Traditional market research relies on surveys and focus groups where people give filtered answers. Kaulby captures organic discussions where people express genuine needs, frustrations, and preferences without knowing they are being observed.",
      },
      {
        question: "Can I use Kaulby to validate a product idea?",
        answer:
          "Yes. Set up monitors with keywords related to the problem your product would solve. If you see frequent discussions and pain points, there is likely demand for a solution.",
      },
    ],
  },
  {
    slug: "developer-relations",
    title: "DevRel Monitoring",
    headline: "Monitor Developer Conversations About Your Tools",
    description:
      "Track how developers discuss your APIs, SDKs, and tools across GitHub, Hacker News, Dev.to, and Reddit. Essential for developer relations teams.",
    metaDescription:
      "Monitor developer discussions about your APIs and tools across GitHub, Hacker News, Dev.to, Reddit, and more. Built for DevRel teams. Start free.",
    features: [
      {
        title: "Developer Platform Coverage",
        description:
          "Monitor GitHub issues, HN discussions, Dev.to articles, Hashnode posts, and Reddit threads - where developers actually talk.",
      },
      {
        title: "Integration Request Tracking",
        description:
          "Find when developers request integrations with your tool in third-party projects and discussions.",
      },
      {
        title: "Documentation Feedback",
        description:
          "Catch when developers complain about documentation gaps or share workarounds for your API.",
      },
      {
        title: "Community Health Metrics",
        description:
          "Track developer sentiment over time to measure the health and growth of your developer community.",
      },
    ],
    relevantPlatforms: [
      "GitHub",
      "Hacker News",
      "Dev.to",
      "Hashnode",
      "Reddit",
    ],
    exampleKeywords: [
      "SDK or API name",
      "package or library name",
      "\"how to use [your tool]\"",
      "error messages from your tool",
      "competitor tool names",
    ],
    benefits: [
      "Respond to developer questions and issues faster",
      "Identify documentation gaps from real developer struggles",
      "Track community growth and engagement metrics",
      "Find developer advocates and contributors",
    ],
    faqs: [
      {
        question: "Which platforms are most important for DevRel monitoring?",
        answer:
          "GitHub, Hacker News, and Reddit are the most critical for DevRel. Dev.to and Hashnode are valuable for tracking blog content about your tools. All are available on Kaulby.",
      },
      {
        question: "Can I track error messages from my tool?",
        answer:
          "Yes. Add common error messages or error codes as keywords. When developers post about these errors in forums, you will be alerted so you can help or update documentation.",
      },
    ],
  },
  {
    slug: "content-ideas",
    title: "Content Idea Discovery",
    headline: "Find Content Ideas From Real Community Questions",
    description:
      "Discover blog post topics, video ideas, and content gaps by monitoring what your audience actually asks about in online communities.",
    metaDescription:
      "Discover content ideas from real community questions on Reddit, Quora, and 15 more platforms. AI identifies trending topics and common questions. Start free.",
    features: [
      {
        title: "Question Monitoring",
        description:
          "Track questions people ask about your industry across Reddit, Quora, and forums to generate content that answers real needs.",
      },
      {
        title: "Trending Topic Detection",
        description:
          "Identify topics gaining traction in your niche before they become saturated - first-mover advantage for content.",
      },
      {
        title: "Content Gap Identification",
        description:
          "Find questions with no good answers - opportunities for your content to rank and provide value.",
      },
      {
        title: "Keyword Research Enhancement",
        description:
          "Supplement traditional keyword research with the exact language your audience uses in discussions.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Quora",
      "Hacker News",
      "Dev.to",
      "YouTube",
      "Indie Hackers",
    ],
    exampleKeywords: [
      "\"how do I\"",
      "\"what is the best\"",
      "\"help with\"",
      "industry topic + \"guide\"",
      "\"explain\"",
    ],
    benefits: [
      "Create content that directly answers real questions",
      "Improve SEO by targeting phrases people actually use",
      "Never run out of content ideas again",
      "Prioritize content topics by community interest level",
    ],
    faqs: [
      {
        question: "How do I find content ideas with Kaulby?",
        answer:
          "Set up monitors with question-pattern keywords like \"how do I\", \"what is the best\", and \"help with\" combined with your industry terms. Kaulby will surface the most-asked questions in your niche.",
      },
      {
        question: "Can I see which content topics are trending?",
        answer:
          "Yes. Kaulby tracks mention volume over time, so you can see which topics are gaining traction in your monitored communities.",
      },
    ],
  },
  {
    slug: "crisis-monitoring",
    title: "Crisis Detection & Monitoring",
    headline: "Detect Brand Crises Before They Escalate",
    description:
      "Monitor for sudden spikes in negative mentions across all platforms. Catch brewing PR crises early and respond before they gain momentum.",
    metaDescription:
      "Detect PR crises early with AI-powered monitoring across 16 platforms. Get instant alerts on negative mention spikes. Protect your brand. Start free.",
    features: [
      {
        title: "Anomaly Detection",
        description:
          "AI detects unusual spikes in mention volume or negative sentiment, flagging potential crises before they escalate.",
      },
      {
        title: "Multi-Platform Coverage",
        description:
          "Crises can start anywhere. Monitor 16 platforms simultaneously so nothing slips through the cracks.",
      },
      {
        title: "Instant Alerts",
        description:
          "Get immediately notified via email, Slack, or webhooks when crisis-level activity is detected.",
      },
      {
        title: "Sentiment Shift Tracking",
        description:
          "Track how sentiment changes during and after a crisis to measure the effectiveness of your response.",
      },
    ],
    relevantPlatforms: [
      "X/Twitter",
      "Reddit",
      "Hacker News",
      "Trustpilot",
      "Google Reviews",
      "YouTube",
      "G2",
    ],
    exampleKeywords: [
      "brand name",
      "brand + \"scandal\"",
      "brand + \"outage\"",
      "brand + \"data breach\"",
      "brand + \"lawsuit\"",
    ],
    benefits: [
      "Catch crises within hours, not days",
      "Respond to issues before they go viral",
      "Track crisis sentiment recovery over time",
      "Build a crisis response playbook from historical data",
    ],
    faqs: [
      {
        question: "Can Kaulby predict crises?",
        answer:
          "Kaulby detects early signals like unusual spikes in negative mentions. While it cannot predict the future, catching these signals early gives you a critical response window.",
      },
      {
        question: "What alert channels does Kaulby support?",
        answer:
          "Email alerts are available on Pro and Team plans. Slack integration is on Pro and Team. Webhooks are Team-only, enabling integration with your incident response tools.",
      },
    ],
  },
  {
    slug: "sentiment-analysis",
    title: "Sentiment Analysis Tool",
    headline: "AI-Powered Sentiment Analysis Across 17 Platforms",
    description:
      "Automatically analyze the sentiment of every mention of your brand. Understand whether people are praising, complaining, or asking questions about your product.",
    metaDescription:
      "AI-powered sentiment analysis for brand mentions across 16 platforms. Classify mentions as positive, negative, or neutral automatically. Start free.",
    features: [
      {
        title: "Automatic Classification",
        description:
          "Every mention is automatically classified as positive, negative, or neutral by AI - no manual review needed.",
      },
      {
        title: "Pain Point Categorization",
        description:
          "Beyond simple sentiment, AI categorizes mentions as feature requests, bug reports, praise, complaints, or questions.",
      },
      {
        title: "Sentiment Trends",
        description:
          "Track sentiment over time to measure the impact of product changes, marketing campaigns, and PR events.",
      },
      {
        title: "Cross-Platform Analysis",
        description:
          "Compare sentiment across platforms. Are Reddit users more negative than Product Hunt users? Find out.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "Trustpilot",
      "G2",
      "Google Reviews",
      "X/Twitter",
      "Product Hunt",
      "YouTube",
    ],
    exampleKeywords: [
      "brand name",
      "product name",
      "competitor names",
      "product category",
    ],
    benefits: [
      "Understand brand perception at scale without manual review",
      "Identify which product changes improve or hurt sentiment",
      "Compare your sentiment to competitors objectively",
      "Report on brand health with quantified data",
    ],
    faqs: [
      {
        question: "How accurate is Kaulby's sentiment analysis?",
        answer:
          "Kaulby uses advanced AI models to analyze sentiment with high accuracy. The AI understands context, sarcasm, and nuance that simple keyword matching would miss.",
      },
      {
        question: "Can I see individual mention sentiment?",
        answer:
          "Yes. Every mention in your dashboard shows its sentiment classification (positive, negative, neutral) along with the AI's categorization (feature request, complaint, praise, etc.).",
      },
    ],
  },
  {
    slug: "review-monitoring",
    title: "Review Monitoring Tool",
    headline: "Monitor Reviews Across Every Major Review Platform",
    description:
      "Track customer reviews on Trustpilot, G2, Google Reviews, Yelp, App Store, Play Store, and Amazon Reviews from a single dashboard.",
    metaDescription:
      "Monitor customer reviews across Trustpilot, G2, Google Reviews, Yelp, App Store, Play Store, and Amazon. AI-powered analysis. Start free.",
    features: [
      {
        title: "7 Review Platforms",
        description:
          "Monitor Trustpilot, G2, Google Reviews, Yelp, App Store, Play Store, and Amazon Reviews in one place.",
      },
      {
        title: "Negative Review Alerts",
        description:
          "Get alerted instantly when low-rating reviews appear so you can respond and resolve issues quickly.",
      },
      {
        title: "Competitor Review Tracking",
        description:
          "Monitor competitor reviews to identify their weaknesses and find positioning opportunities.",
      },
      {
        title: "Review Theme Analysis",
        description:
          "AI groups reviews by theme (quality, service, pricing, etc.) to surface actionable patterns.",
      },
    ],
    relevantPlatforms: [
      "Trustpilot",
      "G2",
      "Google Reviews",
      "Yelp",
      "App Store",
      "Play Store",
      "Amazon Reviews",
    ],
    exampleKeywords: [
      "business name",
      "product name",
      "app name",
      "competitor names",
    ],
    benefits: [
      "Never miss a customer review on any platform",
      "Respond to negative reviews before they damage your rating",
      "Identify product issues from review patterns",
      "Benchmark your reviews against competitors",
    ],
    faqs: [
      {
        question: "Which review sites does Kaulby support?",
        answer:
          "Kaulby monitors 7 review platforms: Trustpilot, G2, Google Reviews, Yelp, Apple App Store, Google Play Store, and Amazon Reviews. Trustpilot is on Pro; the rest are on the Team plan.",
      },
      {
        question: "Can I monitor reviews for multiple business locations?",
        answer:
          "Yes. Create separate monitors for each location or use location-specific keywords to track reviews across all your business locations.",
      },
    ],
  },
  {
    slug: "social-listening",
    title: "Social Listening Tool",
    headline: "Social Listening That Goes Beyond Social Media",
    description:
      "Unlike traditional social listening tools, Kaulby monitors communities, forums, and review sites where real conversations happen - not just social media feeds.",
    metaDescription:
      "Social listening across Reddit, forums, review sites, and 14 more platforms. Go beyond Twitter and Facebook. AI-powered analysis. Start free.",
    features: [
      {
        title: "Community-First Monitoring",
        description:
          "Monitor Reddit, Hacker News, Quora, and Indie Hackers - platforms where authentic discussions happen but most social listening tools ignore.",
      },
      {
        title: "Review Site Coverage",
        description:
          "Track Trustpilot, G2, Google Reviews, Yelp, and app store reviews alongside community discussions.",
      },
      {
        title: "AI-Powered Analysis",
        description:
          "Every mention is analyzed for sentiment, intent, and topic category. No more manual sorting through results.",
      },
      {
        title: "Unified Dashboard",
        description:
          "See all mentions across all platforms in a single dashboard with filtering, search, and export capabilities.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "X/Twitter",
      "Product Hunt",
      "Quora",
      "YouTube",
      "Trustpilot",
      "G2",
    ],
    exampleKeywords: [
      "brand name",
      "product name",
      "industry keywords",
      "competitor names",
      "problem descriptions",
    ],
    benefits: [
      "Monitor platforms that traditional social listening tools miss",
      "Capture authentic feedback from community discussions",
      "Consolidate social and review monitoring in one tool",
      "Pay less than enterprise social listening solutions",
    ],
    faqs: [
      {
        question: "How is Kaulby different from Hootsuite or Sprout Social?",
        answer:
          "Traditional social listening tools focus on Twitter/X, Facebook, and Instagram. Kaulby focuses on communities (Reddit, HN), developer platforms (GitHub, Dev.to), and review sites (G2, Trustpilot) where more substantive discussions happen.",
      },
      {
        question: "Does Kaulby monitor Facebook or Instagram?",
        answer:
          "No. Kaulby focuses on open communities and review platforms where conversations are public and indexable. For Facebook and Instagram monitoring, pair Kaulby with a traditional social media tool.",
      },
    ],
  },
  {
    slug: "saas-monitoring",
    title: "SaaS Brand Monitoring",
    headline: "Built for SaaS Companies That Need Community Intelligence",
    description:
      "Monitor what users, prospects, and competitors say about your SaaS product across developer communities, review sites, and social platforms.",
    metaDescription:
      "SaaS brand monitoring across Reddit, G2, Product Hunt, Hacker News, and more. Track user feedback, competitor mentions, and feature requests. Start free.",
    features: [
      {
        title: "SaaS-Specific Platforms",
        description:
          "Monitor the platforms where SaaS decisions are made: G2, Product Hunt, Hacker News, Reddit, and developer communities.",
      },
      {
        title: "Churn Signal Detection",
        description:
          "AI detects when users discuss switching from your product - early warning for churn prevention.",
      },
      {
        title: "Feature Request Tracking",
        description:
          "Aggregate feature requests from across all platforms to prioritize your roadmap with real user data.",
      },
      {
        title: "Competitor Launch Alerts",
        description:
          "Know immediately when competitors launch new features or products that could affect your market position.",
      },
    ],
    relevantPlatforms: [
      "Reddit",
      "Hacker News",
      "G2",
      "Product Hunt",
      "Indie Hackers",
      "X/Twitter",
      "GitHub",
    ],
    exampleKeywords: [
      "product name",
      "competitor names",
      "\"alternative to [your product]\"",
      "\"switching from [your product]\"",
      "product category",
    ],
    benefits: [
      "Catch churn signals before users cancel",
      "Prioritize features based on real user demand",
      "Track competitor launches and positioning changes",
      "Find warm leads in product recommendation threads",
    ],
    faqs: [
      {
        question: "Why do SaaS companies need community monitoring?",
        answer:
          "SaaS decisions are heavily influenced by peer recommendations on Reddit, G2, and Hacker News. Monitoring these platforms helps you understand buyer perception, catch churn signals, and find qualified leads.",
      },
      {
        question: "How does Kaulby detect churn signals?",
        answer:
          "Kaulby's AI identifies mentions where users discuss \"switching from\", \"alternative to\", or express frustration with your product. These are flagged as negative sentiment with high priority.",
      },
    ],
  },
  {
    slug: "agency-monitoring",
    title: "Agency Client Monitoring",
    headline: "Monitor Multiple Client Brands From One Account",
    description:
      "Agencies can monitor multiple client brands across 16 platforms. Set up dedicated monitors for each client with custom keywords and alerts.",
    metaDescription:
      "Agency client monitoring across 16 platforms. Track multiple brands, deliver client reports, and manage all monitoring from one dashboard. Start free.",
    features: [
      {
        title: "Multi-Client Dashboard",
        description:
          "Set up separate monitors for each client brand. Track up to 30 monitors on the Team plan.",
      },
      {
        title: "Client-Specific Alerts",
        description:
          "Configure different alert channels for each client - separate Slack channels, email addresses, or webhook endpoints.",
      },
      {
        title: "Report Generation",
        description:
          "Generate comprehensive monitoring reports for client reviews with sentiment data, mention volume, and actionable insights.",
      },
      {
        title: "Team Collaboration",
        description:
          "Add team members with role-based permissions. Assign specific monitors to specific team members.",
      },
    ],
    relevantPlatforms: [
      "All 16 platforms",
      "Platform selection varies by client needs",
    ],
    exampleKeywords: [
      "client brand names",
      "client product names",
      "client competitor names",
      "client industry keywords",
    ],
    benefits: [
      "Manage all client monitoring from a single account",
      "Deliver data-backed client reports with minimal effort",
      "Scale your monitoring offering without scaling headcount",
      "Add monitoring as a value-add service for existing clients",
    ],
    faqs: [
      {
        question: "How many client brands can I monitor?",
        answer:
          "The Team plan supports up to 30 monitors with 20 keywords each. Most agencies can cover multiple clients within this limit. For larger needs, the Team plan at $99/mo is our most comprehensive option.",
      },
      {
        question: "Can my team members access specific client monitors only?",
        answer:
          "Yes. The Team plan includes role-based permissions. You can assign team members to specific monitors, limiting their access to relevant client data.",
      },
    ],
  },
];

/**
 * Lookup map by slug for efficient access
 */
export const USE_CASE_BY_SLUG: Record<string, UseCaseData> = Object.fromEntries(
  USE_CASES.map((uc) => [uc.slug, uc])
);

/**
 * All use case slugs for generateStaticParams() and sitemap
 */
export const ALL_USE_CASE_SLUGS = USE_CASES.map((uc) => uc.slug);

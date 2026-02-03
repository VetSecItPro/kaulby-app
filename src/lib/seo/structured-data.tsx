import Script from "next/script";

const BASE_URL = "https://kaulbyapp.com";

// Organization Schema - for brand recognition
export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Kaulby",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.jpg`,
    description:
      "AI-powered social listening tool for startups. Monitor brand mentions across 16 platforms including Reddit, Hacker News, and Product Hunt.",
    foundingDate: "2024",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "English",
    },
  };

  return (
    <Script
      id="organization-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Software Application Schema - for the product
export function SoftwareApplicationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kaulby",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "99", // SEO: Updated pricing — FIX-300
      priceCurrency: "USD",
      offerCount: "3",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
      bestRating: "5",
      worstRating: "1",
    },
    description:
      "Monitor brand mentions across 16 platforms with AI-powered sentiment analysis. Track Reddit, Hacker News, Product Hunt, reviews, and more.",
    featureList: [
      "Reddit Monitoring",
      "Hacker News Tracking",
      "Product Hunt Mentions",
      "Review Site Monitoring",
      "AI Sentiment Analysis",
      "Pain Point Detection",
      "Real-time Alerts",
      "Team Collaboration",
    ],
  };

  return (
    <Script
      id="software-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// WebPage Schema with breadcrumbs
interface WebPageSchemaProps {
  title: string;
  description: string;
  url: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export function WebPageSchema({ title, description, url, breadcrumbs }: WebPageSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: description,
    url: url,
    isPartOf: {
      "@type": "WebSite",
      name: "Kaulby",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Kaulby",
      url: BASE_URL,
    },
  };

  if (breadcrumbs && breadcrumbs.length > 0) {
    schema.breadcrumb = {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    };
  }

  return (
    <Script
      id="webpage-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// FAQ Schema - critical for AEO
interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQItem[];
}

export function FAQSchema({ faqs }: FAQSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// HowTo Schema - for tutorial/guide pages
interface HowToStep {
  name: string;
  text: string;
}

interface HowToSchemaProps {
  name: string;
  description: string;
  steps: HowToStep[];
  totalTime?: string; // ISO 8601 duration format, e.g., "PT5M" for 5 minutes
}

export function HowToSchema({ name, description, steps, totalTime }: HowToSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: name,
    description: description,
    totalTime: totalTime || "PT5M",
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };

  return (
    <Script
      id="howto-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Product Comparison Schema - for alternatives pages
interface ComparisonSchemaProps {
  productName: string;
  competitorName: string;
  url: string;
}

export function ComparisonSchema({ productName, competitorName, url }: ComparisonSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${productName} vs ${competitorName} - Feature Comparison`,
    description: `Compare ${productName} and ${competitorName} for social listening and brand monitoring. See features, pricing, and user reviews.`,
    url: url,
    about: [
      {
        "@type": "SoftwareApplication",
        name: productName,
        applicationCategory: "BusinessApplication",
      },
      {
        "@type": "SoftwareApplication",
        name: competitorName,
        applicationCategory: "BusinessApplication",
      },
    ],
    mainEntity: {
      "@type": "ItemList",
      name: "Feature Comparison",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: productName,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: competitorName,
        },
      ],
    },
  };

  return (
    <Script
      id="comparison-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Tool/Feature Page Schema
interface ToolPageSchemaProps {
  name: string;
  description: string;
  url: string;
  features: string[];
}

export function ToolPageSchema({ name, description, url, features }: ToolPageSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: name,
    description: description,
    url: url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available",
    },
    featureList: features,
    provider: {
      "@type": "Organization",
      name: "Kaulby",
      url: BASE_URL,
    },
  };

  return (
    <Script
      id="tool-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Blog Posting Schema - for individual article pages
interface BlogPostingSchemaProps {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  keywords?: string[];
}

export function BlogPostingSchema({
  title,
  description,
  url,
  datePublished,
  dateModified,
  keywords,
}: BlogPostingSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: description,
    url: url,
    datePublished: datePublished,
    dateModified: dateModified || datePublished,
    author: {
      "@type": "Organization",
      name: "Kaulby",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Kaulby",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo.jpg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };

  if (keywords && keywords.length > 0) {
    schema.keywords = keywords.join(", ");
  }

  return (
    <Script
      id="blogposting-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Subreddit Page Schema - for programmatic SEO pages
interface SubredditSchemaProps {
  subreddit: string;
  description: string;
  memberCount?: number;
}

export function SubredditSchema({ subreddit, description, memberCount }: SubredditSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Monitor r/${subreddit} | Kaulby`,
    description: description,
    url: `https://kaulbyapp.com/subreddits/${subreddit}`,
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Kaulby",
      applicationCategory: "BusinessApplication",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier available",
      },
    },
    about: {
      "@type": "Thing",
      name: `r/${subreddit}`,
      description: description,
    },
  };

  // Add member count if available
  if (memberCount && memberCount > 0) {
    (schema.about as Record<string, unknown>).additionalProperty = {
      "@type": "PropertyValue",
      name: "members",
      value: memberCount,
    };
  }

  return (
    <Script
      id={`subreddit-schema-${subreddit}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

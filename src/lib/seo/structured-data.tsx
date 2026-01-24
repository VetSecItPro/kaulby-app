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
      highPrice: "79",
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

// Pricing/Offer Schema
interface PricingTier {
  name: string;
  price: number;
  description: string;
}

interface PricingSchemaProps {
  tiers: PricingTier[];
}

export function PricingSchema({ tiers }: PricingSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Kaulby Social Listening Platform",
    description:
      "AI-powered social listening tool for startups. Monitor brand mentions across 16 platforms.",
    brand: {
      "@type": "Brand",
      name: "Kaulby",
    },
    offers: tiers.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: tier.price,
      priceCurrency: "USD",
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      availability: "https://schema.org/InStock",
      description: tier.description,
    })),
  };

  return (
    <Script
      id="pricing-schema"
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

// Review/Rating Schema for social proof
interface ReviewSchemaProps {
  itemName: string;
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
}

export function ReviewSchema({ itemName, ratingValue, reviewCount, bestRating = 5 }: ReviewSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: itemName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: ratingValue,
      reviewCount: reviewCount,
      bestRating: bestRating,
      worstRating: 1,
    },
  };

  return (
    <Script
      id="review-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Speakable Schema for AEO - marks content that's good for voice assistants
interface SpeakableSchemaProps {
  url: string;
  cssSelectors: string[];
}

export function SpeakableSchema({ url, cssSelectors }: SpeakableSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: url,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: cssSelectors,
    },
  };

  return (
    <Script
      id="speakable-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

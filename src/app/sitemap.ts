import { MetadataRoute } from "next";
import { ALL_TRACKED_SUBREDDITS } from "@/lib/data/tracked-subreddits";
import { blogArticles } from "@/lib/data/blog-articles";
import { ALL_PLATFORM_SLUGS } from "@/lib/data/platforms";
import { ALL_USE_CASE_SLUGS } from "@/lib/data/use-cases";
import { ALL_COMPETITOR_SLUGS } from "@/lib/data/competitors";

// All tool slugs
const toolSlugs = [
  "reddit-monitoring",
  "social-listening-for-startups",
  "brand-monitoring",
  "competitor-monitoring",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://kaulbyapp.com";
  const currentDate = new Date();

  // Core pages - highest priority
  const corePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/sign-up`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/sign-in`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Marketing/landing pages
  const marketingPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/gummysearch`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/alternatives`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/roadmap`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.5,
    },
  ];

  // Tool pages - SEO landing pages
  const toolPages: MetadataRoute.Sitemap = toolSlugs.map((slug) => ({
    url: `${baseUrl}/tools/${slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Subreddit SEO pages - programmatic SEO for Reddit monitoring
  const subredditPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/subreddits`,
      lastModified: currentDate,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    },
    ...ALL_TRACKED_SUBREDDITS.map((slug) => ({
      url: `${baseUrl}/subreddits/${slug}`,
      lastModified: currentDate,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  // Blog article pages
  const articlePages: MetadataRoute.Sitemap = blogArticles.map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: new Date(article.publishedDate),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Platform monitoring pages
  const platformPages: MetadataRoute.Sitemap = ALL_PLATFORM_SLUGS.map((slug) => ({
    url: `${baseUrl}/monitor/${slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Use case pages
  const useCasePages: MetadataRoute.Sitemap = ALL_USE_CASE_SLUGS.map((slug) => ({
    url: `${baseUrl}/use-case/${slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Competitor comparison pages
  const comparisonPages: MetadataRoute.Sitemap = ALL_COMPETITOR_SLUGS.map((slug) => ({
    url: `${baseUrl}/compare/${slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Legal pages - lower priority
  const legalPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  return [
    ...corePages,
    ...marketingPages,
    ...toolPages,
    ...subredditPages,
    ...platformPages,
    ...useCasePages,
    ...comparisonPages,
    ...articlePages,
    ...legalPages,
  ];
}

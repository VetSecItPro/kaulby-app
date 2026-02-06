import { MetadataRoute } from "next";
import { ALL_TRACKED_SUBREDDITS } from "@/lib/data/tracked-subreddits";
import { blogArticles } from "@/lib/data/blog-articles";

// All tool slugs
const toolSlugs = [
  "reddit-monitoring",
  "social-listening-for-startups",
  "brand-monitoring",
  "competitor-monitoring",
];

// All competitor/alternative slugs
const alternativeSlugs = [
  "mention",
  "brand24",
  "brandwatch",
  "hootsuite",
  "sproutsocial",
  "awario",
  "syften",
  "gummysearch",
  "redreach",
  "subredditsignals",
  "f5bot",
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
  ];

  // Tool pages - SEO landing pages
  const toolPages: MetadataRoute.Sitemap = toolSlugs.map((slug) => ({
    url: `${baseUrl}/tools/${slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Alternative/comparison pages - SEO landing pages
  const alternativePages: MetadataRoute.Sitemap = alternativeSlugs.map((slug) => ({
    url: `${baseUrl}/alternatives/${slug}`,
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
    ...alternativePages,
    ...subredditPages,
    ...articlePages,
    ...legalPages,
  ];
}

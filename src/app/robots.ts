import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://kaulbyapp.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/manage/",
          "/invite/",
          "/_next/",
        ],
      },
      // Googlebot gets full access to allowed pages
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/manage/",
          "/invite/",
        ],
      },
      // AI crawlers for AEO (Answer Engine Optimization)
      {
        userAgent: "GPTBot",
        allow: [
          "/",
          "/tools/",
          "/alternatives/",
          "/pricing",
          "/articles/",
          "/gummysearch",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/manage/",
        ],
      },
      {
        userAgent: "ChatGPT-User",
        allow: [
          "/",
          "/tools/",
          "/alternatives/",
          "/pricing",
          "/articles/",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/manage/",
        ],
      },
      {
        userAgent: "Claude-Web",
        allow: [
          "/",
          "/tools/",
          "/alternatives/",
          "/pricing",
          "/articles/",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/manage/",
        ],
      },
      {
        userAgent: "PerplexityBot",
        allow: [
          "/",
          "/tools/",
          "/alternatives/",
          "/pricing",
          "/articles/",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/manage/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

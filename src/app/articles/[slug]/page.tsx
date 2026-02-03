// TODO: Add OpenGraph images for social sharing — FIX-304
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { BlogPostingSchema, WebPageSchema } from "@/lib/seo/structured-data";
import {
  blogArticles,
  getArticleBySlug,
  getRelatedArticles,
} from "@/lib/data/blog-articles";
import { ArticlePageClient } from "./ArticlePageClient";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: "Article Not Found | Kaulby" };
  }

  const url = `https://kaulbyapp.com/articles/${article.slug}`;

  return {
    title: `${article.title} | Kaulby`,
    description: article.description,
    keywords: article.seoKeywords,
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: "article",
      publishedTime: article.publishedDate,
      authors: ["Kaulby"],
      tags: article.seoKeywords,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedArticles(article.slug, article.category);
  const url = `https://kaulbyapp.com/articles/${article.slug}`;

  return (
    <div className="flex flex-col min-h-screen">
      <WebPageSchema
        title={article.title}
        description={article.description}
        url={url}
        breadcrumbs={[
          { name: "Home", url: "https://kaulbyapp.com" },
          { name: "Articles", url: "https://kaulbyapp.com/articles" },
          { name: article.title, url },
        ]}
      />
      <BlogPostingSchema
        title={article.title}
        description={article.description}
        url={url}
        datePublished={article.publishedDate}
        keywords={article.seoKeywords}
      />

      <MarketingHeader />
      <ArticlePageClient
        article={article}
        relatedArticles={relatedArticles}
      />
      <MarketingFooter />
    </div>
  );
}

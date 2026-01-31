"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BlogArticle } from "@/lib/data/blog-articles";
import { categoryConfig } from "@/lib/utils/article-helpers";

interface ArticlePageClientProps {
  article: BlogArticle;
  relatedArticles: BlogArticle[];
}

export function ArticlePageClient({
  article,
  relatedArticles,
}: ArticlePageClientProps) {
  const config = categoryConfig[article.category];
  const Icon = config.icon;

  const handleShare = async () => {
    const url = `https://kaulbyapp.com/articles/${article.slug}`;
    if (navigator.share) {
      await navigator.share({
        title: article.title,
        text: article.description,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <main className="flex-1">
      {/* Article Header */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          {/* Back link */}
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            All Articles
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${config.badgeClass}`}
            >
              <Icon className="h-3 w-3" />
              {article.category}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {article.readTime}
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date(article.publishedDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            {article.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-muted-foreground mb-6">
            {article.description}
          </p>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </section>

      {/* Article Content */}
      <section className="px-4 pb-12">
        <div className="container mx-auto max-w-3xl">
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
          />
        </div>
      </section>

      {/* Inline CTA */}
      <section className="px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
            <h3 className="text-xl font-bold mb-2">
              Start Monitoring Your Brand Today
            </h3>
            <p className="text-muted-foreground mb-6">
              Track mentions across 16 platforms with AI-powered analysis.
              Free plan available.
            </p>
            <Link href="/sign-up">
              <Button className="gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <section className="py-16 px-4 border-t">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedArticles.map((related) => {
                const relatedConfig = categoryConfig[related.category];
                const RelatedIcon = relatedConfig.icon;
                return (
                  <Link
                    key={related.slug}
                    href={`/articles/${related.slug}`}
                  >
                    <Card className="h-full hover:border-primary/40 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${relatedConfig.badgeClass}`}
                          >
                            <RelatedIcon className="h-3 w-3" />
                            {related.category}
                          </span>
                        </div>
                        <CardTitle className="text-base leading-snug line-clamp-2">
                          {related.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {related.description}
                        </p>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {related.readTime}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

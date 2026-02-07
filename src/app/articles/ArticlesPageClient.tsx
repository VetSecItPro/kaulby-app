"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowRight, BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BlogArticle } from "@/lib/data/blog-articles";
import {
  categoryConfig,
  allCategories,
  type ArticleCategory,
} from "@/lib/utils/article-helpers";

interface ArticlesPageClientProps {
  articles: BlogArticle[];
  featuredArticles: BlogArticle[];
}

export function ArticlesPageClient({
  articles,
  featuredArticles,
}: ArticlesPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ArticleCategory | null>(null);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch =
        searchQuery === "" ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !selectedCategory || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchQuery, selectedCategory]);

  return (
    <>
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Community Monitoring Insights
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Guides, strategies, and best practices for tracking brand mentions,
            analyzing sentiment, and growing through community engagement.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Articles
            </button>
            {allCategories.map((category) => {
              const config = categoryConfig[category];
              const Icon = config.icon;
              return (
                <button
                  key={category}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === category ? null : category
                    )
                  }
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      {!searchQuery && !selectedCategory && (
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold mb-8">Featured</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredArticles.map((article) => {
                const config = categoryConfig[article.category];
                const Icon = config.icon;
                return (
                  <Link
                    key={article.slug}
                    href={`/articles/${article.slug}`}
                  >
                    <Card className="h-full hover:border-primary/40 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.badgeClass}`}
                          >
                            <Icon className="h-3 w-3" />
                            {article.category}
                          </span>
                        </div>
                        <CardTitle className="text-base leading-snug line-clamp-2">
                          {article.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {article.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {article.readTime}
                          </span>
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            Read <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* All Articles Grid */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              {selectedCategory || "All Articles"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredArticles.length}{" "}
              {filteredArticles.length === 1 ? "article" : "articles"}
            </span>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">
                No articles found matching your search.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                }}
                className="text-primary hover:underline mt-2 text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => {
                const config = categoryConfig[article.category];
                const Icon = config.icon;
                return (
                  <Link
                    key={article.slug}
                    href={`/articles/${article.slug}`}
                  >
                    <Card className="h-full hover:border-primary/40 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.badgeClass}`}
                          >
                            <Icon className="h-3 w-3" />
                            {article.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(
                              article.publishedDate
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <CardTitle className="text-lg leading-snug line-clamp-2">
                          {article.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {article.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {article.readTime}
                          </span>
                          <span className="text-sm text-primary font-medium flex items-center gap-1">
                            Read more <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Monitor Your Brand?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Start tracking mentions across 17 platforms with AI-powered
            sentiment analysis. Free to get started.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}

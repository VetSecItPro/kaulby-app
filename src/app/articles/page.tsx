import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";

// Static generation - revalidate every hour
export const revalidate = 3600;

export default function ArticlesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      {/* Content */}
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="mb-8">
            <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6">
              <BookOpen className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Articles Coming Soon
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We&apos;re working on helpful guides about community monitoring, brand tracking,
              and making the most of online discussions. Check back soon!
            </p>
          </div>

          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

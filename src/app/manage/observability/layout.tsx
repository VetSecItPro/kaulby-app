import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ObservabilityTabs } from "./_nav";

export default function ObservabilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/manage">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to admin
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Observability</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cadence-matrix validation, AI spend, vendor health, and operational failures
          - all without logging in to PostHog / Langfuse / Sentry / Apify.
        </p>
      </div>

      <ObservabilityTabs />

      {children}
    </div>
  );
}

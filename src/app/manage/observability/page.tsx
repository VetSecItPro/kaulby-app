import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAiCostByTier,
  getCadenceHealth,
  getRecentFailures,
  getScanVolumeByTier,
  getVendorHealth,
  safe,
} from "./_queries";
import {
  AiCostByTierTile,
  CadenceHealthTile,
  RecentFailuresTile,
  ScanVolumeTile,
  SystemHealthTile,
} from "./_tiles";

export const dynamic = "force-dynamic";

export default async function ObservabilityOverviewPage() {
  const [cadenceHealth, aiCostByTier, scanVolume, recentFailures, vendorHealth] = await Promise.all([
    safe("cadence", getCadenceHealth),
    safe("ai-cost", getAiCostByTier),
    safe("scan-volume", getScanVolumeByTier),
    safe("failures", getRecentFailures),
    safe("vendor-health", getVendorHealth),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <SystemHealthTile data={vendorHealth} />
        <CadenceHealthTile data={cadenceHealth} />
        <AiCostByTierTile data={aiCostByTier} />
        <ScanVolumeTile data={scanVolume} />
        <RecentFailuresTile data={recentFailures} />
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Drill-in to vendor consoles (when admin needs deep-dive)
        </p>
        <div className="flex flex-wrap gap-2">
          <DrillInLink label="PostHog" href="https://us.posthog.com/project" />
          <DrillInLink label="Sentry" href="https://sentry.io/issues/" />
          <DrillInLink label="Langfuse" href="https://us.cloud.langfuse.com/" />
          <DrillInLink label="Apify Console" href="https://console.apify.com/billing" />
          <DrillInLink label="OpenRouter" href="https://openrouter.ai/activity" />
          <DrillInLink label="xAI Console" href="https://console.x.ai/" />
          <DrillInLink label="Inngest Cloud" href="https://app.inngest.com/" />
          <DrillInLink label="Vercel" href="https://vercel.com/vetsecitpro/kaulby-app/observability" />
          <DrillInLink label="Polar" href="https://polar.sh/dashboard" />
          <DrillInLink label="Resend" href="https://resend.com/emails" />
        </div>
      </div>
    </div>
  );
}

function DrillInLink({ label, href }: { label: string; href: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer" className="gap-1">
        {label}
        <ExternalLink className="h-3 w-3" />
      </a>
    </Button>
  );
}

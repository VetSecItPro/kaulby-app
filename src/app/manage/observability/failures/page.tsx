import { getRecentFailures, safe } from "../_queries";
import { RecentFailuresTile } from "../_tiles";

export const dynamic = "force-dynamic";

export default async function FailuresPage() {
  const data = await safe("failures", getRecentFailures);
  return (
    <div className="space-y-6">
      <RecentFailuresTile data={data} fullWidth />
      <p className="text-xs text-muted-foreground">
        Sub-page surfaces the same 24h-failures view as the overview tile, in full
        width. Phase 5 alerts cron will trigger from this same data when failure
        rate &gt; 10% per platform over 1h.
      </p>
    </div>
  );
}

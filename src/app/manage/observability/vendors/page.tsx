import { getVendorHealth, getVendorMetricTrend30d, safe } from "../_queries";
import { SystemHealthTile } from "../_tiles";
import { VendorMetricTrendChart } from "../_charts";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const [vendorHealth, apifyTrend, openrouterTrend] = await Promise.all([
    safe("vendor-health", getVendorHealth),
    safe("apify-trend", () => getVendorMetricTrend30d("apify", "monthly_usage_pct")),
    safe("openrouter-trend", () => getVendorMetricTrend30d("openrouter", "credit_remaining_usd")),
  ]);
  return (
    <div className="space-y-6">
      <SystemHealthTile data={vendorHealth} fullWidth />
      <div className="grid gap-6 md:grid-cols-2">
        <VendorMetricTrendChart
          data={apifyTrend}
          title="Apify monthly quota (30 days)"
          description="Daily peak utilization of the Apify $/month plan limit. Tracks toward 100% to know when an upgrade is needed."
          unit="%"
        />
        <VendorMetricTrendChart
          data={openrouterTrend}
          title="OpenRouter credit remaining (30 days)"
          description="Daily remaining USD on the OpenRouter API key. Drops mean spend; spikes mean top-ups."
          unit=""
        />
      </div>
    </div>
  );
}

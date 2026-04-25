import { getVendorHealth, safe } from "../_queries";
import { SystemHealthTile } from "../_tiles";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const data = await safe("vendor-health", getVendorHealth);
  return (
    <div className="space-y-6">
      <SystemHealthTile data={data} fullWidth />
      <p className="text-xs text-muted-foreground">
        Phase 6 will add a 30-day Apify quota line + vendor uptime sparklines here,
        reading from vendor_metrics history.
      </p>
    </div>
  );
}

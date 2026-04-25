import { getAiCostByTier, getScanVolumeByTier, safe } from "../_queries";
import { AiCostByTierTile, ScanVolumeTile } from "../_tiles";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const [aiCost, scanVolume] = await Promise.all([
    safe("ai-cost", getAiCostByTier),
    safe("scan-volume", getScanVolumeByTier),
  ]);
  return (
    <div className="space-y-6">
      <AiCostByTierTile data={aiCost} fullWidth />
      <ScanVolumeTile data={scanVolume} fullWidth />
      <p className="text-xs text-muted-foreground">
        Phase 6 will add 30-day AI-spend stacked-area + scan-volume trend charts here,
        reading from the daily_metrics rollup.
      </p>
    </div>
  );
}

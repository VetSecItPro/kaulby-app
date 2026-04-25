import {
  getAiCostByTier,
  getAiCostTrend30d,
  getScanVolumeByTier,
  safe,
} from "../_queries";
import { AiCostByTierTile, ScanVolumeTile } from "../_tiles";
import { AiCostTrendChart } from "../_charts";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const [aiCost, scanVolume, aiTrend] = await Promise.all([
    safe("ai-cost", getAiCostByTier),
    safe("scan-volume", getScanVolumeByTier),
    safe("ai-trend-30d", getAiCostTrend30d),
  ]);
  return (
    <div className="space-y-6">
      <AiCostTrendChart data={aiTrend} />
      <AiCostByTierTile data={aiCost} fullWidth />
      <ScanVolumeTile data={scanVolume} fullWidth />
    </div>
  );
}

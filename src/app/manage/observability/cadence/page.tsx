import { getCadenceHealth, safe } from "../_queries";
import { CadenceHealthTile } from "../_tiles";

export const dynamic = "force-dynamic";

export default async function CadencePage() {
  const data = await safe("cadence", getCadenceHealth);
  return (
    <div className="space-y-6">
      <CadenceHealthTile data={data} fullWidth />
      <p className="text-xs text-muted-foreground">
        Phase 6 will add a 30-day cadence-drift heat-map here.
      </p>
    </div>
  );
}

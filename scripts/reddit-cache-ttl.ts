/**
 * A: Cache TTL probe.
 * Runs same query at t=0, 3min, 10min, 30min, 60min. Observes when cost goes non-zero.
 */

export {};
const APIFY_API_BASE = "https://api.apify.com/v2";
const TOKEN = process.env.APIFY_API_KEY;
if (!TOKEN) {
  console.error("APIFY_API_KEY missing");
  process.exit(1);
}

const INPUT = {
  urls: ["https://www.reddit.com/r/programming/"],
  maxPostsPerSource: 10,
  sort: "new",
};

async function runOnce(label: string) {
  const actor = "automation-lab~reddit-scraper";
  const t0 = Date.now();
  const startR = await fetch(`${APIFY_API_BASE}/acts/${actor}/runs?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(INPUT),
  });
  if (!startR.ok) {
    console.log(`[${label}] start fail ${startR.status}`);
    return;
  }
  const start = await startR.json();
  const runId = start.data.id;
  const datasetId = start.data.defaultDatasetId;
  while (Date.now() - t0 < 90_000) {
    const p = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}?token=${TOKEN}`);
    const pd = await p.json();
    if (pd.data.status === "SUCCEEDED") {
      const ds = await fetch(`${APIFY_API_BASE}/datasets/${datasetId}/items?token=${TOKEN}&clean=true`);
      const items = await ds.json();
      const ts = new Date().toISOString();
      console.log(`[${ts}] [${label}] items=${items.length} usd=$${pd.data.usageTotalUsd} runtime=${pd.data.stats?.runTimeSecs}s firstId=${items[0]?.id}`);
      return;
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(pd.data.status)) {
      console.log(`[${label}] ${pd.data.status}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main() {
  const sleepMin = (m: number) => new Promise((r) => setTimeout(r, m * 60_000));
  const points = [
    { label: "t=0", delayMin: 0 },
    { label: "t=3min", delayMin: 3 },
    { label: "t=10min", delayMin: 7 },
    { label: "t=30min", delayMin: 20 },
    { label: "t=60min", delayMin: 30 },
  ];
  let cumulative = 0;
  for (const p of points) {
    if (p.delayMin > 0) {
      cumulative += p.delayMin;
      console.log(`[cache-ttl] sleeping ${p.delayMin}min (cumulative ${cumulative}min)...`);
      await sleepMin(p.delayMin);
    }
    await runOnce(p.label);
  }
  console.log("[cache-ttl] Done. Cost transitions from $0 → non-zero indicate cache expired.");
}

main().catch((e) => console.error("FATAL:", e));

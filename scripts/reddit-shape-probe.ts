/**
 * One-shot probe: fetch a full item from automation-lab AND run with comments.
 * Gives us ground truth on response shape before rewriting apify.ts.
 */

export {};
const APIFY_API_BASE = "https://api.apify.com/v2";
const TOKEN = process.env.APIFY_API_KEY;
if (!TOKEN) {
  console.error("APIFY_API_KEY missing");
  process.exit(1);
}

async function runAndPrintFirstItem(input: Record<string, unknown>, label: string) {
  const actor = "automation-lab~reddit-scraper";
  console.log(`\n=== ${label} ===`);
  console.log(`input: ${JSON.stringify(input)}`);
  const startR = await fetch(`${APIFY_API_BASE}/acts/${actor}/runs?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!startR.ok) {
    console.error(`start ${startR.status}: ${await startR.text()}`);
    return;
  }
  const start = await startR.json();
  const runId = start.data.id;
  const datasetId = start.data.defaultDatasetId;

  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    const p = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}?token=${TOKEN}`);
    const pd = await p.json();
    const st = pd.data.status;
    if (st === "SUCCEEDED") {
      const dsR = await fetch(`${APIFY_API_BASE}/datasets/${datasetId}/items?token=${TOKEN}&clean=true&limit=3`);
      const items = await dsR.json();
      console.log(`status=${st} count=${items.length} usd=${pd.data.usageTotalUsd} runtime=${pd.data.stats?.runTimeSecs}s`);
      if (items.length > 0) {
        console.log("\n--- First item (full shape) ---");
        console.log(JSON.stringify(items[0], null, 2));
        if (items.length > 1) {
          console.log("\n--- Second item dataType/id only ---");
          console.log(`dataType=${items[1].dataType} id=${items[1].id}`);
        }
        const types = new Set(items.map((i: Record<string, unknown>) => i.dataType ?? "(none)"));
        console.log(`\ndataType values seen: ${Array.from(types).join(", ")}`);
      }
      return;
    }
    if (st === "FAILED" || st === "ABORTED" || st === "TIMED-OUT") {
      console.error(`${st}: ${JSON.stringify(pd.data).slice(0, 500)}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.error("timeout");
}

async function main() {
  // C: Posts WITHOUT comments
  await runAndPrintFirstItem(
    { urls: ["https://www.reddit.com/r/SaaS/"], maxPostsPerSource: 5, sort: "new" },
    "POSTS ONLY (5 items from r/SaaS)"
  );

  // C: Posts WITH comments (try the two common flag names)
  await runAndPrintFirstItem(
    {
      urls: ["https://www.reddit.com/r/SaaS/"],
      maxPostsPerSource: 3,
      sort: "new",
      maxComments: 20,
      includeComments: true,
      skipComments: false,
    },
    "POSTS + COMMENTS attempt (3 posts, 20 comments each)"
  );
}

main().catch((e) => console.error("FATAL:", e));

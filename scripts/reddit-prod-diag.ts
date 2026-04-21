/**
 * Empirical prod diagnostic — raw Neon SQL, bypasses Drizzle.
 * Usage: npx tsx scripts/reddit-prod-diag.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const sql = neon(url);
  const now = new Date();

  console.log(`## Reddit Prod Diagnostic — ${now.toISOString()}\n`);

  // 1) errorLogs grouped
  console.log("### 1. errorLogs referencing Reddit/Apify/Serper (last 7d)\n");
  const errsByType = (await sql`
    SELECT source, COUNT(*)::int AS c
    FROM error_logs
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND (message ILIKE '%reddit%'
           OR message ILIKE '%apify%'
           OR message ILIKE '%serper%'
           OR message ILIKE '%actor-is-not-rented%')
    GROUP BY source
    ORDER BY c DESC
  `) as Array<{ source: string; c: number }>;
  if (errsByType.length === 0) console.log("- None");
  for (const r of errsByType) console.log(`- **${r.source}**: ${r.c}`);

  // 2) Latest 10 error messages verbatim
  console.log("\n### 2. Latest 10 matching error messages\n");
  const recentErrs = (await sql`
    SELECT created_at, source, message
    FROM error_logs
    WHERE message ILIKE '%reddit%'
       OR message ILIKE '%apify%'
       OR message ILIKE '%serper%'
       OR message ILIKE '%actor-is-not-rented%'
       OR message ILIKE '%403%'
    ORDER BY created_at DESC
    LIMIT 10
  `) as Array<{ created_at: Date; source: string; message: string }>;
  if (recentErrs.length === 0) console.log("- None");
  for (const e of recentErrs) {
    const d = new Date(e.created_at).toISOString();
    console.log(`- [${d}] **${e.source}**: ${(e.message ?? "").slice(0, 200)}`);
  }

  // 3) Active Reddit monitors
  console.log("\n### 3. Active Reddit-platform monitor health\n");
  const monitorHealth = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(CASE WHEN last_checked_at > NOW() - INTERVAL '24 hours' THEN 1 END)::int AS scanned_24h,
      COUNT(CASE WHEN last_checked_at IS NULL THEN 1 END)::int AS never_scanned,
      COUNT(CASE WHEN last_checked_at < NOW() - INTERVAL '24 hours' THEN 1 END)::int AS stale,
      EXTRACT(EPOCH FROM (NOW() - MAX(last_checked_at))) / 60 AS minutes_since_last
    FROM monitors
    WHERE is_active = true AND platforms::text ILIKE '%reddit%'
  `) as Array<{ total: number; scanned_24h: number; never_scanned: number; stale: number; minutes_since_last: number | null }>;
  const m = monitorHealth[0];
  console.log(`- Total active Reddit monitors: ${m.total}`);
  console.log(`- Scanned in last 24h: ${m.scanned_24h}`);
  console.log(`- Stale (>24h): ${m.stale}`);
  console.log(`- Never scanned: ${m.never_scanned}`);
  console.log(`- Minutes since most recent scan: ${m.minutes_since_last !== null ? Math.floor(m.minutes_since_last) : "N/A"}`);

  // 4) Results inflow
  console.log("\n### 4. Reddit results inflow\n");
  const inflow = (await sql`
    SELECT
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END)::int AS last_24h,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)::int AS last_7d,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END)::int AS last_30d
    FROM results WHERE platform = 'reddit'
  `) as Array<{ last_24h: number; last_7d: number; last_30d: number }>;
  const i = inflow[0];
  console.log(`- Last 24h: ${i.last_24h}`);
  console.log(`- Last 7d: ${i.last_7d} (avg/day: ${(i.last_7d / 7).toFixed(1)})`);
  console.log(`- Last 30d: ${i.last_30d} (avg/day: ${(i.last_30d / 30).toFixed(1)})`);
  if (i.last_7d > 0 && i.last_24h / (i.last_7d / 7) < 0.5) {
    console.log(`- ⚠️ **DEPRESSED** — last 24h is only ${((i.last_24h / (i.last_7d / 7)) * 100).toFixed(0)}% of 7d avg`);
  }

  // 5) Source breakdown
  console.log("\n### 5. Reddit result source breakdown (last 7d — which tier is doing the work)\n");
  const sourceRows = (await sql`
    SELECT metadata->>'source' AS source, COUNT(*)::int AS c
    FROM results
    WHERE platform = 'reddit' AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY metadata->>'source'
    ORDER BY c DESC
  `) as Array<{ source: string | null; c: number }>;
  if (sourceRows.length === 0) console.log("- No Reddit results in last 7d");
  for (const s of sourceRows) console.log(`- **${s.source ?? "(null)"}**: ${s.c}`);

  console.log("\n---\nDiagnostic complete.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

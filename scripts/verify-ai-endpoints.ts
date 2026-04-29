/**
 * Verify the new AI endpoints against real seeded data — directly via the
 * AI library, bypassing HTTP/auth (the dev-auth bypass refuses to fire against
 * a Neon DB by design).
 *
 * For each new endpoint, this:
 *   1. Pulls representative seeded data from the DB
 *   2. Builds the same prompts the endpoint builds
 *   3. Calls jsonCompletion directly
 *   4. Validates the response shape + prints the actual output
 *
 * COSTS REAL MONEY (via OpenRouter). One full run is ~$0.0004 (Flash). Gated
 * behind KAULBY_RUN_AI_VERIFY=1 so it never fires by accident.
 *
 * Run:
 *   KAULBY_RUN_AI_VERIFY=1 pnpm tsx scripts/verify-ai-endpoints.ts
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

if (process.env.KAULBY_RUN_AI_VERIFY !== "1") {
  console.error(
    "Refusing to run: KAULBY_RUN_AI_VERIFY=1 must be set explicitly.\n" +
      "This script makes real AI calls (~$0.0004 per run). See script header.",
  );
  process.exit(1);
}

import { neon } from "@neondatabase/serverless";
import { jsonCompletion, MODELS } from "@/lib/ai/openrouter";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(DATABASE_URL);

function header(label: string) {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
}

function summary(name: string, ok: boolean, latency: number, extra: string = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}  (${latency}ms)  ${extra}`);
}

// ---------------------------------------------------------------------------
// 1. suggest-reply
// ---------------------------------------------------------------------------
async function verifySuggestReply() {
  header("1. suggest-reply");
  const r = (await sql`SELECT id, title, content, platform FROM results WHERE platform = 'reddit' LIMIT 1`)[0] as { id: string; title: string; content: string; platform: string };
  if (!r) return console.log("(no reddit result seeded; skip)");
  console.log(`Source: "${r.title.slice(0, 80)}..."`);

  const start = Date.now();
  const result = await jsonCompletion<{ suggestions: Array<{ text: string; tone: string; confidence: number }> }>({
    messages: [
      {
        role: "system",
        content: `Generate 3 reply suggestions for a social media post. Each reply should be helpful, authentic, and NOT promotional.

Platform: reddit
Guidelines: Be authentic, avoid promotion, share personal experience, use paragraphs.

Rules: 2-3 sentences max per reply, add genuine value, match platform tone, be human, not corporate.`,
      },
      {
        role: "user",
        content: `POST: "${r.title}"\nCONTENT: ${r.content?.slice(0, 500) ?? ""}\n\nReturn JSON: {"suggestions": [{"text": "...", "tone": "helpful|professional|casual", "confidence": 0.0-1.0}]}`,
      },
    ],
    model: MODELS.primary,
  });
  const ok = Array.isArray(result.data.suggestions) && result.data.suggestions.length === 3;
  summary("suggest-reply structure", ok, Date.now() - start, `cost $${result.meta.cost.toFixed(5)}`);
  if (ok) {
    result.data.suggestions.forEach((s, i) => {
      console.log(`   [${s.tone} ${(s.confidence * 100).toFixed(0)}%] ${s.text.slice(0, 100)}${s.text.length > 100 ? "..." : ""}`);
    });
  }
}

// ---------------------------------------------------------------------------
// 2. monitor-summary
// ---------------------------------------------------------------------------
async function verifyMonitorSummary() {
  header("2. monitor-summary (last 7d on Trellis monitor)");
  const m = (await sql`SELECT id, name, company_name FROM monitors WHERE name LIKE 'Trellis%' LIMIT 1`)[0] as { id: string; name: string; company_name: string };
  if (!m) return console.log("(no Trellis monitor seeded; skip)");

  const recent = (await sql`
    SELECT title, platform, sentiment, lead_score
    FROM results
    WHERE monitor_id = ${m.id} AND sentiment IS NOT NULL
    ORDER BY posted_at DESC LIMIT 8
  `) as Array<{ title: string; platform: string; sentiment: string; lead_score: number | null }>;

  if (recent.length < 5) return console.log(`(only ${recent.length} mentions; skip)`);
  console.log(`Monitor: ${m.name} (${recent.length} sample mentions)`);

  const sample = recent.map((r) => `- [${r.sentiment}, score ${r.lead_score ?? "—"}] ${r.title.slice(0, 160)} (${r.platform})`).join("\n");
  let pos = 0, neg = 0, neu = 0;
  for (const r of recent) { if (r.sentiment === "positive") pos++; else if (r.sentiment === "negative") neg++; else neu++; }

  const start = Date.now();
  const result = await jsonCompletion<{ takeaways: string[] }>({
    messages: [
      {
        role: "system",
        content: `You are a brand-monitoring analyst. Given aggregate stats and a sample of representative mentions for a single brand monitor, produce exactly 3 sharp takeaways. Each takeaway is one sentence, concrete, references actual content not generalities.\n\nReturn JSON: {"takeaways": ["...", "...", "..."]}`,
      },
      {
        role: "user",
        content: `MONITOR: ${m.name} (tracking: ${m.company_name})\nWINDOW: last 7 days, ${recent.length} mentions\nSENTIMENT_BREAKDOWN: ${pos} positive, ${neg} negative, ${neu} neutral\nHIGH_SIGNAL_SAMPLE:\n${sample}`,
      },
    ],
    model: MODELS.primary,
  });
  const ok = Array.isArray(result.data.takeaways) && result.data.takeaways.length === 3;
  summary("monitor-summary structure", ok, Date.now() - start, `cost $${result.meta.cost.toFixed(5)}`);
  if (ok) result.data.takeaways.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
}

// ---------------------------------------------------------------------------
// 3. explain-trend
// ---------------------------------------------------------------------------
async function verifyExplainTrend() {
  header("3. explain-trend (30d)");

  const monitorIds = (await sql`SELECT id FROM monitors LIMIT 10`).map((m: any) => m.id);
  if (monitorIds.length === 0) return console.log("(no monitors; skip)");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const daily = (await sql`
    SELECT to_char(posted_at, 'YYYY-MM-DD') as day, sentiment, count(*)::int as count
    FROM results
    WHERE monitor_id = ANY(${monitorIds}) AND posted_at >= ${since} AND sentiment IS NOT NULL
    GROUP BY day, sentiment
  `) as Array<{ day: string; sentiment: string; count: number }>;

  if (daily.length < 3) return console.log(`(only ${daily.length} day-rows; skip)`);

  const samples = (await sql`
    SELECT id, title, sentiment, platform
    FROM results
    WHERE monitor_id = ANY(${monitorIds}) AND posted_at >= ${since} AND sentiment IS NOT NULL
    LIMIT 8
  `) as Array<{ id: string; title: string; sentiment: string; platform: string }>;

  const sampleSummary = samples.map((s) => `- [${s.sentiment}] ${s.title.slice(0, 180)} (${s.platform})`).join("\n");

  const start = Date.now();
  const result = await jsonCompletion<{ explanation: string; changePoint: string | null; drivers: any[] }>({
    messages: [
      {
        role: "system",
        content: `You are a brand-monitoring analyst. Given daily sentiment counts and a sample of representative posts, write a concise 2-4 sentence explanation of what changed and why.\n\nReturn JSON: {"explanation": "...", "changePoint": "YYYY-MM-DD or null", "drivers": [{"label": "...", "examples": ["resultId1"]}]}`,
      },
      {
        role: "user",
        content: `WINDOW: last 30 days\nDAILY_SENTIMENT_COUNTS: ${JSON.stringify(daily)}\nRECENT_SAMPLE_POSTS:\n${sampleSummary}`,
      },
    ],
    model: MODELS.primary,
  });
  const ok = typeof result.data.explanation === "string" && result.data.explanation.length > 20;
  summary("explain-trend structure", ok, Date.now() - start, `cost $${result.meta.cost.toFixed(5)}`);
  if (ok) {
    console.log(`   Explanation: ${result.data.explanation}`);
    if (result.data.changePoint) console.log(`   Change point: ${result.data.changePoint}`);
    if (Array.isArray(result.data.drivers)) {
      console.log(`   Drivers: ${result.data.drivers.map((d: any) => d.label).join(", ")}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. cluster-bookmarks
// ---------------------------------------------------------------------------
async function verifyClusterBookmarks() {
  header("4. cluster-bookmarks");

  const userBookmarks = (await sql`SELECT result_id FROM bookmarks LIMIT 100`) as Array<{ result_id: string }>;
  if (userBookmarks.length < 4) return console.log(`(only ${userBookmarks.length} bookmarks; skip)`);

  const ids = userBookmarks.map((b) => b.result_id);
  const items = (await sql`
    SELECT id, title, platform, sentiment, conversation_category, lead_score
    FROM results WHERE id = ANY(${ids})
  `) as Array<{ id: string; title: string; platform: string; sentiment: string | null; conversation_category: string | null; lead_score: number | null }>;

  const indexed = items.map((r) => `${r.id} | [${r.sentiment ?? "?"}, ${r.conversation_category ?? "?"}, score ${r.lead_score ?? "—"}, ${r.platform}] ${r.title.slice(0, 160)}`).join("\n");

  const start = Date.now();
  const result = await jsonCompletion<{ clusters: Array<{ label: string; description: string; resultIds: string[] }> }>({
    messages: [
      {
        role: "system",
        content: `You are a sales-ops analyst. Group the user's saved posts into 3-5 themed clusters. Each cluster needs a short label (2-4 words), one-sentence description, and resultIds.\n\nReturn JSON: {"clusters": [{"label":"...", "description":"...", "resultIds":["..."]}]}`,
      },
      { role: "user", content: `BOOKMARKS:\n${indexed}` },
    ],
    model: MODELS.primary,
  });
  const ok = Array.isArray(result.data.clusters) && result.data.clusters.length > 0;
  summary("cluster-bookmarks structure", ok, Date.now() - start, `cost $${result.meta.cost.toFixed(5)}`);
  if (ok) {
    result.data.clusters.forEach((c) => {
      console.log(`   "${c.label}" (${c.resultIds.length} items): ${c.description}`);
    });
  }
}

// ---------------------------------------------------------------------------
async function main() {
  console.log("Verifying new AI endpoints against seeded data...");
  let totalCost = 0;
  const start = Date.now();

  try { await verifySuggestReply(); } catch (e) { console.error("suggest-reply ERR:", (e as Error).message); }
  try { await verifyMonitorSummary(); } catch (e) { console.error("monitor-summary ERR:", (e as Error).message); }
  try { await verifyExplainTrend(); } catch (e) { console.error("explain-trend ERR:", (e as Error).message); }
  try { await verifyClusterBookmarks(); } catch (e) { console.error("cluster-bookmarks ERR:", (e as Error).message); }

  console.log(`\n\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((e) => { console.error(e); process.exit(1); });

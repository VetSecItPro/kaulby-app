/**
 * Eval Shootout — compare Team-tier model candidates head-to-head.
 *
 * Runs Kaulby's golden eval set against each candidate model, captures
 * per-metric accuracy + cost + latency, and emits a comparison report.
 *
 * Why this exists: COA 4 originally routed Team tier to Claude Sonnet 4.5
 * ($3 in / $15 out per 1M tokens). Back-of-envelope at 500 results/day
 * per Team user = ~$6.50/day AI cost vs $3.30/day Team revenue share.
 * Reverted pending data. This script produces that data.
 *
 * Usage:
 *   pnpm tsx scripts/eval-shootout.ts                  # single round, all 4 models
 *   pnpm tsx scripts/eval-shootout.ts --rounds 10      # variance test
 *   pnpm tsx scripts/eval-shootout.ts --models flash,pro,haiku  # skip Sonnet to save $
 *   pnpm tsx scripts/eval-shootout.ts --rounds 10 --out .monitor-reports/shootout-overnight.json
 *
 * Cost estimates (30-item set, 3 analyzers per item = 90 calls/round/model):
 *   Flash:           ~$0.03/round  → ~$0.30  over 10 rounds
 *   Gemini 2.5 Pro:  ~$0.60/round  → ~$6.00  over 10 rounds
 *   Haiku 4.5:       ~$0.50/round  → ~$5.00  over 10 rounds
 *   Sonnet 4.5:      ~$1.20/round  → ~$12.00 over 10 rounds
 *
 * Safety: gated behind KAULBY_RUN_AI_EVAL=1 + OPENROUTER_API_KEY presence.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { analyzeSentiment } from "@/lib/ai/analyzers/sentiment";
import { analyzePainPoints } from "@/lib/ai/analyzers/pain-points";
import { categorizeConversation } from "@/lib/ai/analyzers/conversation-category";

// ---------------------------------------------------------------------------
// Candidate models (OpenRouter model IDs)
// ---------------------------------------------------------------------------

const CANDIDATE_MODELS: Record<string, { id: string; label: string; estCostPerCall: number }> = {
  flash: {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    estCostPerCall: 0.0003,
  },
  pro: {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    estCostPerCall: 0.006,
  },
  haiku: {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    estCostPerCall: 0.005,
  },
  sonnet: {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    estCostPerCall: 0.013,
  },
};

const DEFAULT_MODELS = ["flash", "pro", "haiku", "sonnet"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalLabels {
  sentiment: "positive" | "negative" | "neutral";
  painPointCategory: string | null;
  conversationCategory?: string;
}

interface EvalItem {
  id: string;
  source: string;
  title?: string | null;
  content: string;
  labels: EvalLabels;
}

interface EvalSet {
  items: EvalItem[];
}

interface MetricScore {
  total: number;
  correct: number;
  accuracy: number;
}

interface ModelRoundResult {
  modelKey: string;
  modelId: string;
  modelLabel: string;
  round: number;
  items: number;
  sentiment: MetricScore;
  painPointCategory: MetricScore;
  conversationCategory: MetricScore;
  totalCostUsd: number;
  totalLatencyMs: number;
  errors: number;
}

interface ShootoutReport {
  runAt: string;
  evalSetVersion: number;
  evalSetSize: number;
  rounds: number;
  models: string[];
  results: ModelRoundResult[];
  summary: Array<{
    modelKey: string;
    modelLabel: string;
    modelId: string;
    avgSentimentAcc: number;
    avgPainPointAcc: number;
    avgConvoAcc: number;
    avgCostUsdPerRun: number;
    avgLatencyMsPerRun: number;
    totalCostUsd: number;
    accuracyStdDev?: { sentiment: number; painPoint: number; convo: number };
  }>;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  rounds: number;
  models: string[];
  outPath: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { rounds: 1, models: DEFAULT_MODELS, outPath: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--rounds") {
      const n = parseInt(argv[++i] ?? "", 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error(`[shootout] invalid --rounds value: ${argv[i]}`);
        process.exit(2);
      }
      args.rounds = n;
    } else if (arg === "--models") {
      const list = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const m of list) {
        if (!CANDIDATE_MODELS[m]) {
          console.error(`[shootout] unknown model key: ${m}. Valid: ${Object.keys(CANDIDATE_MODELS).join(", ")}`);
          process.exit(2);
        }
      }
      args.models = list;
    } else if (arg === "--out") {
      args.outPath = argv[++i] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm tsx scripts/eval-shootout.ts [--rounds N] [--models flash,pro,haiku,sonnet] [--out path]");
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SET_PATH = join(REPO_ROOT, "src/__tests__/ai/golden-eval-set.json");
const DEFAULT_OUT_DIR = join(REPO_ROOT, ".monitor-reports");

// ---------------------------------------------------------------------------
// One round per model
// ---------------------------------------------------------------------------

async function runOneRound(
  set: EvalSet,
  modelKey: string,
  round: number
): Promise<ModelRoundResult> {
  const candidate = CANDIDATE_MODELS[modelKey];
  const sentiment: MetricScore = { total: 0, correct: 0, accuracy: 0 };
  const painPoint: MetricScore = { total: 0, correct: 0, accuracy: 0 };
  const convo: MetricScore = { total: 0, correct: 0, accuracy: 0 };
  let totalCost = 0;
  let totalLatency = 0;
  let errors = 0;

  for (const [i, item] of set.items.entries()) {
    process.stdout.write(`\r[shootout] ${candidate.label} round ${round} — ${i + 1}/${set.items.length} ${item.id}     `);

    const text = item.title ? `${item.title}\n\n${item.content}` : item.content;

    // Sentiment
    try {
      const { result, meta } = await analyzeSentiment(text);
      totalCost += meta.cost;
      totalLatency += meta.latencyMs;
      sentiment.total += 1;
      if (result.sentiment === item.labels.sentiment) sentiment.correct += 1;
    } catch {
      sentiment.total += 1;
      errors += 1;
    }

    // Pain points
    try {
      const { result, meta } = await analyzePainPoints(text);
      totalCost += meta.cost;
      totalLatency += meta.latencyMs;
      painPoint.total += 1;
      if (result.category === item.labels.painPointCategory) painPoint.correct += 1;
    } catch {
      painPoint.total += 1;
      errors += 1;
    }

    // Conversation category (only items with labels)
    if (item.labels.conversationCategory) {
      try {
        const { result, meta } = await categorizeConversation(text);
        totalCost += meta.cost;
        totalLatency += meta.latencyMs;
        convo.total += 1;
        if (result.category === item.labels.conversationCategory) convo.correct += 1;
      } catch {
        convo.total += 1;
        errors += 1;
      }
    }
  }
  process.stdout.write("\n");

  sentiment.accuracy = sentiment.total > 0 ? sentiment.correct / sentiment.total : 0;
  painPoint.accuracy = painPoint.total > 0 ? painPoint.correct / painPoint.total : 0;
  convo.accuracy = convo.total > 0 ? convo.correct / convo.total : 0;

  return {
    modelKey,
    modelId: candidate.id,
    modelLabel: candidate.label,
    round,
    items: set.items.length,
    sentiment,
    painPointCategory: painPoint,
    conversationCategory: convo,
    totalCostUsd: Math.round(totalCost * 10000) / 10000,
    totalLatencyMs: totalLatency,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Summary computation (means + std dev over rounds per model)
// ---------------------------------------------------------------------------

function computeSummary(report: ShootoutReport): ShootoutReport["summary"] {
  const byModel = new Map<string, ModelRoundResult[]>();
  for (const r of report.results) {
    const arr = byModel.get(r.modelKey) ?? [];
    arr.push(r);
    byModel.set(r.modelKey, arr);
  }

  return Array.from(byModel.entries()).map(([modelKey, rounds]) => {
    const avgCost = rounds.reduce((a, b) => a + b.totalCostUsd, 0) / rounds.length;
    const totalCost = rounds.reduce((a, b) => a + b.totalCostUsd, 0);
    const avgLat = rounds.reduce((a, b) => a + b.totalLatencyMs, 0) / rounds.length;
    const sAccs = rounds.map((r) => r.sentiment.accuracy);
    const pAccs = rounds.map((r) => r.painPointCategory.accuracy);
    const cAccs = rounds.map((r) => r.conversationCategory.accuracy);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const stddev = (xs: number[]) => {
      if (xs.length < 2) return 0;
      const m = mean(xs);
      return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    };

    return {
      modelKey,
      modelLabel: rounds[0].modelLabel,
      modelId: rounds[0].modelId,
      avgSentimentAcc: mean(sAccs),
      avgPainPointAcc: mean(pAccs),
      avgConvoAcc: mean(cAccs),
      avgCostUsdPerRun: Math.round(avgCost * 10000) / 10000,
      avgLatencyMsPerRun: Math.round(avgLat),
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      accuracyStdDev: rounds.length > 1
        ? { sentiment: stddev(sAccs), painPoint: stddev(pAccs), convo: stddev(cAccs) }
        : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderMarkdown(report: ShootoutReport): string {
  const lines: string[] = [];
  lines.push("# Eval Shootout Report");
  lines.push("");
  lines.push(`**Run at:** ${report.runAt}`);
  lines.push(`**Golden set size:** ${report.evalSetSize} items`);
  lines.push(`**Rounds per model:** ${report.rounds}`);
  lines.push(`**Models:** ${report.models.join(", ")}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Model | Sentiment | Pain Point | Convo | Avg $/run | Total $ | Latency/run |");
  lines.push("|---|---|---|---|---|---|---|");
  const sorted = [...report.summary].sort((a, b) => {
    // Rank by composite accuracy (simple mean of the 3 metrics)
    const score = (s: typeof a) => (s.avgSentimentAcc + s.avgPainPointAcc + s.avgConvoAcc) / 3;
    return score(b) - score(a);
  });
  for (const s of sorted) {
    lines.push(
      `| ${s.modelLabel} | ${(s.avgSentimentAcc * 100).toFixed(1)}% | ${(s.avgPainPointAcc * 100).toFixed(1)}% | ${(s.avgConvoAcc * 100).toFixed(1)}% | $${s.avgCostUsdPerRun.toFixed(4)} | $${s.totalCostUsd.toFixed(2)} | ${(s.avgLatencyMsPerRun / 1000).toFixed(1)}s |`
    );
  }
  lines.push("");
  lines.push("## Cost-adjusted ranking (accuracy per $1)");
  lines.push("");
  lines.push("Simple composite: (sentiment + painPoint + convo) / 3, divided by avgCostUsdPerRun.");
  lines.push("");
  const costAdj = [...sorted].map((s) => ({
    ...s,
    composite: (s.avgSentimentAcc + s.avgPainPointAcc + s.avgConvoAcc) / 3,
    accPerDollar: ((s.avgSentimentAcc + s.avgPainPointAcc + s.avgConvoAcc) / 3) / Math.max(s.avgCostUsdPerRun, 0.0001),
  })).sort((a, b) => b.accPerDollar - a.accPerDollar);
  for (const s of costAdj) {
    lines.push(`- **${s.modelLabel}** — composite accuracy ${(s.composite * 100).toFixed(1)}%, $${s.avgCostUsdPerRun.toFixed(4)}/run → ${s.accPerDollar.toFixed(0)} accuracy-points per \$1`);
  }

  if (report.rounds > 1) {
    lines.push("");
    lines.push("## Variance (std deviation across rounds)");
    lines.push("");
    lines.push("| Model | σ sentiment | σ pain point | σ convo |");
    lines.push("|---|---|---|---|");
    for (const s of sorted) {
      const sd = s.accuracyStdDev;
      if (!sd) continue;
      lines.push(`| ${s.modelLabel} | ${(sd.sentiment * 100).toFixed(2)}% | ${(sd.painPoint * 100).toFixed(2)}% | ${(sd.convo * 100).toFixed(2)}% |`);
    }
  }

  lines.push("");
  lines.push("## Raw per-round results");
  lines.push("");
  for (const r of report.results) {
    lines.push(`### ${r.modelLabel} — round ${r.round}`);
    lines.push(`- Sentiment: ${r.sentiment.correct}/${r.sentiment.total} (${(r.sentiment.accuracy * 100).toFixed(1)}%)`);
    lines.push(`- Pain point: ${r.painPointCategory.correct}/${r.painPointCategory.total} (${(r.painPointCategory.accuracy * 100).toFixed(1)}%)`);
    lines.push(`- Convo: ${r.conversationCategory.correct}/${r.conversationCategory.total} (${(r.conversationCategory.accuracy * 100).toFixed(1)}%)`);
    lines.push(`- Cost: \$${r.totalCostUsd.toFixed(4)} — Latency: ${(r.totalLatencyMs / 1000).toFixed(1)}s — Errors: ${r.errors}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (process.env.KAULBY_RUN_AI_EVAL !== "1") {
    console.error("[shootout] KAULBY_RUN_AI_EVAL=1 required — refusing to make paid API calls without explicit opt-in.");
    console.error("[shootout] Run: KAULBY_RUN_AI_EVAL=1 pnpm tsx scripts/eval-shootout.ts");
    process.exit(2);
  }
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("[shootout] OPENROUTER_API_KEY not set.");
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));
  const set: EvalSet = JSON.parse(readFileSync(SET_PATH, "utf-8"));

  console.log(`[shootout] Golden set: ${set.items.length} items`);
  console.log(`[shootout] Models: ${args.models.join(", ")}`);
  console.log(`[shootout] Rounds per model: ${args.rounds}`);
  const estTotal = args.models.reduce((sum, k) => {
    const c = CANDIDATE_MODELS[k];
    const callsPerRound = set.items.length * 3; // 3 analyzers
    return sum + c.estCostPerCall * callsPerRound * args.rounds;
  }, 0);
  console.log(`[shootout] Estimated total cost: ~\$${estTotal.toFixed(2)}`);
  console.log("");

  const report: ShootoutReport = {
    runAt: new Date().toISOString(),
    evalSetVersion: 1,
    evalSetSize: set.items.length,
    rounds: args.rounds,
    models: args.models,
    results: [],
    summary: [],
  };

  for (const modelKey of args.models) {
    // OpenRouter model pinning via env var consumed by jsonCompletion.
    // We set this before each analyzer call so analyzers route to the candidate model.
    // (analyzers read MODELS.primary by default; we override at the env level via
    //  OPENROUTER_MODEL_OVERRIDE handled at jsonCompletion time — see openrouter.ts.)
    process.env.OPENROUTER_MODEL_OVERRIDE = CANDIDATE_MODELS[modelKey].id;
    for (let round = 1; round <= args.rounds; round++) {
      const r = await runOneRound(set, modelKey, round);
      report.results.push(r);
      // Flush partial results to disk after each round — if we crash at hour 2
      // of a 3-hour overnight run, the partial data is still useful.
      report.summary = computeSummary(report);
      writePartial(report, args.outPath);
    }
  }
  delete process.env.OPENROUTER_MODEL_OVERRIDE;

  const md = renderMarkdown(report);
  const outDir = args.outPath ? dirname(args.outPath) : DEFAULT_OUT_DIR;
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const jsonPath = args.outPath ?? join(DEFAULT_OUT_DIR, `shootout-${Date.now()}.json`);
  const mdPath = jsonPath.replace(/\.json$/, ".md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(mdPath, md + "\n");

  console.log("");
  console.log(`[shootout] Report JSON: ${jsonPath}`);
  console.log(`[shootout] Report MD:   ${mdPath}`);
  console.log("");
  console.log(md);
}

function writePartial(report: ShootoutReport, outPath: string | null): void {
  const jsonPath = outPath ?? join(DEFAULT_OUT_DIR, "shootout-partial.json");
  if (!existsSync(dirname(jsonPath))) mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
}

main().catch((err) => {
  console.error("[shootout] fatal:", err);
  process.exit(1);
});

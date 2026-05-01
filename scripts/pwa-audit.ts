#!/usr/bin/env tsx
// pwa-audit.ts — run Lighthouse against prod with --only-categories=pwa,
// parse the JSON, write a report under .perf-reports/, and assert the
// score is >= the threshold. Designed to run in CI weekly + on demand.
//
// Usage:
//   pnpm pwa:audit                     # audit https://kaulbyapp.com
//   pnpm pwa:audit https://preview.url # audit a different URL
//
// Exit code 0 if score meets threshold, 1 otherwise.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TARGET_URL = process.argv[2] || "https://kaulbyapp.com";
const SCORE_THRESHOLD = 0.9;
const REPORT_DIR = ".perf-reports";

function ts(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function main(): number {
  ensureDir(REPORT_DIR);
  const outJson = join(REPORT_DIR, `pwa-${ts()}.json`);

  console.log(`[pwa-audit] target: ${TARGET_URL}`);
  console.log(`[pwa-audit] running lighthouse...`);

  // npx lighthouse handles install-on-demand; CI installs once and caches.
  const res = spawnSync(
    "npx",
    [
      "--yes",
      "lighthouse@latest",
      TARGET_URL,
      "--only-categories=pwa",
      "--output=json",
      `--output-path=${outJson}`,
      "--quiet",
      "--chrome-flags=--headless --no-sandbox",
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  if (res.status !== 0) {
    console.error(`[pwa-audit] lighthouse exited ${res.status}`);
    return 1;
  }

  const json = JSON.parse(readFileSync(outJson, "utf8")) as {
    categories?: { pwa?: { score: number | null; auditRefs?: unknown[] } };
    audits?: Record<string, { id: string; title: string; score: number | null; description?: string }>;
  };
  const score = json.categories?.pwa?.score ?? 0;
  const pct = Math.round((score ?? 0) * 100);

  console.log(`\n[pwa-audit] PWA score: ${pct}/100 (threshold: ${SCORE_THRESHOLD * 100})`);
  console.log(`[pwa-audit] full report: ${outJson}`);

  // Surface failed audits for quick triage.
  const audits = json.audits ?? {};
  const failed = Object.values(audits).filter((a) => a && a.score !== null && a.score < 1);
  if (failed.length > 0) {
    console.log(`\n[pwa-audit] failed audits (${failed.length}):`);
    for (const a of failed.slice(0, 10)) {
      console.log(`  - ${a.title} (${a.id}): ${a.score === null ? "N/A" : Math.round(a.score * 100) + "%"}`);
    }
  }

  if (score < SCORE_THRESHOLD) {
    console.error(`\n[pwa-audit] FAIL: score ${pct} < ${SCORE_THRESHOLD * 100}`);
    return 1;
  }
  console.log(`\n[pwa-audit] PASS`);
  return 0;
}

process.exit(main());

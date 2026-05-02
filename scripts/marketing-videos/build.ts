#!/usr/bin/env tsx
// Build orchestrator: capture → compose → encode → emit deliverables.
//
// Usage:
//   pnpm marketing-videos              # build all targets registered in flows/index.ts
//   pnpm marketing-videos hero         # build a single target by stem
//   MARKETING_VIDEOS_BASE_URL=https://kaulbyapp.com pnpm marketing-videos hero
//
// Pipeline per target:
//   1. runner.runFlow → captures .webm via Playwright recordVideo
//   2. compose.compose → Remotion renders intro+capture+outro+overlays → .mp4
//   3. encode.encode → ffmpeg produces final {.mp4, .webm, -poster.webp}
//   4. Outputs land in public/videos/{stem}.{mp4,webm}, -poster.webp
//
// Captures + intermediate Remotion mp4 land in .marketing-videos/ (gitignored).
import { join } from "node:path";
import { runFlow } from "./runner";
import { compose } from "./compose";
import { encode } from "./encode";
import type { VideoTarget } from "./types";
import { TARGETS } from "./flows";

const PROJECT_ROOT = join(__dirname, "..", "..");
const WORK_DIR = join(PROJECT_ROOT, ".marketing-videos");
const PUBLIC_VIDEOS = join(PROJECT_ROOT, "public", "videos");

function fmtKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function buildOne(target: VideoTarget): Promise<void> {
  const baseUrl = process.env.MARKETING_VIDEOS_BASE_URL || "http://localhost:3000";
  const startTime = Date.now();
  console.log(`[${target.stem}] capturing flow ${target.flow.id} against ${baseUrl}`);

  const capturePath = await runFlow(target.flow, {
    baseUrl,
    outputDir: join(WORK_DIR, "captures"),
    headed: !!process.env.HEADED,
  });
  console.log(`[${target.stem}] captured: ${capturePath}`);

  const composedPath = join(WORK_DIR, "composed", `${target.stem}.mp4`);
  console.log(`[${target.stem}] composing brand intro/outro/captions...`);
  await compose({ capturePath, recipe: target.recipe, outputPath: composedPath });

  const outStem = join(PUBLIC_VIDEOS, target.stem);
  console.log(`[${target.stem}] encoding deliverables to ${outStem}.{mp4,webm}, -poster.webp`);
  const result = await encode({ input: composedPath, outputStem: outStem });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[${target.stem}] DONE in ${elapsed}s — mp4=${fmtKb(result.mp4.bytes)}, webm=${fmtKb(result.webm.bytes)}, poster=${fmtKb(result.poster.bytes)}`,
  );
  if (result.mp4.bytes > 2 * 1024 * 1024 || result.webm.bytes > 1.5 * 1024 * 1024) {
    console.warn(`[${target.stem}] WARNING: file size exceeds Hatch-class budget (mp4 ≤2MB, webm ≤1.5MB)`);
  }
}

async function main(): Promise<void> {
  const onlyStem = process.argv[2];
  const targets = onlyStem ? TARGETS.filter((t) => t.stem === onlyStem) : TARGETS;
  if (targets.length === 0) {
    console.error(`No matching targets. Available: ${TARGETS.map((t) => t.stem).join(", ") || "(none)"}`);
    process.exit(1);
  }

  for (const t of targets) {
    try {
      await buildOne(t);
    } catch (err) {
      console.error(`[${t.stem}] FAILED:`, err);
      process.exitCode = 1;
    }
  }
}

void main();

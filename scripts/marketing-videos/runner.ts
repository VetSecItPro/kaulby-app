// Playwright runner: launches Chromium, opens a page with screencast on,
// drives the flow, returns the path to the captured .webm.
//
// We use Playwright's built-in `recordVideo` (Chromium MJPEG → WebM) instead of
// `page.video()` per-frame screenshotting because it produces a real video file
// directly, sized to the viewport, with timestamps that the Remotion composer
// can index into.
import { chromium } from "playwright";
import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Flow } from "./types";

const PROJECT_ROOT = join(__dirname, "..", "..");

export interface RunnerOptions {
  baseUrl: string;
  /** where the captured .webm is moved after recording finishes */
  outputDir: string;
  /** disable headless when debugging (set HEADED=1) */
  headed?: boolean;
}

export async function runFlow(flow: Flow, opts: RunnerOptions): Promise<string> {
  await mkdir(opts.outputDir, { recursive: true });
  const tmpDir = join(opts.outputDir, ".tmp", flow.id);
  await mkdir(tmpDir, { recursive: true });

  const browser = await chromium.launch({
    headless: !opts.headed,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage", // CI runners have tiny /dev/shm
    ],
  });

  const context = await browser.newContext({
    viewport: flow.viewport,
    deviceScaleFactor: 2, // retina capture; Remotion downsamples
    colorScheme: "dark",
    recordVideo: {
      dir: tmpDir,
      size: flow.viewport, // capture at logical viewport; DPR is automatic
    },
  });

  const page = await context.newPage();

  try {
    await flow.drive({ page, baseUrl: opts.baseUrl });
  } finally {
    // Closing the context flushes the video to disk.
    await context.close();
    await browser.close();
  }

  // Playwright writes to a uuid filename in tmpDir. Find it and rename.
  const files = await readdir(tmpDir);
  const webm = files.find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error(`runner: no .webm produced for flow ${flow.id}`);

  const finalPath = join(opts.outputDir, `${flow.id}-capture.webm`);
  await rename(join(tmpDir, webm), finalPath);
  return finalPath;
}

// CLI entry: node scripts/marketing-videos/runner.ts <flowId>
// Used for solo flow capture during development. Production builds go via build.ts.
if (require.main === module) {
  const flowId = process.argv[2];
  if (!flowId) {
    console.error("usage: tsx scripts/marketing-videos/runner.ts <flowId>");
    process.exit(1);
  }
  void (async () => {
    const flowMod = await import(`./flows/${flowId}`);
    const flow: Flow = flowMod.default ?? flowMod[flowId];
    if (!flow) throw new Error(`No flow exported from ./flows/${flowId}`);

    const baseUrl = process.env.MARKETING_VIDEOS_BASE_URL || "http://localhost:3000";
    const outDir = join(PROJECT_ROOT, ".marketing-videos", "captures");
    const out = await runFlow(flow, { baseUrl, outputDir: outDir, headed: !!process.env.HEADED });
    console.log(`captured: ${out}`);
  })();
}

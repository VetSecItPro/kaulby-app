// Composer: bundle the Remotion entry + render with per-video inputProps.
// Output is a high-bitrate MP4 that we then hand to encode.ts for the final
// compress/dual-encode pass.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Recipe } from "./types";
import { KAULBY_BRAND } from "./brand/kaulby";

export interface ComposeOptions {
  capturePath: string;
  recipe: Recipe;
  outputPath: string; // .mp4
}

export async function compose(opts: ComposeOptions): Promise<void> {
  await mkdir(dirname(opts.outputPath), { recursive: true });

  const entry = join(__dirname, "remotion-root.tsx");
  const bundleLocation = await bundle({ entryPoint: entry });

  const inputProps = {
    recipe: opts.recipe,
    capturePath: opts.capturePath,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "marketing",
    inputProps,
  });

  // Override duration based on recipe so the timeline matches captions/zooms.
  const durationInFrames = Math.round(opts.recipe.durationSec * KAULBY_BRAND.fps);

  await renderMedia({
    composition: { ...composition, durationInFrames },
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: opts.outputPath,
    inputProps,
    // Higher quality at this stage; encode.ts compresses to delivery size.
    crf: 18,
  });
}

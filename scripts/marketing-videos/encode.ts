// ffmpeg encoder: takes a Remotion-rendered .mp4 (typically large, lossless or
// near-lossless) and produces three deliverables for /public/videos/:
//   {stem}.mp4    — H.264 baseline, faststart, ≤2 MB target
//   {stem}.webm   — VP9 (smaller than VP8 by ~25%), ≤1.5 MB target
//   {stem}-poster.webp — first-frame still
//
// CRF defaults are tuned for "small marketing loop" — visual fidelity matters
// less than weight. Tweak per-target if a video looks artifact-y.
import { spawnSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import ffmpegStatic from "ffmpeg-static";

const FFMPEG = ffmpegStatic ?? "ffmpeg";

interface EncodeResult {
  mp4: { path: string; bytes: number };
  webm: { path: string; bytes: number };
  poster: { path: string; bytes: number };
}

async function fileBytes(p: string): Promise<number> {
  return (await stat(p)).size;
}

function run(args: string[]): void {
  const res = spawnSync(FFMPEG, args, { stdio: ["ignore", "ignore", "inherit"] });
  if (res.status !== 0) {
    throw new Error(`ffmpeg exited ${res.status} for: ${args.join(" ")}`);
  }
}

export interface EncodeOptions {
  input: string;
  outputStem: string; // e.g., /abs/path/public/videos/hero (no extension)
  /** Target H.264 CRF. Lower = better quality, larger file. 28 = small marketing loop. */
  mp4Crf?: number;
  /** Target VP9 CRF. */
  webmCrf?: number;
  /** Pixel width for resize (height auto). 1280 matches Hatch's hero. */
  width?: number;
}

export async function encode(opts: EncodeOptions): Promise<EncodeResult> {
  const mp4Path = `${opts.outputStem}.mp4`;
  const webmPath = `${opts.outputStem}.webm`;
  const posterPath = `${opts.outputStem}-poster.webp`;
  await mkdir(dirname(opts.outputStem), { recursive: true });

  const width = opts.width ?? 1280;
  const mp4Crf = opts.mp4Crf ?? 28;
  const webmCrf = opts.webmCrf ?? 32;

  // H.264 (universal: Safari, iOS, all desktop).
  // -movflags +faststart puts moov atom at the front so <video> starts playing
  // before the entire file downloads — crucial for autoplay loops on slow links.
  run([
    "-y",
    "-i", opts.input,
    "-vf", `scale=${width}:-2:flags=lanczos`, // -2 keeps height even (libx264 requirement)
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", String(mp4Crf),
    "-pix_fmt", "yuv420p",        // broadest decoder support
    "-profile:v", "baseline",     // older mobile devices
    "-an",                         // strip audio (autoplay loops are muted anyway)
    "-movflags", "+faststart",
    mp4Path,
  ]);

  // VP9 (smaller, served first to Chrome/Firefox via WebM-first <source>).
  run([
    "-y",
    "-i", opts.input,
    "-vf", `scale=${width}:-2:flags=lanczos`,
    "-c:v", "libvpx-vp9",
    "-b:v", "0",                   // CRF mode (b:v=0 + crf is VP9 idiom)
    "-crf", String(webmCrf),
    "-row-mt", "1",                // multi-threaded encoding
    "-an",
    webmPath,
  ]);

  // First-frame poster as WebP. Used for `<video poster>` so the page doesn't
  // flash blank while the video loads.
  run([
    "-y",
    "-i", opts.input,
    "-vframes", "1",
    "-vf", `scale=${width}:-2:flags=lanczos`,
    "-c:v", "libwebp",
    "-quality", "70",
    posterPath,
  ]);

  return {
    mp4: { path: mp4Path, bytes: await fileBytes(mp4Path) },
    webm: { path: webmPath, bytes: await fileBytes(webmPath) },
    poster: { path: posterPath, bytes: await fileBytes(posterPath) },
  };
}

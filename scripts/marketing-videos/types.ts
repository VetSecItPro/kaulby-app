// Shared types for the marketing-video pipeline.
// Flows are Playwright drivers; recipes describe the Remotion composition that
// wraps captures with brand intro/outro/captions; targets bundle a flow + recipe
// into one deliverable video.

import type { Page } from "playwright";

export interface FlowContext {
  page: Page;
  baseUrl: string; // e.g., http://localhost:3000 or preview URL
}

export interface Flow {
  /** stable id used for output filenames + Remotion comp ids */
  id: string;
  /** human description in case someone asks "what is this video?" */
  description: string;
  /** target capture viewport (Hatch ships 1280x720; we match) */
  viewport: { width: number; height: number };
  /** drive the page through the demo. Capture is automatic via context.video. */
  drive: (ctx: FlowContext) => Promise<void>;
}

export interface Caption {
  /** seconds from capture start */
  fromSec: number;
  /** seconds from capture start */
  toSec: number;
  /** caption text (lowercase per brand voice) */
  text: string;
}

export interface ZoomCue {
  fromSec: number;
  toSec: number;
  /** target rect in normalized coords [0..1] within the capture */
  rect: { x: number; y: number; w: number; h: number };
  /** zoom factor. 1.0 = no zoom; 1.4 = 40% zoom-in */
  scale: number;
}

export interface Recipe {
  /** matches a Flow.id */
  flowId: string;
  /** total duration of the FINAL video (intro + capture + outro). seconds. */
  durationSec: number;
  /** seconds before the capture starts (brand intro). 0 = no intro. */
  introSec: number;
  /** seconds after the capture ends (brand outro). 0 = no outro. */
  outroSec: number;
  /** captions overlaid on the capture portion */
  captions: Caption[];
  /** zoom-in cues for emphasis */
  zooms: ZoomCue[];
}

export interface VideoTarget {
  /** output filename stem. Final assets: public/videos/{stem}.{mp4,webm,poster.webp} */
  stem: string;
  flow: Flow;
  recipe: Recipe;
}

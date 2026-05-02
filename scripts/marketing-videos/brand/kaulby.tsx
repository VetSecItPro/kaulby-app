// Kaulby brand config for the Remotion composer.
// When the pipeline gets extracted to @vibecode/video-pipeline, each app
// supplies its own brand file matching this shape.
import type { Recipe } from "../types";

export const KAULBY_BRAND = {
  /** Hex; matches manifest.json + theme_color */
  background: "#0a0a0a",
  /** Caption text color */
  captionColor: "#ffffff",
  /** Caption font (must match marketing site to avoid 3rd-font drift) */
  captionFontFamily: "Geist Sans, Inter, system-ui, sans-serif",
  /** Caption size in px at 1280×720; scales with viewport */
  captionFontSizePx: 36,
  /** Brand accent (zoom highlight ring, intro/outro accent) */
  accent: "#10b981", // teal-500 — matches "track 16 platforms" branding
  /** Logo path (served from /public). */
  logoSrc: "/logo.jpg",
  /** Tagline used in outro */
  tagline: "Find pain points, competitor gaps, and buying signals.",
  /** Frame rate for output */
  fps: 30,
} as const;

export type Brand = typeof KAULBY_BRAND;

// Default recipe knobs we don't expect every flow to override.
export const DEFAULTS = {
  /** 0 = no intro on hero (Hatch pattern); 0.8s = brief logo flash */
  defaultIntroSec: 0,
  /** 1.5s outro logo + tagline */
  defaultOutroSec: 1.5,
} as const;

// Convenience: build a default recipe shell. Each video's flow file overrides
// captions + zooms + duration. introSec/outroSec come from DEFAULTS unless the
// flow needs cinematic openers.
export function recipeFor(flowId: string, overrides: Partial<Recipe>): Recipe {
  return {
    flowId,
    durationSec: overrides.durationSec ?? 10,
    introSec: overrides.introSec ?? DEFAULTS.defaultIntroSec,
    outroSec: overrides.outroSec ?? DEFAULTS.defaultOutroSec,
    captions: overrides.captions ?? [],
    zooms: overrides.zooms ?? [],
  };
}

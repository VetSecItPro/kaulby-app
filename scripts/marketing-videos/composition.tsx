// Remotion composition: brand intro → captured screencast → brand outro,
// with caption + zoom overlays driven by the recipe.
//
// Used both by the pipeline renderer (via @remotion/renderer programmatically)
// and by the Remotion preview studio if someone runs `remotion studio` to
// iterate on visual polish.
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import type { Recipe } from "./types";
import { KAULBY_BRAND } from "./brand/kaulby";

interface CompositionProps {
  recipe: Recipe;
  /** Path to the captured .webm (absolute or relative to where Remotion bundles it) */
  capturePath: string;
  /** Optional override for brand (extracted package will need this) */
  brand?: typeof KAULBY_BRAND;
}

// Fade an opacity value across an interval — used by intro, outro, and captions.
function fadeAt(frame: number, fromFrame: number, toFrame: number, holdFrames: number): number {
  const fadeIn = Math.min(8, Math.floor((toFrame - fromFrame) * 0.2));
  const fadeOut = Math.min(8, Math.floor((toFrame - fromFrame) * 0.2));
  if (frame < fromFrame || frame > toFrame) return 0;
  if (frame < fromFrame + fadeIn) {
    return interpolate(frame, [fromFrame, fromFrame + fadeIn], [0, 1]);
  }
  if (frame > toFrame - fadeOut) {
    return interpolate(frame, [toFrame - fadeOut, toFrame], [1, 0]);
  }
  return 1;
}

export function MarketingVideo({ recipe, capturePath, brand = KAULBY_BRAND }: CompositionProps) {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  const introFrames = Math.round(recipe.introSec * fps);
  const outroFrames = Math.round(recipe.outroSec * fps);
  const totalFrames = Math.round(recipe.durationSec * fps);
  const captureFrames = totalFrames - introFrames - outroFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: brand.background }}>
      {/* Intro: logo flash on dark background */}
      {introFrames > 0 && (
        <Sequence from={0} durationInFrames={introFrames}>
          <AbsoluteFill style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: fadeAt(frame, 0, introFrames, introFrames),
          }}>
            <Img src={brand.logoSrc} style={{ width: width * 0.18, borderRadius: 16 }} />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* Captured screencast */}
      <Sequence from={introFrames} durationInFrames={captureFrames}>
        <AbsoluteFill>
          <OffthreadVideo src={capturePath} muted />
          {/* Zoom cues — render a subtle ring over the active rect during the cue */}
          {recipe.zooms.map((z, i) => {
            const fromF = introFrames + Math.round(z.fromSec * fps);
            const toF = introFrames + Math.round(z.toSec * fps);
            if (frame < fromF || frame > toF) return null;
            const opacity = fadeAt(frame, fromF, toF, toF - fromF);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${z.rect.x * 100}%`,
                  top: `${z.rect.y * 100}%`,
                  width: `${z.rect.w * 100}%`,
                  height: `${z.rect.h * 100}%`,
                  border: `3px solid ${brand.accent}`,
                  borderRadius: 12,
                  boxShadow: `0 0 32px ${brand.accent}88`,
                  opacity,
                }}
              />
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Captions — overlaid on capture portion */}
      {recipe.captions.map((c, i) => {
        const fromF = introFrames + Math.round(c.fromSec * fps);
        const toF = introFrames + Math.round(c.toSec * fps);
        if (frame < fromF || frame > toF) return null;
        const opacity = fadeAt(frame, fromF, toF, toF - fromF);
        return (
          <AbsoluteFill
            key={i}
            style={{
              alignItems: "center",
              justifyContent: "flex-end",
              paddingBottom: height * 0.08,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                color: brand.captionColor,
                fontFamily: brand.captionFontFamily,
                fontSize: brand.captionFontSizePx,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                background: "rgba(0,0,0,0.55)",
                padding: "12px 24px",
                borderRadius: 12,
                backdropFilter: "blur(8px)",
                opacity,
              }}
            >
              {c.text}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* Outro: logo + tagline */}
      {outroFrames > 0 && (
        <Sequence from={introFrames + captureFrames} durationInFrames={outroFrames}>
          <AbsoluteFill style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            opacity: fadeAt(frame, introFrames + captureFrames, totalFrames, outroFrames),
          }}>
            <Img src={brand.logoSrc} style={{ width: width * 0.14, borderRadius: 16 }} />
            <div style={{
              color: brand.captionColor,
              fontFamily: brand.captionFontFamily,
              fontSize: brand.captionFontSizePx * 0.7,
              fontWeight: 500,
              opacity: 0.9,
              maxWidth: width * 0.7,
              textAlign: "center",
            }}>
              {brand.tagline}
            </div>
          </AbsoluteFill>
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

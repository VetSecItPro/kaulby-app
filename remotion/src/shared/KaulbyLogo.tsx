import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import { springAt, SMOOTH_SPRING, GENTLE_SPRING } from "./animations";
import { colors } from "./colors";

export const KaulbyLogo: React.FC<{
  showTagline?: boolean;
  showUrl?: boolean;
  startFrame?: number;
  exitFrame?: number;
}> = ({ showTagline = true, showUrl = false, startFrame = 0, exitFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry animation — logo is already visible at frame 0 (scale starts at 1, not 0)
  const logoScale = frame <= startFrame
    ? 1
    : 1 + springAt({ frame, fps, startFrame, config: SMOOTH_SPRING }) * 0.05;

  const textOpacity = frame <= startFrame
    ? 1
    : springAt({ frame, fps, startFrame, config: GENTLE_SPRING });

  const taglineOpacity = springAt({
    frame,
    fps,
    startFrame: startFrame + 8,
    config: GENTLE_SPRING,
  });

  const urlOpacity = springAt({
    frame,
    fps,
    startFrame: startFrame + 16,
    config: GENTLE_SPRING,
  });

  // Exit animation (if exitFrame is set)
  let exitProgress = 0;
  if (exitFrame !== undefined && frame >= exitFrame) {
    exitProgress = springAt({
      frame,
      fps,
      startFrame: exitFrame,
      config: SMOOTH_SPRING,
    });
  }

  const finalScale = logoScale * (1 - exitProgress * 0.3);
  const finalOpacity = 1 - exitProgress;

  // Glow pulse
  const glowIntensity = 0.2 + Math.sin(frame * 0.05) * 0.1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        opacity: finalOpacity,
      }}
    >
      {/* Teal glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, hsla(172, 66%, 50%, ${glowIntensity}) 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: `scale(${finalScale})`,
          width: 80,
          height: 80,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 0 40px ${colors.tealGlow}`,
        }}
      >
        <Img
          src={staticFile("icon-512.png")}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Brand name */}
      <div
        style={{
          marginTop: 16,
          opacity: textOpacity,
          fontSize: 36,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
        }}
      >
        Kaulby
      </div>

      {/* Tagline */}
      {showTagline && (
        <div
          style={{
            marginTop: 8,
            opacity: taglineOpacity,
            fontSize: 16,
            color: colors.mutedForeground,
            letterSpacing: "0.02em",
          }}
        >
          AI-Powered Community Monitoring
        </div>
      )}

      {/* Website URL */}
      {showUrl && (
        <div
          style={{
            marginTop: 12,
            opacity: urlOpacity,
            fontSize: 14,
            color: colors.primary,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          kaulbyapp.com
        </div>
      )}
    </div>
  );
};

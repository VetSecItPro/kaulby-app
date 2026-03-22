import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING, GENTLE_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";

export const IntroHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Progress = springAt({ frame, fps, startFrame: 5, config: GENTLE_SPRING });
  const line1Scale = 0.95 + line1Progress * 0.05;

  const line2Progress = springAt({ frame, fps, startFrame: 20, config: SMOOTH_SPRING });
  const line2Scale = 0.9 + line2Progress * 0.1;

  const glowIntensity = 0.15 + Math.sin(frame * 0.1) * 0.1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Glow behind text */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, hsla(172, 66%, 50%, ${glowIntensity}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />

      {/* Line 1 */}
      <div
        style={{
          opacity: line1Progress,
          transform: `scale(${line1Scale})`,
          fontSize: 32,
          fontWeight: 600,
          color: colors.foreground,
          letterSpacing: "-0.02em",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        Most founders guess what customers want.
      </div>

      {/* Line 2 — gradient text with glow */}
      <div
        style={{
          opacity: line2Progress,
          transform: `scale(${line2Scale})`,
          fontSize: 40,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%), hsl(210, 80%, 55%))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
          textAlign: "center",
          filter: `drop-shadow(0 0 20px ${colors.tealGlow})`,
        }}
      >
        Kaulby shows you.
      </div>
    </AbsoluteFill>
  );
};

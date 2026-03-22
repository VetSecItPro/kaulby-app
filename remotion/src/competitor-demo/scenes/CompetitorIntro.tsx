import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING, GENTLE_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";

export const CompetitorIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Progress = springAt({ frame, fps, startFrame: 5, config: GENTLE_SPRING });
  const line2Progress = springAt({ frame, fps, startFrame: 25, config: SMOOTH_SPRING });

  const glowIntensity = 0.12 + Math.sin(frame * 0.08) * 0.08;

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
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          width: 500,
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
          transform: `scale(${0.95 + line1Progress * 0.05})`,
          fontSize: 28,
          fontWeight: 600,
          color: colors.foreground,
          letterSpacing: "-0.02em",
          textAlign: "center",
          maxWidth: 700,
          lineHeight: 1.3,
          marginBottom: 16,
        }}
      >
        Your competitors' users are complaining in public.
      </div>

      {/* Line 2 */}
      <div
        style={{
          opacity: line2Progress,
          transform: `scale(${0.9 + line2Progress * 0.1})`,
          fontSize: 36,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
          textAlign: "center",
          filter: `drop-shadow(0 0 20px ${colors.tealGlow})`,
        }}
      >
        Are you listening?
      </div>
    </AbsoluteFill>
  );
};

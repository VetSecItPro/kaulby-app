import React from "react";
import { useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { springAt, SMOOTH_SPRING, GENTLE_SPRING } from "./animations";
import { colors } from "./colors";

export const CTAOverlay: React.FC<{
  startFrame: number;
  text?: string;
}> = ({ startFrame, text = "Start monitoring for free" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = springAt({
    frame,
    fps,
    startFrame: startFrame + 5,
    config: SMOOTH_SPRING,
  });

  const textOpacity = springAt({
    frame,
    fps,
    startFrame: startFrame + 15,
    config: GENTLE_SPRING,
  });

  const buttonOpacity = springAt({
    frame,
    fps,
    startFrame: startFrame + 25,
    config: GENTLE_SPRING,
  });

  const glowIntensity = 0.15 + Math.sin((frame - startFrame) * 0.08) * 0.1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, hsla(172, 66%, 50%, ${glowIntensity}) 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          width: 64,
          height: 64,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: `0 0 30px ${colors.tealGlow}`,
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
          marginTop: 12,
          opacity: textOpacity,
          fontSize: 28,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Kaulby
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: 16,
          opacity: buttonOpacity,
          padding: "10px 28px",
          borderRadius: 8,
          background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
          color: colors.primaryForeground,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {text}
      </div>
    </div>
  );
};

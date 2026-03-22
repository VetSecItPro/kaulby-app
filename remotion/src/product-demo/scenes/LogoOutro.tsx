import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { CTAOverlay } from "../../shared/CTAOverlay";

export const LogoOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in from content
  const fadeIn = springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        opacity: fadeIn,
      }}
    >
      <CTAOverlay startFrame={5} text="Start monitoring for free" />
    </AbsoluteFill>
  );
};

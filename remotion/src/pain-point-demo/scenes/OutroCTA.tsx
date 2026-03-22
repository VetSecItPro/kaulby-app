import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { CTAOverlay } from "../../shared/CTAOverlay";

export const OutroCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in from dark
  const bgFade = springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        opacity: bgFade,
      }}
    >
      <CTAOverlay startFrame={5} text="Find your pain points" />
    </AbsoluteFill>
  );
};

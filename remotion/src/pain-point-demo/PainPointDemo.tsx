import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { IntroHook } from "./scenes/IntroHook";
import { PainPointsView } from "./scenes/PainPointsView";
import { RecommendationsView } from "./scenes/RecommendationsView";
import { OutroCTA } from "./scenes/OutroCTA";
import { colors } from "../shared/colors";

// Total: 750 frames = 25s at 30fps
// Scene breakdown:
// Intro Hook:           0-60   (0-2s)
// Pain Points View:     60-330 (2-11s)
// Recommendations View: 330-570 (11-19s)
// Outro CTA:            570-750 (19-25s)

export const PainPointDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sequence from={0} durationInFrames={60} name="Intro Hook">
        <IntroHook />
      </Sequence>

      <Sequence from={60} durationInFrames={270} name="Pain Points View">
        <PainPointsView />
      </Sequence>

      <Sequence from={330} durationInFrames={240} name="Recommendations View">
        <RecommendationsView />
      </Sequence>

      <Sequence from={570} durationInFrames={180} name="Outro CTA">
        <OutroCTA />
      </Sequence>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CompetitorIntro } from "./scenes/CompetitorIntro";
import { MonitorSetup } from "./scenes/MonitorSetup";
import { CompetitorResults } from "./scenes/CompetitorResults";
import { CompetitorOutro } from "./scenes/CompetitorOutro";
import { colors } from "../shared/colors";

// Total: 750 frames = 25s at 30fps
// Scene breakdown:
// Competitor Intro:     0-75   (0-2.5s)
// Monitor Setup:        75-225 (2.5-7.5s)
// Competitor Results:   225-450 (7.5-15s)
// Competitor Outro:     450-750 (15-25s)

export const CompetitorDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sequence from={0} durationInFrames={75} name="Competitor Intro">
        <CompetitorIntro />
      </Sequence>

      <Sequence from={75} durationInFrames={150} name="Monitor Setup">
        <MonitorSetup />
      </Sequence>

      <Sequence from={225} durationInFrames={225} name="Competitor Results">
        <CompetitorResults />
      </Sequence>

      <Sequence from={450} durationInFrames={300} name="Competitor Outro">
        <CompetitorOutro />
      </Sequence>
    </AbsoluteFill>
  );
};

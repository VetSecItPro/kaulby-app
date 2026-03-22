import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { LogoIntro } from "./scenes/LogoIntro";
import { DashboardTransition } from "./scenes/DashboardTransition";
import { MonitorsPage } from "./scenes/MonitorsPage";
import { CreateMonitor } from "./scenes/CreateMonitor";
import { ResultsView } from "./scenes/ResultsView";
import { InsightsView } from "./scenes/InsightsView";
import { LogoOutro } from "./scenes/LogoOutro";
import { colors } from "../shared/colors";

// Total: 810 frames = 27s at 30fps
// Scene breakdown:
// Logo Intro:           0-75   (0-2.5s)
// Dashboard Transition: 75-105 (2.5-3.5s)
// Monitors Page:        105-255 (3.5-8.5s)
// Create Monitor:       255-465 (8.5-15.5s)
// Results View:         465-615 (15.5-20.5s)
// Insights View:        615-735 (20.5-24.5s)
// Logo Outro:           735-810 (24.5-27s)

export const ProductDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sequence from={0} durationInFrames={75} name="Logo Intro">
        <LogoIntro />
      </Sequence>

      <Sequence from={75} durationInFrames={30} name="Dashboard Transition">
        <DashboardTransition />
      </Sequence>

      <Sequence from={105} durationInFrames={150} name="Monitors Page">
        <MonitorsPage />
      </Sequence>

      <Sequence from={255} durationInFrames={210} name="Create Monitor">
        <CreateMonitor />
      </Sequence>

      <Sequence from={465} durationInFrames={150} name="Results View">
        <ResultsView />
      </Sequence>

      <Sequence from={615} durationInFrames={120} name="Insights View">
        <InsightsView />
      </Sequence>

      <Sequence from={735} durationInFrames={75} name="Logo Outro">
        <LogoOutro />
      </Sequence>
    </AbsoluteFill>
  );
};

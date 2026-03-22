import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ChatIntro } from "./scenes/ChatIntro";
import { UserQuestion } from "./scenes/UserQuestion";
import { AIResponse } from "./scenes/AIResponse";
import { FollowUp } from "./scenes/FollowUp";
import { SidebarCTA } from "./scenes/SidebarCTA";
import { colors } from "../shared/colors";

// Total: 540 frames = 18s at 30fps
// Scene breakdown:
// Chat Intro:     0-45   (0-1.5s)
// User Question:  45-150  (1.5-5s)
// AI Response:    150-330 (5-11s)
// Follow Up:      330-450 (11-15s)
// Sidebar + CTA:  450-540 (15-18s)

export const AIChatDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sequence from={0} durationInFrames={45} name="Chat Intro">
        <ChatIntro />
      </Sequence>

      <Sequence from={45} durationInFrames={105} name="User Question">
        <UserQuestion />
      </Sequence>

      <Sequence from={150} durationInFrames={180} name="AI Response">
        <AIResponse />
      </Sequence>

      <Sequence from={330} durationInFrames={120} name="Follow Up">
        <FollowUp />
      </Sequence>

      <Sequence from={450} durationInFrames={90} name="Sidebar + CTA">
        <SidebarCTA />
      </Sequence>
    </AbsoluteFill>
  );
};

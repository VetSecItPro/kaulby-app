import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { springAt, SMOOTH_SPRING, GENTLE_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { suggestedQuestions } from "../../data/mock-data";

export const ChatIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Brief logo flash
  const logoOpacity = frame < 15 ? springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING }) : Math.max(0, 1 - (frame - 15) / 10);
  const chatOpacity = springAt({ frame, fps, startFrame: 15, config: GENTLE_SPRING });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {/* Brief logo flash */}
      {frame < 30 && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: logoOpacity,
            zIndex: 10,
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden" }}>
            <Img src={staticFile("icon-512.png")} style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      )}

      {/* Chat interface slides in */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          opacity: chatOpacity,
          transform: `translateY(${(1 - chatOpacity) * 20}px)`,
        }}
      >
        <BrowserFrame url="app.kaulby.com/dashboard/ask" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Ask Kaulby AI">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                padding: "20px 24px",
              }}
            >
              {/* Chat header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill={colors.primary} stroke="none">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                </svg>
                <span style={{ fontSize: 20, fontWeight: 700, color: colors.foreground }}>
                  Ask Kaulby AI
                </span>
              </div>
              <div style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 24 }}>
                Powered by 47 monitoring tools
              </div>

              {/* Center area - welcome + suggestions */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                <div style={{ fontSize: 16, color: colors.mutedForeground, textAlign: "center" }}>
                  What would you like to know?
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500 }}>
                  {suggestedQuestions.map((q, i) => {
                    const pillProgress = springAt({ frame, fps, startFrame: 25 + i * 5, config: SMOOTH_SPRING });
                    return (
                      <div
                        key={q}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 9999,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: "hsla(0, 0%, 100%, 0.04)",
                          color: colors.foreground,
                          fontSize: 12,
                          opacity: pillProgress,
                          transform: `scale(${pillProgress})`,
                        }}
                      >
                        {q}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Input bar at bottom */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.card,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: colors.mutedForeground }}>Ask anything about your monitors...</span>
                <div style={{ marginLeft: "auto" }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2}>
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

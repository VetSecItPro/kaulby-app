import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING, GENTLE_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { CTAOverlay } from "../../shared/CTAOverlay";

const chatHistory = [
  { title: "Top pain points this week", time: "Just now" },
  { title: "Negative sentiment monitors", time: "Just now" },
  { title: "Competitor analysis: Linear", time: "2h ago" },
  { title: "Weekly sentiment report", time: "Yesterday" },
];

export const SidebarCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const layoutProgress = springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING });

  // CTA overlay fades in at the end
  const ctaStart = 50;
  const ctaProgress = springAt({ frame, fps, startFrame: ctaStart, config: GENTLE_SPRING });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {/* Chat with conversation history sidebar */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          opacity: 1 - ctaProgress * 0.7,
        }}
      >
        <BrowserFrame url="app.kaulby.com/dashboard/ask" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Ask Kaulby AI">
            <div style={{ display: "flex", height: "100%" }}>
              {/* Conversation history sidebar */}
              <div
                style={{
                  width: 220,
                  borderRight: `1px solid ${colors.border}`,
                  backgroundColor: "hsla(0, 0%, 100%, 0.02)",
                  padding: "16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  opacity: layoutProgress,
                  transform: `translateX(${(1 - layoutProgress) * -20}px)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "0 4px" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2}>
                    <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground }}>History</span>
                </div>
                {chatHistory.map((item, i) => {
                  const itemProgress = staggeredSpring({
                    frame,
                    fps,
                    startFrame: 8,
                    index: i,
                    staggerDelay: 6,
                    config: SMOOTH_SPRING,
                  });
                  return (
                    <div
                      key={item.title}
                      style={{
                        opacity: itemProgress,
                        padding: "8px 10px",
                        borderRadius: 8,
                        backgroundColor: i === 0 ? "hsla(0, 0%, 100%, 0.06)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: i === 0 ? colors.foreground : colors.mutedForeground,
                          fontWeight: i === 0 ? 500 : 400,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>{item.time}</div>
                    </div>
                  );
                })}
              </div>

              {/* Main chat area - summary view */}
              <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill={colors.primary} stroke="none">
                    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                  </svg>
                  <span style={{ fontSize: 20, fontWeight: 700, color: colors.foreground }}>Ask Kaulby AI</span>
                </div>

                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}>
                      2 conversations today
                    </div>
                    <div style={{ fontSize: 12, color: colors.mutedForeground }}>
                      Ask anything about your monitors, results, and insights.
                    </div>
                  </div>
                </div>

                {/* Input bar */}
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
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>

      {/* CTA overlay */}
      {ctaProgress > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: `hsla(0, 0%, 3.9%, ${ctaProgress * 0.85})`,
          }}
        >
          <CTAOverlay startFrame={ctaStart + 5} text="Start monitoring for free" />
        </div>
      )}
    </AbsoluteFill>
  );
};

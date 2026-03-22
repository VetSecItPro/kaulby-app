import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { TypingAnimation } from "../../shared/TypingAnimation";
import { chatMessages } from "../../data/mock-data";

export const UserQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const layoutOpacity = springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING });
  const question = chatMessages[0].content;

  // Typing starts at frame 10
  const typingStart = 10;
  const typingDuration = Math.ceil(question.length / 0.8);

  // Message bubble appears after typing finishes
  const bubbleFrame = typingStart + typingDuration + 5;
  const bubbleProgress = springAt({ frame, fps, startFrame: bubbleFrame, config: SMOOTH_SPRING });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          opacity: layoutOpacity,
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill={colors.primary} stroke="none">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                </svg>
                <span style={{ fontSize: 20, fontWeight: 700, color: colors.foreground }}>Ask Kaulby AI</span>
              </div>
              <div style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 24 }}>
                Powered by 47 monitoring tools
              </div>

              {/* Chat messages area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12 }}>
                {/* User message bubble */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      maxWidth: "70%",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px 12px 2px 12px",
                        backgroundColor: "hsla(172, 66%, 50%, 0.15)",
                        border: `1px solid ${colors.tealGlow}`,
                      }}
                    >
                      {frame < bubbleFrame ? (
                        <TypingAnimation
                          text={question}
                          startFrame={typingStart}
                          fontSize={13}
                          color={colors.foreground}
                          charsPerFrame={0.8}
                        />
                      ) : (
                        <span style={{ fontSize: 13, color: colors.foreground }}>{question}</span>
                      )}
                    </div>
                    {/* User avatar */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${colors.primary}, hsl(210, 80%, 55%))`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "white",
                        flexShrink: 0,
                      }}
                    >
                      AC
                    </div>
                  </div>
                </div>

                {/* Loading indicator (appears after message sent) */}
                {bubbleProgress > 0.5 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      opacity: Math.min(1, (bubbleProgress - 0.5) * 2),
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        backgroundColor: "hsla(172, 66%, 50%, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill={colors.primary} stroke="none">
                        <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                      </svg>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px 12px 12px 2px",
                        backgroundColor: colors.card,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 1, 2].map((dot) => (
                          <div
                            key={dot}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: colors.primary,
                              opacity: 0.3 + 0.7 * Math.abs(Math.sin((frame + dot * 8) * 0.15)),
                            }}
                          />
                        ))}
                        <span style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 6 }}>
                          Analyzing your data...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div
                style={{
                  marginTop: 12,
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
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2}>
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

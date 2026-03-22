import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { TypingAnimation } from "../../shared/TypingAnimation";
import { chatMessages } from "../../data/mock-data";

// Simple markdown-ish renderer for bold text
const renderMarkdown = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} style={{ fontWeight: 700, color: colors.foreground }}>
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export const FollowUp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const question2 = chatMessages[2].content;
  const answer2 = chatMessages[3];

  // User types second question
  const typingStart = 5;
  const typingDuration = Math.ceil(question2.length / 1.0);
  const bubbleSentFrame = typingStart + typingDuration + 5;

  // AI response streams
  const aiResponseStart = bubbleSentFrame + 15;
  const responseText = answer2.content;
  const charsToShow = Math.min(
    responseText.length,
    Math.max(0, Math.floor((frame - aiResponseStart) * 3))
  );
  const visibleResponse = responseText.slice(0, charsToShow);

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
              <div style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 16 }}>
                Powered by 47 monitoring tools
              </div>

              {/* Chat messages */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Previous Q&A (collapsed summary) */}
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: "hsla(0, 0%, 100%, 0.03)",
                    border: `1px solid ${colors.border}`,
                    fontSize: 11,
                    color: colors.mutedForeground,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2}>
                    <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
                  Previous: "What are the top pain points this week?" &mdash; 3 pain points identified
                </div>

                {/* Second user question */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "70%", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px 12px 2px 12px",
                        backgroundColor: "hsla(172, 66%, 50%, 0.15)",
                        border: `1px solid ${colors.tealGlow}`,
                      }}
                    >
                      {frame < bubbleSentFrame ? (
                        <TypingAnimation
                          text={question2}
                          startFrame={typingStart}
                          fontSize={13}
                          color={colors.foreground}
                          charsPerFrame={1.0}
                        />
                      ) : (
                        <span style={{ fontSize: 13, color: colors.foreground }}>{question2}</span>
                      )}
                    </div>
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

                {/* AI response */}
                {frame >= bubbleSentFrame && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
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
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Tool badge */}
                      {answer2.tools && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {answer2.tools.map((tool) => {
                            const toolProgress = springAt({
                              frame,
                              fps,
                              startFrame: bubbleSentFrame + 5,
                              config: SMOOTH_SPRING,
                            });
                            return (
                              <div
                                key={tool}
                                style={{
                                  opacity: toolProgress,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  backgroundColor: "hsla(0, 0%, 100%, 0.06)",
                                  border: `1px solid ${colors.border}`,
                                  fontSize: 11,
                                  color: colors.mutedForeground,
                                }}
                              >
                                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2}>
                                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                                {tool}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Response text */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "12px 12px 12px 2px",
                          backgroundColor: colors.card,
                          border: `1px solid ${colors.border}`,
                          fontSize: 13,
                          color: colors.mutedForeground,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {frame >= aiResponseStart
                          ? renderMarkdown(visibleResponse)
                          : (
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
                              </div>
                            )}
                        {frame >= aiResponseStart && charsToShow < responseText.length && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 2,
                              height: 14,
                              backgroundColor: colors.primary,
                              marginLeft: 1,
                              verticalAlign: "text-bottom",
                            }}
                          />
                        )}
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

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING, GENTLE_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { chatMessages, platformColors } from "../../data/mock-data";

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

export const AIResponse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const question = chatMessages[0].content;
  const answer = chatMessages[1];

  // Tool badges appear first
  const toolsStart = 10;
  // Response text streams in
  const responseStart = 30;
  // Citations appear after response
  const citationsStart = 120;

  // Streaming text effect: reveal characters over time
  const responseText = answer.content;
  const charsToShow = Math.min(
    responseText.length,
    Math.max(0, Math.floor((frame - responseStart) * 2.5))
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

              {/* Scrollable chat area */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* User message */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "70%", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "12px 12px 2px 12px",
                        backgroundColor: "hsla(172, 66%, 50%, 0.15)",
                        border: `1px solid ${colors.tealGlow}`,
                        fontSize: 13,
                        color: colors.foreground,
                      }}
                    >
                      {question}
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
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {/* Bot avatar */}
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
                    {/* Tool badges */}
                    {answer.tools && (
                      <div style={{ display: "flex", gap: 6 }}>
                        {answer.tools.map((tool, i) => {
                          const toolProgress = staggeredSpring({
                            frame,
                            fps,
                            startFrame: toolsStart,
                            index: i,
                            staggerDelay: 8,
                            config: SMOOTH_SPRING,
                          });
                          return (
                            <div
                              key={tool}
                              style={{
                                opacity: toolProgress,
                                transform: `scale(${toolProgress})`,
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

                    {/* Response text bubble */}
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
                      {frame >= responseStart
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
                      {/* Cursor while streaming */}
                      {frame >= responseStart && charsToShow < responseText.length && (
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

                    {/* Citation cards */}
                    {answer.citations && frame >= citationsStart && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {answer.citations.map((citation, i) => {
                          const citProgress = staggeredSpring({
                            frame,
                            fps,
                            startFrame: citationsStart,
                            index: i,
                            staggerDelay: 10,
                            config: SMOOTH_SPRING,
                          });
                          return (
                            <div
                              key={citation.title}
                              style={{
                                opacity: citProgress,
                                transform: `translateY(${(1 - citProgress) * 10}px)`,
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: `1px solid ${colors.border}`,
                                backgroundColor: colors.card,
                                maxWidth: 260,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {/* Platform badge */}
                                <span
                                  style={{
                                    padding: "1px 6px",
                                    borderRadius: 9999,
                                    border: `1px solid ${platformColors[citation.platform] || colors.border}`,
                                    color: platformColors[citation.platform] || colors.foreground,
                                    fontSize: 10,
                                    fontWeight: 500,
                                  }}
                                >
                                  {citation.platform}
                                </span>
                                {/* Monitor badge */}
                                <span
                                  style={{
                                    padding: "1px 6px",
                                    borderRadius: 9999,
                                    backgroundColor: "hsla(0, 0%, 100%, 0.08)",
                                    color: colors.mutedForeground,
                                    fontSize: 10,
                                  }}
                                >
                                  {citation.monitor}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: colors.foreground, lineHeight: 1.3 }}>
                                {citation.title}
                              </div>
                              <div style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 1.3 }}>
                                {citation.snippet}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2}>
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                                </svg>
                                <span style={{ fontSize: 10, color: colors.primary }}>View source</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
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

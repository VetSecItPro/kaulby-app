import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { topics } from "../../data/mock-data";

const TrendIcon: React.FC<{ trend: string; size?: number }> = ({ trend, size = 12 }) => {
  if (trend === "rising") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.positive} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 6l-9.5 9.5-5-5L1 18" />
        <path d="M17 6h6v6" />
      </svg>
    );
  }
  if (trend === "falling") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.negative} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 18l-9.5-9.5-5 5L1 6" />
        <path d="M17 18h6v-6" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.mutedForeground} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
};

const trendLabel = (trend: string) => {
  if (trend === "rising") return "Rising";
  if (trend === "falling") return "Falling";
  return "Stable";
};

const trendColor = (trend: string) => {
  if (trend === "rising") return colors.positive;
  if (trend === "falling") return colors.negative;
  return colors.mutedForeground;
};

const InsightTopicCard: React.FC<{
  topic: (typeof topics)[0];
  index: number;
  frame: number;
  fps: number;
}> = ({ topic, index, frame, fps }) => {
  const progress = staggeredSpring({ frame, fps, startFrame: 30, index, staggerDelay: 8, config: SMOOTH_SPRING });

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 20}px)`,
        borderRadius: 12,
        border: `1px solid ${topic.isAIPick ? "hsl(270, 60%, 55%)" : colors.border}`,
        backgroundColor: colors.card,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      {/* AI pick badge */}
      {topic.isAIPick && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: 12,
            padding: "2px 8px",
            borderRadius: 9999,
            background: "linear-gradient(135deg, hsl(270, 60%, 55%), hsl(300, 60%, 55%))",
            color: "white",
            fontSize: 10,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          AI Pick
        </div>
      )}

      {/* Topic name */}
      <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground }}>
        {topic.topic}
      </div>

      {/* Monitor badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {topic.monitors.map((m) => (
          <span
            key={m}
            style={{
              padding: "2px 6px",
              borderRadius: 9999,
              backgroundColor: "hsla(0, 0%, 100%, 0.08)",
              color: colors.mutedForeground,
              fontSize: 10,
            }}
          >
            {m}
          </span>
        ))}
      </div>

      {/* Trend + mentions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TrendIcon trend={topic.trend} size={12} />
          <span style={{ fontSize: 11, color: trendColor(topic.trend), fontWeight: 500 }}>
            {trendLabel(topic.trend)}
          </span>
        </div>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 9999,
            backgroundColor: "hsla(0, 0%, 100%, 0.08)",
            color: colors.foreground,
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {topic.mentions} mentions
        </span>
      </div>

      {/* Platform badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {topic.platforms.map((p) => (
          <span
            key={p.name}
            style={{
              padding: "2px 6px",
              borderRadius: 9999,
              backgroundColor: p.color,
              color: "white",
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Sentiment breakdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span style={{ color: colors.positive }}>+{topic.sentimentPositive}</span>
        <span style={{ color: colors.negative }}>-{topic.sentimentNegative}</span>
        <span style={{ color: colors.mutedForeground }}>~{topic.sentimentNeutral}</span>
      </div>

      {/* Keyword badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {topic.keywords.map((kw) => (
          <span
            key={kw}
            style={{
              padding: "2px 6px",
              borderRadius: 9999,
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: 10,
            }}
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
};

export const InsightsView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });
  const statsProgress = springAt({ frame, fps, startFrame: 12, config: SMOOTH_SPRING });

  const stats = [
    { icon: "sparkles", iconColor: "hsl(38, 92%, 50%)", label: "Discovered Topics", value: "8", sub: "3 cross-platform" },
    { icon: "trending", iconColor: colors.positive, label: "Rising Topics", value: "5", sub: "Gaining traction this period" },
    { icon: "network", iconColor: "hsl(210, 80%, 55%)", label: "Total Mentions", value: "156", sub: "Across 5 platforms" },
  ];

  const timeRanges = ["7 Days", "30 Days", "90 Days"];

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
        <BrowserFrame url="app.kaulby.com/dashboard/insights" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Insights">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  opacity: headerProgress,
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground, letterSpacing: "-0.02em" }}>
                    Insights
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Time range buttons */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {timeRanges.map((range) => (
                      <div
                        key={range}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          backgroundColor: range === "30 Days" ? "hsla(0, 0%, 100%, 0.1)" : "transparent",
                          border: `1px solid ${range === "30 Days" ? colors.border : "transparent"}`,
                          fontSize: 12,
                          fontWeight: range === "30 Days" ? 600 : 400,
                          color: range === "30 Days" ? colors.foreground : colors.mutedForeground,
                        }}
                      >
                        {range}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Analyzing 156 results
                  </span>
                </div>
              </div>

              {/* Stats cards row */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 18,
                  opacity: statsProgress,
                }}
              >
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.card,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          backgroundColor: `${stat.iconColor}22`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                        }}
                      >
                        {stat.icon === "sparkles" && (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill={stat.iconColor} stroke="none">
                            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                          </svg>
                        )}
                        {stat.icon === "trending" && (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={stat.iconColor} strokeWidth={2.5}>
                            <path d="M23 6l-9.5 9.5-5-5L1 18" />
                          </svg>
                        )}
                        {stat.icon === "network" && (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={stat.iconColor} strokeWidth={2}>
                            <circle cx="12" cy="5" r="3" />
                            <circle cx="5" cy="19" r="3" />
                            <circle cx="19" cy="19" r="3" />
                            <path d="M12 8v3M9 15l-2 2M15 15l2 2" />
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: colors.mutedForeground }}>{stat.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Trending topics heading */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: colors.foreground,
                  marginBottom: 12,
                  opacity: statsProgress,
                }}
              >
                Trending Cross-Platform Topics
              </div>

              {/* 2x2 topic grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {topics.map((topic, index) => (
                  <InsightTopicCard
                    key={topic.id}
                    topic={topic}
                    index={index}
                    frame={frame}
                    fps={fps}
                  />
                ))}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

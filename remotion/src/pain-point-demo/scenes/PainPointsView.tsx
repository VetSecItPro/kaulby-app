import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { painPoints } from "../../data/mock-data";

// SVG icon paths
const iconPaths: Record<string, string> = {
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0a3 3 0 1 0 0-6",
  lightbulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  alertTriangle: "M12 2L2 22h20L12 2zm0 7v5m0 3h.01",
};

const PainPointIcon: React.FC<{ icon: string; size?: number; color?: string }> = ({ icon, size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={iconPaths[icon] || iconPaths.shield} />
  </svg>
);

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

const trendColor = (trend: string) => {
  if (trend === "rising") return colors.positive;
  if (trend === "falling") return colors.negative;
  return colors.mutedForeground;
};

const trendLabel = (trend: string) => {
  if (trend === "rising") return "Rising";
  if (trend === "falling") return "Falling";
  return "Stable";
};

const PainPointCard: React.FC<{
  point: (typeof painPoints)[0];
  index: number;
  frame: number;
  fps: number;
}> = ({ point, index, frame, fps }) => {
  const progress = staggeredSpring({ frame, fps, startFrame: 40, index, staggerDelay: 8, config: SMOOTH_SPRING });
  const total = point.sentimentBreakdown.positive + point.sentimentBreakdown.negative + point.sentimentBreakdown.neutral;

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 20}px)`,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Header: icon + label + count */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: `${point.iconColor}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PainPointIcon icon={point.icon} size={14} color={point.iconColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.foreground }}>{point.label}</div>
        </div>
        {/* Count badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            backgroundColor: `${point.iconColor}22`,
            color: point.iconColor,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {point.count} mentions
        </span>
      </div>

      {/* Trend + platforms row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TrendIcon trend={point.trend} size={11} />
          <span style={{ fontSize: 11, color: trendColor(point.trend), fontWeight: 500 }}>{trendLabel(point.trend)}</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {point.platforms.map((p) => (
            <span
              key={p.name}
              style={{
                padding: "1px 6px",
                borderRadius: 9999,
                backgroundColor: p.color,
                color: "white",
                fontSize: 9,
                fontWeight: 500,
              }}
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* Sentiment breakdown bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            display: "flex",
            overflow: "hidden",
            gap: 1,
          }}
        >
          <div style={{ width: `${(point.sentimentBreakdown.positive / total) * 100}%`, backgroundColor: colors.positive, borderRadius: 2 }} />
          <div style={{ width: `${(point.sentimentBreakdown.negative / total) * 100}%`, backgroundColor: colors.negative, borderRadius: 2 }} />
          <div style={{ width: `${(point.sentimentBreakdown.neutral / total) * 100}%`, backgroundColor: colors.mutedForeground, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, color: colors.positive }}>+{point.sentimentBreakdown.positive}</span>
        <span style={{ fontSize: 10, color: colors.negative }}>-{point.sentimentBreakdown.negative}</span>
        <span style={{ fontSize: 10, color: colors.mutedForeground }}>~{point.sentimentBreakdown.neutral}</span>
      </div>

      {/* Keywords */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {point.keywords.map((kw) => (
          <span
            key={kw}
            style={{
              padding: "1px 6px",
              borderRadius: 9999,
              border: `1px solid ${colors.border}`,
              color: colors.mutedForeground,
              fontSize: 9,
            }}
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
};

export const PainPointsView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });
  const statsProgress = springAt({ frame, fps, startFrame: 15, config: SMOOTH_SPRING });
  const tabsProgress = springAt({ frame, fps, startFrame: 10, config: SMOOTH_SPRING });

  const tabs = [
    { label: "Pain Points", active: true, icon: "alertTriangle" },
    { label: "Recommendations", active: false, icon: null },
    { label: "Trending Topics", active: false, icon: null },
  ];

  const stats = [
    { label: "Total Issues", value: "5", color: colors.negative },
    { label: "Rising Issues", value: "2", color: colors.warning },
    { label: "Total Mentions", value: "49", color: colors.primary },
  ];

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
                  marginBottom: 14,
                  opacity: headerProgress,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground, letterSpacing: "-0.02em" }}>
                  Insights
                </div>
              </div>

              {/* Segmented control tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  marginBottom: 14,
                  opacity: tabsProgress,
                  backgroundColor: colors.muted,
                  borderRadius: 8,
                  padding: 3,
                  width: "fit-content",
                }}
              >
                {tabs.map((tab) => (
                  <div
                    key={tab.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 14px",
                      borderRadius: 6,
                      backgroundColor: tab.active ? colors.card : "transparent",
                      border: tab.active ? `1px solid ${colors.border}` : "1px solid transparent",
                      fontSize: 12,
                      fontWeight: tab.active ? 600 : 400,
                      color: tab.active ? colors.foreground : colors.mutedForeground,
                      boxShadow: tab.active ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                    }}
                  >
                    {tab.icon && <PainPointIcon icon={tab.icon} size={12} color={tab.active ? colors.foreground : colors.mutedForeground} />}
                    {tab.label}
                  </div>
                ))}
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 14,
                  opacity: statsProgress,
                }}
              >
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.card,
                    }}
                  >
                    <div style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4 }}>{stat.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Pain point cards grid (2x2) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {painPoints.slice(0, 4).map((point, index) => (
                  <PainPointCard key={point.category} point={point} index={index} frame={frame} fps={fps} />
                ))}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

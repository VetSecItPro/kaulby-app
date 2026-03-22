import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { recommendations } from "../../data/mock-data";

const iconPaths: Record<string, string> = {
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0a3 3 0 1 0 0-6",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z",
  alertTriangle: "M12 2L2 22h20L12 2zm0 7v5m0 3h.01",
};

const RecIcon: React.FC<{ icon: string; size?: number; color?: string }> = ({ icon, size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={iconPaths[icon] || iconPaths.users} />
  </svg>
);

const RecommendationCard: React.FC<{
  rec: (typeof recommendations)[0];
  index: number;
  frame: number;
  fps: number;
  expanded?: boolean;
}> = ({ rec, index, frame, fps, expanded = false }) => {
  const progress = staggeredSpring({ frame, fps, startFrame: 35, index, staggerDelay: 10, config: SMOOTH_SPRING });

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 20}px)`,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: `${rec.priorityColor}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <RecIcon icon={rec.categoryIcon} size={16} color={rec.priorityColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.foreground, lineHeight: 1.3 }}>{rec.title}</div>
          <div style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 3, lineHeight: 1.4 }}>{rec.description}</div>
        </div>
      </div>

      {/* Badges row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {/* Priority badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            backgroundColor: `${rec.priorityColor}22`,
            color: rec.priorityColor,
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {rec.priority}
        </span>
        {/* Category badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            border: `1px solid ${colors.border}`,
            color: colors.mutedForeground,
            fontSize: 10,
          }}
        >
          {rec.category}
        </span>
        {/* Effort badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            backgroundColor: "hsla(0, 0%, 100%, 0.08)",
            color: colors.foreground,
            fontSize: 10,
            fontWeight: 500,
          }}
        >
          {rec.effort}
        </span>
      </div>

      {/* Impact line */}
      <div style={{ fontSize: 11, color: colors.primary, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 6l-9.5 9.5-5-5L1 18" />
        </svg>
        {rec.impact}
      </div>

      {/* Expanded actions */}
      {expanded && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            backgroundColor: "hsla(0, 0%, 100%, 0.03)",
            borderLeft: `2px solid ${colors.tealGlow}`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.foreground }}>Action Steps</div>
          {rec.actions.map((action, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: colors.primary,
                  color: colors.primaryForeground,
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 1.4 }}>{action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const RecommendationsView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });
  const tabsProgress = springAt({ frame, fps, startFrame: 8, config: SMOOTH_SPRING });
  const statsProgress = springAt({ frame, fps, startFrame: 15, config: SMOOTH_SPRING });

  const tabs = [
    { label: "Pain Points", active: false, icon: null },
    { label: "Recommendations", active: true, icon: "alertTriangle" },
    { label: "Trending Topics", active: false, icon: null },
  ];

  const stats = [
    { label: "Recommendations", value: "3", color: colors.primary },
    { label: "Critical / High", value: "2", color: colors.negative },
    { label: "Quick Wins", value: "2", color: colors.positive },
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

              {/* Recommendation cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recommendations.map((rec, index) => (
                  <RecommendationCard
                    key={rec.title}
                    rec={rec}
                    index={index}
                    frame={frame}
                    fps={fps}
                    expanded={index === 0}
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

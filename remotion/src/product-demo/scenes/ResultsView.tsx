import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { results, platformColors } from "../../data/mock-data";

// Simplified icon components
const ArrowLeftIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const ThumbsUpIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const ThumbsDownIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
  </svg>
);

const BookmarkIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const MoreHorizontalIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

const sentimentIcon = (sentiment: string) => {
  if (sentiment === "positive") return <ThumbsUpIcon size={13} color={colors.positive} />;
  if (sentiment === "negative") return <ThumbsDownIcon size={13} color={colors.negative} />;
  return null;
};

const categoryIcons: Record<string, string> = {
  target: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
  help: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14a3 3 0 0 1 2.12 5.12L12 15m0 3h.01",
  alert: "M12 2L2 22h20L12 2zm0 7v5m0 3h.01",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
};

const CategoryIcon: React.FC<{ icon: string; size?: number; color?: string }> = ({ icon, size = 12, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={categoryIcons[icon] || ""} />
  </svg>
);

const leadScoreColor = (label: string) => {
  if (label === "Hot") return "hsl(16, 100%, 50%)";
  if (label === "Warm") return "hsl(38, 92%, 50%)";
  return colors.mutedForeground;
};

const ResultCard: React.FC<{
  result: (typeof results)[0];
  index: number;
  frame: number;
  fps: number;
}> = ({ result, index, frame, fps }) => {
  const progress = staggeredSpring({ frame, fps, startFrame: 20, index, staggerDelay: 10, config: SMOOTH_SPRING });

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
        gap: 8,
      }}
    >
      {/* Top row: badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {/* Platform badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            border: `1px solid ${platformColors[result.platform] || colors.border}`,
            color: platformColors[result.platform] || colors.foreground,
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {result.platform}
        </span>
        {/* Sentiment */}
        {sentimentIcon(result.sentiment)}
        {/* Category badge */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 9999,
            backgroundColor: `${result.categoryColor}22`,
            color: result.categoryColor,
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <CategoryIcon icon={result.categoryIcon} size={10} color={result.categoryColor} />
          {result.category}
        </span>
        {/* Lead score */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 9999,
            backgroundColor: `${leadScoreColor(result.leadLabel)}22`,
            color: leadScoreColor(result.leadLabel),
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {result.leadLabel} {result.leadScore}
        </span>
        {/* New badge */}
        {result.isNew && (
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 9999,
              backgroundColor: colors.primary,
              color: colors.primaryForeground,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            New
          </span>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: colors.foreground,
          lineHeight: 1.3,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {result.title}
      </div>

      {/* Meta line */}
      <div style={{ fontSize: 11, color: colors.mutedForeground }}>
        From monitor: {result.monitorName} &bull; by {result.author} &bull; {result.date}
      </div>

      {/* AI Summary */}
      <div
        style={{
          fontSize: 12,
          color: colors.mutedForeground,
          lineHeight: 1.4,
          padding: "6px 10px",
          borderRadius: 8,
          backgroundColor: "hsla(0, 0%, 100%, 0.03)",
          borderLeft: `2px solid ${colors.tealGlow}`,
        }}
      >
        {result.aiSummary}
      </div>

      {/* Bottom actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <BookmarkIcon size={14} color={colors.mutedForeground} />
        <div
          style={{
            padding: "5px 14px",
            borderRadius: 8,
            backgroundColor: colors.teal,
            color: colors.primaryForeground,
            fontSize: 12,
            fontWeight: 600,
            marginLeft: "auto",
          }}
        >
          View
        </div>
        <MoreHorizontalIcon size={14} color={colors.mutedForeground} />
      </div>
    </div>
  );
};

export const ResultsView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });

  const filterTabs = [
    { label: "All", count: "42", active: true },
    { label: "Unread", count: "8", active: false, primary: true },
    { label: "Saved", count: null, active: false },
    { label: "Hidden", count: null, active: false },
  ];

  const categoryChips = [
    { label: "Solutions", color: "hsl(142, 71%, 45%)" },
    { label: "Budget", color: "hsl(38, 92%, 50%)" },
    { label: "Pain Points", color: "hsl(0, 84%, 60%)" },
    { label: "Advice", color: "hsl(210, 80%, 55%)" },
    { label: "Trending", color: "hsl(270, 60%, 55%)" },
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
        <BrowserFrame url="app.kaulby.com/dashboard/results" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Results">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                  opacity: headerProgress,
                }}
              >
                <ArrowLeftIcon size={18} color={colors.mutedForeground} />
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground }}>
                  Trellis Brand Monitor
                </div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 9999,
                    backgroundColor: colors.primary,
                    color: colors.primaryForeground,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Active
                </span>
              </div>

              {/* Filter tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 12,
                  opacity: headerProgress,
                }}
              >
                {filterTabs.map((tab) => (
                  <div
                    key={tab.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 12px",
                      borderRadius: 8,
                      backgroundColor: tab.active ? "hsla(0, 0%, 100%, 0.1)" : "transparent",
                      border: `1px solid ${tab.active ? colors.border : "transparent"}`,
                      fontSize: 12,
                      fontWeight: tab.active ? 600 : 400,
                      color: tab.active ? colors.foreground : colors.mutedForeground,
                    }}
                  >
                    {tab.label}
                    {tab.count && (
                      <span
                        style={{
                          padding: "0 5px",
                          borderRadius: 9999,
                          backgroundColor: tab.primary ? colors.primary : "hsla(0, 0%, 100%, 0.1)",
                          color: tab.primary ? colors.primaryForeground : colors.foreground,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Category chips */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 14,
                  opacity: headerProgress,
                }}
              >
                {categoryChips.map((chip) => (
                  <span
                    key={chip.label}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 9999,
                      backgroundColor: `${chip.color}18`,
                      color: chip.color,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>

              {/* Result cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map((result, index) => (
                  <ResultCard key={result.id} result={result} index={index} frame={frame} fps={fps} />
                ))}
              </div>

              {/* Mark all as read button */}
              {(() => {
                const btnProgress = springAt({ frame, fps, startFrame: 60, config: SMOOTH_SPRING });
                return (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "center",
                      opacity: btnProgress,
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 20px",
                        borderRadius: 8,
                        backgroundColor: colors.teal,
                        color: colors.primaryForeground,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Mark all as read
                    </div>
                  </div>
                );
              })()}
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

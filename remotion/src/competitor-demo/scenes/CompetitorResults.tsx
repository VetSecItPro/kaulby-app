import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { platformColors, type ResultItem } from "../../data/mock-data";

const ThumbsDownIcon: React.FC<{ size?: number; color?: string }> = ({ size = 13, color = "currentColor" }) => (
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
  if (sentiment === "negative") return <ThumbsDownIcon size={13} color={colors.negative} />;
  return null;
};

const leadScoreColor = (label: string) => {
  if (label === "Hot") return "hsl(16, 100%, 50%)";
  if (label === "Warm") return "hsl(38, 92%, 50%)";
  return colors.mutedForeground;
};

const competitorResults: ResultItem[] = [
  {
    id: "comp_1",
    platform: "Reddit",
    title: "Linear is getting worse with every update",
    monitorName: "Competitor Watch",
    author: "u/frustrated_pm",
    date: "Mar 10, 2026",
    sentiment: "negative",
    category: "Competitor Mention",
    categoryColor: "hsl(0, 84%, 60%)",
    categoryIcon: "alert",
    leadScore: 82,
    leadLabel: "Hot",
    isNew: true,
    aiSummary: "User frustrated with Linear's recent UI changes and performance regression. Multiple commenters agree. Opportunity to position as stable alternative.",
  },
  {
    id: "comp_2",
    platform: "G2",
    title: "Switched from Monday.com — here's what I found",
    monitorName: "Competitor Watch",
    author: "ProjectLead_James",
    date: "Mar 9, 2026",
    sentiment: "neutral",
    category: "Solution Request",
    categoryColor: "hsl(210, 80%, 55%)",
    categoryIcon: "help",
    leadScore: 65,
    leadLabel: "Warm",
    isNew: true,
    aiSummary: "Detailed comparison review. User switched but still looking for better options. Mentions wanting AI features that Monday lacks.",
  },
  {
    id: "comp_3",
    platform: "Hacker News",
    title: "Notion alternative for technical teams?",
    monitorName: "Competitor Watch",
    author: "dev_tooling",
    date: "Mar 9, 2026",
    sentiment: "neutral",
    category: "Buying Signal",
    categoryColor: "hsl(142, 71%, 45%)",
    categoryIcon: "target",
    leadScore: 88,
    leadLabel: "Hot",
    isNew: true,
    aiSummary: "Strong buying signal. User actively seeking alternatives with developer-friendly features. 45 comments with multiple tool recommendations.",
  },
];

const categoryIcons: Record<string, string> = {
  target: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
  help: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14a3 3 0 0 1 2.12 5.12L12 15m0 3h.01",
  alert: "M12 2L2 22h20L12 2zm0 7v5m0 3h.01",
};

const CategoryIcon: React.FC<{ icon: string; size?: number; color?: string }> = ({ icon, size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={categoryIcons[icon] || ""} />
  </svg>
);

const CompetitorResultCard: React.FC<{
  result: ResultItem;
  index: number;
  frame: number;
  fps: number;
}> = ({ result, index, frame, fps }) => {
  const progress = staggeredSpring({ frame, fps, startFrame: 25, index, staggerDelay: 12, config: SMOOTH_SPRING });

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
        {sentimentIcon(result.sentiment)}
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
      <div style={{ fontSize: 14, fontWeight: 500, color: colors.foreground, lineHeight: 1.3 }}>
        {result.title}
      </div>

      {/* Meta */}
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

export const CompetitorResults: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });

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
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground }}>
                  Competitor Watch
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

              {/* Result cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {competitorResults.map((result, index) => (
                  <CompetitorResultCard key={result.id} result={result} index={index} frame={frame} fps={fps} />
                ))}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

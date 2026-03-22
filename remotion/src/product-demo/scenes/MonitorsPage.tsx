import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { staggeredSpring, springAt, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { monitors, platformColors } from "../../data/mock-data";

// Simplified Lucide icon SVGs
const RadioIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

const PlusCircleIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8m-4-4h8" />
  </svg>
);

const MoreVerticalIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const MonitorCard: React.FC<{
  monitor: (typeof monitors)[0];
  index: number;
  frame: number;
  fps: number;
}> = ({ monitor, index, frame, fps }) => {
  const progress = staggeredSpring({ frame, fps, startFrame: 10, index, staggerDelay: 8, config: SMOOTH_SPRING });
  const opacity = progress;
  const translateY = (1 - progress) * 30;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Top row: checkbox + name + status + menu */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Checkbox */}
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: `2px solid ${colors.border}`,
              flexShrink: 0,
            }}
          />
          {/* Radio icon */}
          <RadioIcon size={16} color={colors.mutedForeground} />
          {/* Name */}
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: colors.foreground }}>
            {monitor.name}
          </div>
          {/* Active badge */}
          <div
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
          </div>
          {/* More menu */}
          <MoreVerticalIcon size={16} color={colors.mutedForeground} />
        </div>

        {/* Keywords */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 12, color: colors.mutedForeground, marginRight: 4 }}>Keywords:</span>
          {monitor.keywords.map((kw) => (
            <span
              key={kw}
              style={{
                padding: "2px 8px",
                borderRadius: 9999,
                backgroundColor: "hsla(0, 0%, 100%, 0.06)",
                fontSize: 12,
                color: colors.foreground,
              }}
            >
              {kw}
            </span>
          ))}
        </div>

        {/* Platforms */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 12, color: colors.mutedForeground, marginRight: 4 }}>Platforms:</span>
          {monitor.platforms.map((p) => (
            <span
              key={p}
              style={{
                padding: "2px 8px",
                borderRadius: 9999,
                border: `1px solid ${platformColors[p] || colors.border}`,
                color: platformColors[p] || colors.foreground,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {p}
            </span>
          ))}
        </div>

        {/* Last refreshed */}
        <div style={{ fontSize: 12, color: colors.mutedForeground }}>
          Last refreshed {monitor.lastRefreshed}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 12,
              fontWeight: 500,
              color: colors.foreground,
            }}
          >
            Scan Now
          </div>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              backgroundColor: colors.teal,
              color: colors.primaryForeground,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            View Results
          </div>
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${colors.teal}`,
              color: colors.teal,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Edit
          </div>
        </div>
      </div>
    </div>
  );
};

export const MonitorsPage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });

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
        <BrowserFrame url="app.kaulby.com/dashboard/monitors" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Monitors">
            <div style={{ padding: "24px 28px", overflow: "hidden", height: "100%" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  opacity: headerOpacity,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: colors.foreground,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Monitors
                  </div>
                  <div style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                    Track keywords and topics across platforms.
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    backgroundColor: colors.teal,
                    color: colors.primaryForeground,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <PlusCircleIcon size={14} color={colors.primaryForeground} />
                  New Monitor
                </div>
              </div>

              {/* Monitor cards grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {monitors.map((monitor, index) => (
                  <MonitorCard
                    key={monitor.id}
                    monitor={monitor}
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

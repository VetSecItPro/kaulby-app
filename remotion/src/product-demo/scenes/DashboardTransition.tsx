import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, SMOOTH_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";

export const DashboardTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const layoutOpacity = springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING });
  const layoutScale = 0.92 + 0.08 * springAt({ frame, fps, startFrame: 0, config: SMOOTH_SPRING });

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
          transform: `scale(${layoutScale})`,
        }}
      >
        <BrowserFrame url="app.kaulby.com/dashboard" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Overview">
            <div
              style={{
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: colors.foreground,
                  letterSpacing: "-0.02em",
                }}
              >
                Welcome back, Alex
              </div>
              <div style={{ fontSize: 14, color: colors.mutedForeground }}>
                Here's what's happening across your monitors.
              </div>
              {/* Placeholder stat cards */}
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {[
                  { label: "Active Monitors", value: "3" },
                  { label: "New Results", value: "42" },
                  { label: "Avg. Sentiment", value: "72%" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1,
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.card,
                    }}
                  >
                    <div style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: colors.foreground }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

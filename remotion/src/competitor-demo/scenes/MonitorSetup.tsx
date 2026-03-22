import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING, BOUNCY_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";

const CheckIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const MonitorSetup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const formProgress = springAt({ frame, fps, startFrame: 10, config: SMOOTH_SPRING });

  const keywords = ["linear vs", "notion alternative", "monday complaints"];
  const platforms = [
    { name: "Reddit", checked: true },
    { name: "G2", checked: true },
    { name: "Hacker News", checked: true },
  ];

  // Keywords animate in one by one
  const keywordProgress = (index: number) =>
    staggeredSpring({ frame, fps, startFrame: 30, index, staggerDelay: 12, config: SMOOTH_SPRING });

  // Platforms animate in
  const platformProgress = (index: number) =>
    staggeredSpring({ frame, fps, startFrame: 70, index, staggerDelay: 8, config: SMOOTH_SPRING });

  // Button pulse
  const buttonProgress = springAt({ frame, fps, startFrame: 110, config: BOUNCY_SPRING });
  const buttonPulse = 1 + Math.sin((frame - 110) * 0.15) * 0.02 * (frame > 110 ? 1 : 0);

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
        <BrowserFrame url="app.kaulby.com/dashboard/monitors/new" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Monitors">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              {/* Header */}
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: colors.foreground,
                  letterSpacing: "-0.02em",
                  marginBottom: 20,
                  opacity: formProgress,
                }}
              >
                Create Monitor
              </div>

              {/* Form */}
              <div
                style={{
                  maxWidth: 520,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  opacity: formProgress,
                }}
              >
                {/* Monitor name */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: colors.mutedForeground, marginBottom: 6, display: "block" }}>
                    Monitor Name
                  </label>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.muted,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  >
                    Competitor Watch
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: colors.mutedForeground, marginBottom: 6, display: "block" }}>
                    Keywords
                  </label>
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.muted,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      minHeight: 42,
                    }}
                  >
                    {keywords.map((kw, i) => {
                      const p = keywordProgress(i);
                      return (
                        <span
                          key={kw}
                          style={{
                            opacity: p,
                            transform: `scale(${p})`,
                            padding: "4px 10px",
                            borderRadius: 9999,
                            backgroundColor: colors.primary,
                            color: colors.primaryForeground,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {kw}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: colors.mutedForeground, marginBottom: 6, display: "block" }}>
                    Platforms
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {platforms.map((platform, i) => {
                      const p = platformProgress(i);
                      return (
                        <div
                          key={platform.name}
                          style={{
                            opacity: p,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: `1px solid ${platform.checked ? colors.primary : colors.border}`,
                            backgroundColor: platform.checked ? `${colors.primary}11` : colors.muted,
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: `2px solid ${platform.checked ? colors.primary : colors.border}`,
                              backgroundColor: platform.checked ? colors.primary : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {platform.checked && <CheckIcon size={12} color={colors.primaryForeground} />}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: colors.foreground }}>{platform.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Create button */}
                <div
                  style={{
                    opacity: buttonProgress,
                    transform: `scale(${buttonPulse})`,
                    padding: "12px 24px",
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
                    color: colors.primaryForeground,
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                    boxShadow: `0 0 20px ${colors.tealGlow}`,
                    cursor: "pointer",
                  }}
                >
                  Create Monitor
                </div>
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

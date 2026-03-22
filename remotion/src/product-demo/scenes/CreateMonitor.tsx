import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { springAt, staggeredSpring, SMOOTH_SPRING, GENTLE_SPRING } from "../../shared/animations";
import { colors } from "../../shared/colors";
import { BrowserFrame } from "../../shared/BrowserFrame";
import { DashboardLayout } from "../../shared/DashboardLayout";
import { TypingAnimation } from "../../shared/TypingAnimation";
import { createMonitorForm, platformColors } from "../../data/mock-data";

const CheckIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const LockIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const TierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const styles: Record<string, React.CSSProperties> = {
    free: { backgroundColor: "hsl(0, 0%, 30%)", color: "white" },
    pro: { backgroundColor: colors.teal, color: colors.primaryForeground },
    team: { backgroundColor: "hsl(38, 92%, 50%)", color: "black" },
  };
  return (
    <span
      style={{
        padding: "1px 6px",
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 600,
        textTransform: "capitalize",
        ...styles[tier],
      }}
    >
      {tier}
    </span>
  );
};

export const CreateMonitor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardOpacity = springAt({ frame, fps, startFrame: 5, config: SMOOTH_SPRING });

  // Typing animations timing
  const companyTypeStart = 15;
  const companyTypeDuration = Math.ceil(createMonitorForm.companyName.length / 0.8);
  const monitorNameStart = companyTypeStart + companyTypeDuration + 10;
  const monitorNameDuration = Math.ceil(createMonitorForm.monitorName.length / 0.8);

  // Keywords appear after monitor name
  const keywordsStart = monitorNameStart + monitorNameDuration + 10;

  // Platform section appears after keywords
  const platformsStart = keywordsStart + createMonitorForm.keywords.length * 12 + 15;

  // Trustpilot checks at a specific frame
  const trustpilotCheckFrame = platformsStart + 50;

  // Create button appears last
  const createButtonStart = trustpilotCheckFrame + 20;

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
            <div
              style={{
                padding: "20px 24px",
                overflow: "hidden",
                height: "100%",
                opacity: cardOpacity,
              }}
            >
              {/* Card wrapper */}
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground }}>
                    Create a New Monitor
                  </div>
                </div>

                {/* Card content */}
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Company/Brand Name */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, marginBottom: 6, display: "block" }}>
                      Company / Brand Name
                    </label>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.background,
                        minHeight: 36,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <TypingAnimation
                        text={createMonitorForm.companyName}
                        startFrame={companyTypeStart}
                        fontSize={13}
                        charsPerFrame={0.8}
                      />
                    </div>
                  </div>

                  {/* Monitor Name */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, marginBottom: 6, display: "block" }}>
                      Monitor Name
                    </label>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.background,
                        minHeight: 36,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <TypingAnimation
                        text={createMonitorForm.monitorName}
                        startFrame={monitorNameStart}
                        fontSize={13}
                        charsPerFrame={0.8}
                      />
                    </div>
                  </div>

                  {/* Keywords */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, marginBottom: 6, display: "block" }}>
                      Keywords
                    </label>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.background,
                        minHeight: 36,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      {createMonitorForm.keywords.map((kw, i) => {
                        const kwProgress = springAt({
                          frame,
                          fps,
                          startFrame: keywordsStart + i * 12,
                          config: SMOOTH_SPRING,
                        });
                        if (kwProgress <= 0) return null;
                        return (
                          <span
                            key={kw}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 9999,
                              backgroundColor: colors.teal,
                              color: colors.primaryForeground,
                              fontSize: 12,
                              fontWeight: 500,
                              opacity: kwProgress,
                              transform: `scale(${kwProgress})`,
                            }}
                          >
                            {kw}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Platform Selection */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, marginBottom: 8, display: "block" }}>
                      Platforms
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {createMonitorForm.platforms.map((p, i) => {
                        const platProgress = staggeredSpring({
                          frame,
                          fps,
                          startFrame: platformsStart,
                          index: i,
                          staggerDelay: 6,
                          config: SMOOTH_SPRING,
                        });

                        const isLocked = "locked" in p && p.locked;
                        const isChecked =
                          p.checked || (p.name === "Trustpilot" && frame >= trustpilotCheckFrame);

                        // Trustpilot check animation
                        const checkScale =
                          p.name === "Trustpilot"
                            ? springAt({ frame, fps, startFrame: trustpilotCheckFrame, config: SMOOTH_SPRING })
                            : p.checked
                            ? 1
                            : 0;

                        return (
                          <div
                            key={p.name}
                            style={{
                              opacity: platProgress,
                              transform: `translateY(${(1 - platProgress) * 15}px)`,
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: `1px solid ${isChecked && !isLocked ? colors.teal : colors.border}`,
                              backgroundColor: isLocked
                                ? "hsla(0, 0%, 100%, 0.02)"
                                : isChecked
                                ? "hsla(172, 66%, 50%, 0.08)"
                                : colors.card,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {/* Checkbox */}
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 4,
                                    border: `2px solid ${isChecked && !isLocked ? colors.teal : colors.border}`,
                                    backgroundColor: isChecked && !isLocked ? colors.teal : "transparent",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {isChecked && !isLocked && checkScale > 0 && (
                                    <div style={{ transform: `scale(${p.name === "Trustpilot" ? checkScale : 1})` }}>
                                      <CheckIcon size={10} color={colors.primaryForeground} />
                                    </div>
                                  )}
                                  {isLocked && <LockIcon size={10} color={colors.mutedForeground} />}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: isLocked ? colors.mutedForeground : colors.foreground,
                                  }}
                                >
                                  {p.name}
                                </span>
                              </div>
                              <TierBadge tier={p.tier} />
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: colors.mutedForeground,
                                paddingLeft: 24,
                              }}
                            >
                              {p.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Create Monitor button */}
                  {(() => {
                    const btnProgress = springAt({ frame, fps, startFrame: createButtonStart, config: SMOOTH_SPRING });
                    return (
                      <div
                        style={{
                          opacity: btnProgress,
                          transform: `translateY(${(1 - btnProgress) * 10}px)`,
                          display: "flex",
                          justifyContent: "flex-end",
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 28px",
                            borderRadius: 8,
                            backgroundColor: colors.teal,
                            color: colors.primaryForeground,
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Create Monitor
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

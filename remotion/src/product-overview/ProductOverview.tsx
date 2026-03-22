import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors } from "../shared/colors";
import { BrowserFrame } from "../shared/BrowserFrame";
import { DashboardLayout } from "../shared/DashboardLayout";
import { AnimatedCursor } from "../shared/AnimatedCursor";

// ============================================================================
// Helpers
// ============================================================================

const springAt = (frame: number, fps: number, startFrame: number, config?: object) =>
  spring({ frame: Math.max(0, frame - startFrame), fps, config: { damping: 15, stiffness: 120, ...config } });

const stagger = (frame: number, fps: number, start: number, index: number, delay = 6) =>
  springAt(frame, fps, start + index * delay);

// ============================================================================
// SCENE 1: Create a Monitor (0-240 frames = 8s)
// Cursor types monitor name, keywords appear, platforms get checked, button clicks
// ============================================================================
const CreateMonitorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerP = springAt(frame, fps, 3);

  // Typing animation for monitor name
  const monitorName = "Acme Brand Monitor";
  const nameChars = Math.min(Math.floor(Math.max(0, frame - 20) * 0.8), monitorName.length);
  const typedName = monitorName.slice(0, nameChars);
  const showCursor = frame > 20 && frame < 55 && Math.floor(frame / 6) % 2 === 0;

  // Keywords appear one by one
  const keywords = ["acme app", "acme review", "acme alternative", "acme vs"];
  const keywordStarts = [60, 72, 84, 96];

  // Platforms check one by one
  const platforms = [
    { name: "Reddit", color: "hsl(16, 100%, 50%)" },
    { name: "Hacker News", color: "hsl(24, 100%, 50%)" },
    { name: "Google Reviews", color: "hsl(44, 100%, 48%)" },
    { name: "Trustpilot", color: "hsl(142, 71%, 45%)" },
    { name: "Product Hunt", color: "hsl(14, 72%, 52%)" },
  ];
  const platformCheckStarts = [115, 128, 141, 154, 167];

  // Button glow after platforms selected
  const buttonP = springAt(frame, fps, 185);
  const buttonClick = frame > 210 && frame < 220;
  const buttonScale = buttonClick ? 0.95 : 1;

  // Success flash after click
  const successP = frame > 220 ? springAt(frame, fps, 220) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BrowserFrame url="app.kaulby.com/dashboard/monitors/new" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Monitors">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground, marginBottom: 20, opacity: headerP }}>
                Create Monitor
              </div>

              {/* Monitor Name Input */}
              <div style={{ marginBottom: 16, opacity: springAt(frame, fps, 10) }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: colors.mutedForeground, marginBottom: 6 }}>Monitor Name</div>
                <div style={{
                  padding: "10px 14px", borderRadius: 8, border: `1px solid ${frame > 20 ? colors.primary : colors.border}`,
                  backgroundColor: colors.card, fontSize: 14, color: colors.foreground, minHeight: 20,
                }}>
                  {typedName}{showCursor ? "│" : ""}
                </div>
              </div>

              {/* Keywords */}
              <div style={{ marginBottom: 16, opacity: springAt(frame, fps, 55) }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: colors.mutedForeground, marginBottom: 6 }}>Keywords</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {keywords.map((kw, i) => {
                    const p = springAt(frame, fps, keywordStarts[i]);
                    return (
                      <span key={kw} style={{
                        opacity: p, transform: `scale(${0.5 + p * 0.5})`,
                        padding: "4px 10px", borderRadius: 9999,
                        backgroundColor: colors.primary, color: colors.primaryForeground,
                        fontSize: 11, fontWeight: 500,
                      }}>
                        {kw}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Platforms */}
              <div style={{ marginBottom: 16, opacity: springAt(frame, fps, 108) }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: colors.mutedForeground, marginBottom: 6 }}>Platforms</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {platforms.map((pl, i) => {
                    const checked = frame > platformCheckStarts[i] + 8;
                    const checkP = springAt(frame, fps, platformCheckStarts[i]);
                    return (
                      <div key={pl.name} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 12px", borderRadius: 8,
                        border: `1px solid ${checked ? colors.primary : colors.border}`,
                        backgroundColor: checked ? `hsla(172, 66%, 50%, 0.08)` : colors.card,
                        opacity: 0.6 + checkP * 0.4,
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4,
                          border: `2px solid ${checked ? colors.primary : colors.border}`,
                          backgroundColor: checked ? colors.primary : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transform: `scale(${checked ? 1 : 0.8})`,
                          transition: "all 0.2s",
                        }}>
                          {checked && (
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: checked ? colors.foreground : colors.mutedForeground }}>{pl.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: 9, color: pl.color }}>●</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Create Button */}
              <div style={{
                opacity: buttonP, padding: "10px 24px", borderRadius: 8,
                background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
                color: colors.primaryForeground, fontSize: 14, fontWeight: 600,
                textAlign: "center",
                transform: `scale(${buttonScale})`,
                boxShadow: buttonP > 0.5 ? `0 0 ${20 + successP * 20}px ${colors.tealGlow}` : "none",
              }}>
                {successP > 0.5 ? "✓ Monitor Created!" : "Create Monitor"}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>

      {/* Animated cursor */}
      <AnimatedCursor keyframes={[
        { frame: 0, x: 640, y: 360 },
        { frame: 18, x: 520, y: 168, click: true },  // Click name input
        { frame: 55, x: 420, y: 230 },                // Move to keywords area
        { frame: 100, x: 450, y: 300 },               // Move to platforms
        { frame: 115, x: 350, y: 308, click: true },  // Check Reddit
        { frame: 128, x: 350, y: 333, click: true },  // Check HN
        { frame: 141, x: 350, y: 358, click: true },  // Check Google Reviews
        { frame: 154, x: 350, y: 383, click: true },  // Check Trustpilot
        { frame: 167, x: 350, y: 408, click: true },  // Check Product Hunt
        { frame: 190, x: 460, y: 460 },               // Move to button
        { frame: 210, x: 460, y: 460, click: true },  // Click Create
        { frame: 240, x: 460, y: 460 },               // Hold
      ]} />
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 2: Monitors List (240-390 = 5s)
// Cards animate in staggered, cursor hovers over them
// ============================================================================
const MonitorsListScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const monitors = [
    { name: "Acme Brand Monitor", keywords: "acme app, acme review", platforms: ["Reddit", "HN", "Trustpilot", "G2"], refreshed: "Just now", count: "14 new", isNew: true },
    { name: "Competitor Watch", keywords: "linear vs, notion alternative", platforms: ["Reddit", "Product Hunt", "G2"], refreshed: "2h ago", count: "7 new", isNew: false },
    { name: "Industry Pain Points", keywords: "social listening tool, monitor brand", platforms: ["Reddit", "HN", "Google Reviews"], refreshed: "1h ago", count: "5 new", isNew: false },
  ];

  const platformColors: Record<string, string> = {
    Reddit: "hsl(16, 100%, 50%)", HN: "hsl(24, 100%, 50%)", Trustpilot: "hsl(142, 71%, 45%)",
    G2: "hsl(24, 100%, 40%)", "Product Hunt": "hsl(14, 72%, 52%)", "Google Reviews": "hsl(44, 100%, 48%)",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BrowserFrame url="app.kaulby.com/dashboard/monitors" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Monitors">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, opacity: springAt(frame, fps, 3) }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground }}>Monitors</div>
                <div style={{ padding: "6px 14px", borderRadius: 8, backgroundColor: colors.primary, color: colors.primaryForeground, fontSize: 12, fontWeight: 600 }}>+ Create Monitor</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {monitors.map((mon, i) => {
                  const p = stagger(frame, fps, 10, i, 12);
                  return (
                    <div key={mon.name} style={{
                      opacity: p, transform: `translateY(${(1 - p) * 20}px)`,
                      borderRadius: 12, border: `1px solid ${mon.isNew ? colors.primary : colors.border}`,
                      backgroundColor: colors.card, padding: "14px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: colors.foreground }}>{mon.name}</span>
                          {mon.isNew && <span style={{ padding: "1px 6px", borderRadius: 9999, backgroundColor: colors.primary, color: colors.primaryForeground, fontSize: 9, fontWeight: 600 }}>New</span>}
                        </div>
                        <span style={{ padding: "2px 8px", borderRadius: 9999, backgroundColor: colors.primary, color: colors.primaryForeground, fontSize: 10, fontWeight: 600 }}>Active</span>
                      </div>
                      <div style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 8 }}>{mon.keywords}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {mon.platforms.map(pl => (
                            <span key={pl} style={{ padding: "1px 6px", borderRadius: 9999, backgroundColor: platformColors[pl] || colors.muted, color: "white", fontSize: 9, fontWeight: 500 }}>{pl}</span>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, color: colors.mutedForeground }}>{mon.refreshed}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 9999, backgroundColor: `${colors.primary}22`, color: colors.primary, fontSize: 10, fontWeight: 600 }}>{mon.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>

      <AnimatedCursor keyframes={[
        { frame: 0, x: 200, y: 135 },
        { frame: 20, x: 450, y: 180 },    // Hover first monitor
        { frame: 60, x: 450, y: 270 },    // Hover second
        { frame: 100, x: 450, y: 360 },   // Hover third
        { frame: 130, x: 180, y: 225, click: true }, // Click Results nav
      ]} />
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 3: Results Feed (390-600 = 7s)
// Results cards stagger in, cursor scrolls through them
// ============================================================================
const ResultsFeedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const results = [
    { platform: "Reddit", platformColor: "hsl(16, 100%, 50%)", title: "Best tool for monitoring brand mentions across Reddit?", category: "Buying Signal", catColor: "hsl(142, 71%, 45%)", leadScore: 82, leadLabel: "Hot", sentiment: "positive", author: "u/sass_founder_22", date: "2h ago" },
    { platform: "Trustpilot", platformColor: "hsl(142, 71%, 45%)", title: "Great tool but pricing is confusing - 3 stars", category: "Pain Point", catColor: "hsl(0, 84%, 60%)", leadScore: 35, leadLabel: "Cold", sentiment: "negative", author: "Sarah M.", date: "5h ago" },
    { platform: "Hacker News", platformColor: "hsl(24, 100%, 50%)", title: "Show HN: I built an open-source alternative to Mention.com", category: "Competitor", catColor: "hsl(210, 80%, 55%)", leadScore: 45, leadLabel: "Warm", sentiment: "neutral", author: "techbuilder", date: "8h ago" },
    { platform: "G2", platformColor: "hsl(24, 100%, 40%)", title: "Best social listening tool for small teams - detailed comparison", category: "Buying Signal", catColor: "hsl(142, 71%, 45%)", leadScore: 91, leadLabel: "Hot", sentiment: "positive", author: "verified_reviewer", date: "12h ago" },
    { platform: "YouTube", platformColor: "hsl(0, 100%, 50%)", title: "Honest review after 6 months — is it worth $29/mo?", category: "Review", catColor: "hsl(270, 60%, 55%)", leadScore: 55, leadLabel: "Warm", sentiment: "positive", author: "TechReviewer", date: "1d ago" },
  ];

  const sentimentDot = (s: string) => s === "positive" ? colors.positive : s === "negative" ? colors.negative : colors.mutedForeground;
  const leadColor = (l: string) => l === "Hot" ? "hsl(16, 100%, 50%)" : l === "Warm" ? "hsl(38, 92%, 50%)" : colors.mutedForeground;

  // Scroll offset animation
  const scrollOffset = frame > 90 ? interpolate(frame, [90, 130], [0, -80], { extrapolateRight: "clamp" }) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BrowserFrame url="app.kaulby.com/dashboard/results" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Results">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              {/* Header + filter tabs */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, opacity: springAt(frame, fps, 3) }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground }}>Results</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ l: "All", c: "42", active: true }, { l: "Unread", c: "8", active: false }, { l: "Saved", c: "3", active: false }].map(t => (
                    <span key={t.l} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: t.active ? 600 : 400, backgroundColor: t.active ? "hsla(0,0%,100%,0.1)" : "transparent", border: `1px solid ${t.active ? colors.border : "transparent"}`, color: t.active ? colors.foreground : colors.mutedForeground }}>
                      {t.l} <span style={{ fontSize: 9, opacity: 0.7 }}>{t.c}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Results list with scroll */}
              <div style={{ transform: `translateY(${scrollOffset}px)`, display: "flex", flexDirection: "column", gap: 7 }}>
                {results.map((r, i) => {
                  const p = stagger(frame, fps, 8, i, 8);
                  return (
                    <div key={r.title} style={{
                      opacity: p, transform: `translateX(${(1 - p) * 30}px)`,
                      borderRadius: 10, border: `1px solid ${colors.border}`,
                      backgroundColor: colors.card, padding: "10px 12px",
                      borderLeft: i < 2 ? `3px solid ${colors.primary}` : undefined,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ padding: "1px 7px", borderRadius: 9999, border: `1px solid ${r.platformColor}`, color: r.platformColor, fontSize: 10, fontWeight: 500 }}>{r.platform}</span>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: sentimentDot(r.sentiment) }} />
                        <span style={{ padding: "1px 6px", borderRadius: 9999, backgroundColor: `${r.catColor}22`, color: r.catColor, fontSize: 9, fontWeight: 500 }}>{r.category}</span>
                        <span style={{ padding: "1px 6px", borderRadius: 9999, backgroundColor: `${leadColor(r.leadLabel)}22`, color: leadColor(r.leadLabel), fontSize: 9, fontWeight: 600, marginLeft: "auto" }}>{r.leadLabel} {r.leadScore}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, lineHeight: 1.3 }}>{r.title}</div>
                      <div style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 3 }}>{r.author} · {r.date}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>

      <AnimatedCursor keyframes={[
        { frame: 0, x: 450, y: 160 },
        { frame: 30, x: 500, y: 200 },    // First result
        { frame: 60, x: 500, y: 270 },    // Second result
        { frame: 90, x: 500, y: 350 },    // Third — triggers scroll
        { frame: 140, x: 500, y: 320 },   // After scroll
        { frame: 170, x: 180, y: 260, click: true }, // Click Insights
      ]} />
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 4: Insights — 3 Tab Toggle (600-840 = 8s)
// Shows segmented control, switches between Pain Points → Recommendations → Trending
// ============================================================================
const InsightsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tab switching timeline
  const activeTab = frame < 80 ? 0 : frame < 160 ? 1 : 2; // Pain Points → Recs → Trending
  const tabs = ["Pain Points", "Recommendations", "Trending Topics"];

  const headerP = springAt(frame, fps, 3);
  const tabsP = springAt(frame, fps, 8);

  // Tab switch animations
  const tab1Enter = springAt(frame, fps, 15);
  const tab2Enter = frame > 80 ? springAt(frame, fps, 85) : 0;
  const tab3Enter = frame > 160 ? springAt(frame, fps, 165) : 0;

  const painPoints = [
    { label: "Negative Experiences", count: 14, severity: 85, color: "hsl(0, 84%, 60%)", trend: "rising" },
    { label: "Support Needs", count: 9, severity: 72, color: "hsl(24, 100%, 50%)", trend: "stable" },
    { label: "Pricing Concerns", count: 8, severity: 60, color: "hsl(45, 93%, 47%)", trend: "rising" },
    { label: "Competitor Mentions", count: 12, severity: 55, color: "hsl(210, 80%, 55%)", trend: "stable" },
  ];

  const recs = [
    { title: "Reduce Support Response Time", priority: "Critical", priorityColor: "hsl(0, 84%, 60%)", effort: "Quick Win" },
    { title: "Simplify Pricing Page", priority: "High", priorityColor: "hsl(24, 100%, 50%)", effort: "Moderate" },
    { title: "Create Onboarding Video Series", priority: "Medium", priorityColor: "hsl(45, 93%, 47%)", effort: "Quick Win" },
  ];

  const trending = [
    { topic: "AI-powered monitoring", mentions: 28, trend: "rising", positive: 65 },
    { topic: "Review management tools", mentions: 19, trend: "rising", positive: 40 },
    { topic: "Brand reputation crisis", mentions: 12, trend: "rising", positive: 15 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BrowserFrame url="app.kaulby.com/dashboard/insights" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Insights">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground, marginBottom: 14, opacity: headerP }}>Insights</div>

              {/* 3-Tab Segmented Control */}
              <div style={{ display: "flex", marginBottom: 16, backgroundColor: colors.muted, borderRadius: 8, padding: 3, opacity: tabsP }}>
                {tabs.map((tab, i) => (
                  <div key={tab} style={{
                    flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 11, fontWeight: i === activeTab ? 600 : 400,
                    backgroundColor: i === activeTab ? colors.card : "transparent",
                    color: i === activeTab ? colors.foreground : colors.mutedForeground,
                    boxShadow: i === activeTab ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                    textAlign: "center", transition: "all 0.2s",
                  }}>
                    {tab}
                  </div>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {painPoints.map((pp, i) => {
                    const p = stagger(frame, fps, 20, i, 8);
                    const barWidth = interpolate(frame, [25 + i * 8, 50 + i * 8], [0, pp.severity], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                    return (
                      <div key={pp.label} style={{
                        opacity: p, transform: `translateY(${(1 - p) * 15}px)`,
                        borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground }}>{pp.label}</span>
                          <span style={{ fontSize: 10, color: colors.mutedForeground }}>{pp.count} mentions</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: `${pp.color}22` }}>
                            <div style={{ width: `${barWidth}%`, height: "100%", borderRadius: 3, backgroundColor: pp.color, transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: pp.color }}>{pp.severity}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recs.map((rec, i) => {
                    const p = stagger(frame - 80, fps, 10, i, 10);
                    return (
                      <div key={rec.title} style={{
                        opacity: p, transform: `translateY(${(1 - p) * 15}px)`,
                        borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground }}>{rec.title}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 9999, backgroundColor: rec.priorityColor, color: "white", fontSize: 9, fontWeight: 600 }}>{rec.priority}</span>
                        </div>
                        <span style={{ padding: "2px 6px", borderRadius: 9999, border: `1px solid ${colors.border}`, fontSize: 9, color: colors.mutedForeground }}>{rec.effort}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {trending.map((t, i) => {
                    const p = stagger(frame - 160, fps, 10, i, 10);
                    const barW = interpolate(frame - 160, [15 + i * 10, 40 + i * 10], [0, t.positive], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                    return (
                      <div key={t.topic} style={{
                        opacity: p, transform: `translateY(${(1 - p) * 15}px)`,
                        borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground }}>{t.topic}</span>
                          <span style={{ fontSize: 10, color: colors.mutedForeground }}>{t.mentions} results</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, backgroundColor: "hsla(0,0%,100%,0.1)" }}>
                          <div style={{ width: `${barW}%`, height: "100%", borderRadius: 3, background: `linear-gradient(to right, ${colors.positive}, ${colors.negative})` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>

      <AnimatedCursor keyframes={[
        { frame: 0, x: 450, y: 200 },
        { frame: 40, x: 450, y: 280 },     // Hover pain points
        { frame: 70, x: 550, y: 112, click: true },  // Click Recommendations tab
        { frame: 120, x: 450, y: 240 },    // Hover recs
        { frame: 150, x: 700, y: 112, click: true }, // Click Trending tab
        { frame: 200, x: 450, y: 240 },    // Hover trending
        { frame: 230, x: 180, y: 290, click: true }, // Click Analytics nav
      ]} />
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 5: Analytics (840-900 = 2s)
// Charts animate in
// ============================================================================
const AnalyticsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const days = [
    { day: "Mon", value: 18 }, { day: "Tue", value: 24 }, { day: "Wed", value: 22 },
    { day: "Thu", value: 42 }, { day: "Fri", value: 38 }, { day: "Sat", value: 16 }, { day: "Sun", value: 12 },
  ];
  const maxV = 42;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BrowserFrame url="app.kaulby.com/dashboard/analytics" style={{ width: "100%", height: "100%" }}>
          <DashboardLayout activeNav="Analytics">
            <div style={{ padding: "20px 24px", overflow: "hidden", height: "100%" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.foreground, marginBottom: 16, opacity: springAt(frame, fps, 3) }}>Analytics</div>

              {/* Bar chart */}
              <div style={{ borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: "14px 16px", opacity: springAt(frame, fps, 8) }}>
                <div style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 10 }}>Mention Volume (7d)</div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 120 }}>
                  {days.map((d, i) => {
                    const barH = stagger(frame, fps, 15, i, 4) * (d.value / maxV) * 100;
                    return (
                      <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                        <span style={{ fontSize: 9, color: colors.foreground, opacity: barH > 50 ? 1 : 0 }}>{d.value}</span>
                        <div style={{ width: "100%", borderRadius: "4px 4px 0 0", height: `${barH}%`, minHeight: 4, background: `linear-gradient(to top, ${colors.teal}, hsl(158, 64%, 52%))` }} />
                        <span style={{ fontSize: 9, color: colors.mutedForeground }}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sentiment row */}
              <div style={{ display: "flex", gap: 10, marginTop: 10, opacity: springAt(frame, fps, 25) }}>
                <div style={{ flex: 1, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>Sentiment</div>
                  <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: 8 }}>
                    <div style={{ width: "52%", backgroundColor: colors.positive }} />
                    <div style={{ width: "28%", backgroundColor: colors.negative }} />
                    <div style={{ width: "20%", backgroundColor: colors.mutedForeground }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: colors.positive }}>52% pos</span>
                    <span style={{ fontSize: 9, color: colors.negative }}>28% neg</span>
                  </div>
                </div>
                <div style={{ flex: 1, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>Top Platform</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(16, 100%, 50%)" }}>Reddit</div>
                  <div style={{ fontSize: 9, color: colors.mutedForeground }}>38 mentions (30%)</div>
                </div>
              </div>
            </div>
          </DashboardLayout>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// Main Composition — 900 frames = 30s at 30fps
// ============================================================================
export const ProductOverview: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sequence from={0} durationInFrames={240} name="Create Monitor">
        <CreateMonitorScene />
      </Sequence>

      <Sequence from={240} durationInFrames={150} name="Monitors List">
        <MonitorsListScene />
      </Sequence>

      <Sequence from={390} durationInFrames={210} name="Results Feed">
        <ResultsFeedScene />
      </Sequence>

      <Sequence from={600} durationInFrames={240} name="Insights 3-Tab">
        <InsightsScene />
      </Sequence>

      <Sequence from={840} durationInFrames={60} name="Analytics">
        <AnalyticsScene />
      </Sequence>
    </AbsoluteFill>
  );
};

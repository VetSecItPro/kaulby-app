import React from "react";
import { Img, staticFile } from "remotion";
import { colors } from "./colors";
import { sidebarNavItems } from "../data/mock-data";

// SVG icon paths for sidebar nav items (simplified Lucide-style)
const navIconPaths: Record<string, string> = {
  layout:
    "M3 3h7v9H3V3zm0 11h7v7H3v-7zm9-11h9v7h-9V3zm0 9h9v9h-9v-9z",
  radio:
    "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4.93 19.07A10 10 0 0 1 2 12C2 6.48 6.48 2 12 2s10 4.48 10 10a10 10 0 0 1-2.93 7.07M7.76 16.24A6 6 0 0 1 6 12a6 6 0 0 1 6-6 6 6 0 0 1 6 6 6 6 0 0 1-1.76 4.24",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0a3 3 0 1 0 0-6M22 21v-2a4 4 0 0 0-3-3.87",
  list:
    "M3 6h18M3 12h18M3 18h18",
  bookmark:
    "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  chart:
    "M18 20V10M12 20V4M6 20v-6",
  sparkles:
    "M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z",
  bot:
    "M12 8V4H8M12 4h4M6 12a6 6 0 0 0 12 0M9 16h0M15 16h0M12 2a2 2 0 0 1 2 2",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.65.77 1.1 1.45 1.13H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  help:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14a3 3 0 0 1 2.12 5.12L12 15m0 3h.01",
};

const NavIcon: React.FC<{ icon: string; size?: number; color?: string }> = ({
  icon,
  size = 16,
  color = "currentColor",
}) => {
  const d = navIconPaths[icon];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
};

export const DashboardLayout: React.FC<{
  children: React.ReactNode;
  activeNav: string;
  sidebarOpacity?: number;
}> = ({ children, activeNav, sidebarOpacity = 1 }) => {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: colors.background,
      }}
    >
      {/* Sidebar - 264px, bg-muted/40, border-r */}
      <div
        style={{
          width: 264,
          minWidth: 264,
          height: "100%",
          backgroundColor: "hsla(0, 0%, 10%, 0.4)",
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "16px 12px",
          opacity: sidebarOpacity,
        }}
      >
        {/* Logo + brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 8px",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <Img
              src={staticFile("icon-512.png")}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.primary}, hsl(158, 64%, 52%))`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Kaulby
          </span>
        </div>

        {/* Pro badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              padding: "2px 8px",
              borderRadius: 9999,
              backgroundColor: colors.teal,
              color: colors.primaryForeground,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Pro
          </div>
        </div>

        {/* User avatar + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            marginBottom: 12,
            borderRadius: 8,
            backgroundColor: "hsla(0, 0%, 100%, 0.04)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${colors.primary}, hsl(210, 80%, 55%))`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "white",
              flexShrink: 0,
            }}
          >
            AC
          </div>
          <span
            style={{
              fontSize: 13,
              color: colors.foreground,
              fontWeight: 500,
            }}
          >
            Alex Chen
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sidebarNavItems.map((item) => {
            const isActive = item.label === activeNav;
            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 12px",
                  borderRadius: 9999,
                  backgroundColor: isActive
                    ? colors.primary
                    : "transparent",
                  color: isActive
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                <NavIcon
                  icon={item.icon}
                  size={16}
                  color={
                    isActive
                      ? colors.primaryForeground
                      : colors.mutedForeground
                  }
                />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          height: "100%",
          overflow: "hidden",
          backgroundColor: colors.background,
        }}
      >
        {children}
      </div>
    </div>
  );
};

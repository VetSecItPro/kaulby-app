import React from "react";
import { colors } from "./colors";

export const BrowserFrame: React.FC<{
  children: React.ReactNode;
  url?: string;
  style?: React.CSSProperties;
}> = ({ children, url = "app.kaulby.com/dashboard", style }) => {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          backgroundColor: colors.muted,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.7)",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "rgba(234, 179, 8, 0.7)",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "rgba(34, 197, 94, 0.7)",
            }}
          />
        </div>
        <div style={{ flex: 1 }} />
      </div>
      {/* Content */}
      <div style={{ backgroundColor: colors.background }}>{children}</div>
    </div>
  );
};

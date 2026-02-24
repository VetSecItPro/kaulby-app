import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kaulby - AI-Powered Community Monitoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0e1a 0%, #1a1f3a 50%, #0a0e1a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Gradient accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
          }}
        />

        {/* Logo / Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: "white",
            }}
          >
            K
          </div>
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "white",
              letterSpacing: -1,
            }}
          >
            Kaulby
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#a5b4fc",
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          AI-Powered Community Monitoring
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 20,
            color: "#94a3b8",
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Track 17 platforms. Detect pain points. Score leads. Ship faster.
        </div>

        {/* Platform pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["Reddit", "Hacker News", "Product Hunt", "G2", "YouTube", "+12 more"].map(
            (platform) => (
              <div
                key={platform}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  color: "#c7d2fe",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {platform}
              </div>
            )
          )}
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            fontSize: 16,
            color: "#64748b",
          }}
        >
          kaulbyapp.com
        </div>
      </div>
    ),
    { ...size }
  );
}

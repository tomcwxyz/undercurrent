import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Swells — Sense what's shifting before it becomes obvious";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px 100px",
          background: "linear-gradient(145deg, #0A0E1A 0%, #0F1628 50%, #0A0E1A 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient orbs */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -40,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(78,205,196,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -40,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(108,92,231,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Wave SVG */}
        <svg
          viewBox="0 0 1200 200"
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            width: 550,
            height: 130,
            opacity: 0.25,
          }}
        >
          <defs>
            <linearGradient id="wg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4ecdc4" />
              <stop offset="100%" stopColor="#45b7d1" />
            </linearGradient>
          </defs>
          <path
            d="M0 120c120-80 240-80 360 0s240 80 360 0 240-80 360 0"
            fill="none"
            stroke="url(#wg)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M0 80c120-80 240-80 360 0s240 80 360 0 240-80 360 0"
            fill="none"
            stroke="url(#wg)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.4"
          />
        </svg>

        {/* Brand name */}
        <div
          style={{
            fontSize: 88,
            fontStyle: "italic",
            fontWeight: 300,
            color: "#4ecdc4",
            lineHeight: 1,
          }}
        >
          swells
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 500,
            color: "rgba(255,255,255,0.9)",
            marginTop: 28,
            lineHeight: 1.3,
            maxWidth: 700,
          }}
        >
          Sense what&apos;s shifting before it becomes obvious
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: "rgba(255,255,255,0.45)",
            marginTop: 20,
            maxWidth: 600,
            lineHeight: 1.5,
          }}
        >
          Observations, signals, and reflections — AI-powered pattern detection
          for teams and individuals.
        </div>

        {/* CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 36,
            padding: "12px 28px",
            borderRadius: 8,
            background: "rgba(78,205,196,0.12)",
            border: "1px solid rgba(78,205,196,0.3)",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "#4ecdc4",
            }}
          >
            Start free at swells.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

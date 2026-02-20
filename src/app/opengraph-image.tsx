import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Swells — Sense what's shifting";
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
          background: "#0A0E1A",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient orbs */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(78,205,196,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,107,74,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Wave SVG */}
        <svg
          viewBox="0 0 1200 200"
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            width: 500,
            height: 120,
            opacity: 0.3,
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
            fontSize: 96,
            fontStyle: "italic",
            fontWeight: 300,
            background: "linear-gradient(to right, #4ecdc4, #45b7d1)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1,
          }}
        >
          swells
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 300,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.6)",
            marginTop: 24,
          }}
        >
          Sense what&apos;s shifting
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: "rgba(255,255,255,0.4)",
            marginTop: 20,
            maxWidth: 600,
            lineHeight: 1.5,
          }}
        >
          A platform for observations, signals, and reflections — helping people
          sense what&apos;s emerging before it becomes obvious.
        </div>
      </div>
    ),
    { ...size }
  );
}

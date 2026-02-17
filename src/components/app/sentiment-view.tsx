"use client";

import { useMemo } from "react";

const WARM_COLORS = [
  "rgba(108, 92, 231, 0.3)",  // cool/reflective
  "rgba(69, 183, 209, 0.4)",  // uncertain
  "rgba(78, 205, 196, 0.4)",  // calm
  "rgba(255, 209, 102, 0.4)", // warm
  "rgba(255, 140, 66, 0.5)",  // energised
  "rgba(255, 107, 74, 0.6)",  // urgent/hot
];

const SENTIMENT_LABELS = [
  "Quiet",
  "Reflective",
  "Calm",
  "Warm",
  "Energised",
  "Urgent",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const THEMES = [
  {
    gradient: "linear-gradient(90deg, var(--color-warm-1), var(--color-warm-2))",
    title: "What\u2019s running hot",
    text: "Observations about power, decision-making, and strategy carry the most energy right now. People feel strongly that things need to change.",
  },
  {
    gradient: "linear-gradient(90deg, var(--color-warm-3), var(--color-cool-1))",
    title: "Where energy is building",
    text: "Community engagement and grassroots activity. Warm but not urgent \u2014 a slow build of positive momentum that feels organic and unforced.",
  },
  {
    gradient: "linear-gradient(90deg, var(--color-cool-2), var(--color-cool-3))",
    title: "Cool and uncertain",
    text: "Internal processes and formal structures. People observe these with detachment or mild frustration. Not crisis \u2014 more like quiet questioning.",
  },
] as const;

const SENTIMENT_BAR = [
  { pct: 28, color: "var(--color-warm-1)", opacity: 0.8 },
  { pct: 22, color: "var(--color-warm-3)", opacity: 0.7 },
  { pct: 30, color: "var(--color-cool-1)", opacity: 0.6 },
  { pct: 12, color: "var(--color-cool-2)", opacity: 0.7 },
  { pct: 8, color: "var(--color-cool-3)", opacity: 0.6 },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export function SentimentView() {
  const cells = useMemo(() => {
    const result: { color: string; label: string; count: number }[] = [];
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        let idx = Math.floor(seededRandom(w * 7 + d + 42) * WARM_COLORS.length);
        if (w >= 2) idx = Math.min(idx + 1, WARM_COLORS.length - 1);
        if (w >= 3 && d < 5) idx = Math.min(idx + 1, WARM_COLORS.length - 1);
        if (d >= 5) idx = Math.max(0, idx - 2);

        const count =
          Math.floor(seededRandom(w * 7 + d + 99) * 6) + (d < 5 ? 2 : 0);
        result.push({
          color: WARM_COLORS[idx],
          label: SENTIMENT_LABELS[idx],
          count,
        });
      }
    }
    return result;
  }, []);

  return (
    <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light">
          The temperature of things
        </h2>
        <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
          Sentiment flowing through observations over time. Warm means energy,
          excitement, urgency. Cool means calm, reflective, uncertain. Neither
          is better.
        </p>
      </div>

      {/* Heat grid — horizontal scroll on mobile */}
      <div className="mx-auto max-w-[800px] overflow-x-auto">
        <div className="mb-2 grid min-w-[480px] grid-cols-7 gap-1">
          {cells.map((cell, i) => (
            <div
              key={i}
              className="group relative aspect-square cursor-pointer rounded-[6px] transition-all hover:z-10 hover:scale-[1.15] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              style={{ background: cell.color }}
            >
              <div
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary opacity-0 backdrop-blur-2xl transition-opacity group-hover:opacity-100"
                style={{ background: "rgba(20, 27, 45, 0.95)" }}
              >
                {cell.label} &middot; {cell.count} observations
              </div>
            </div>
          ))}
        </div>

        {/* Day labels */}
        <div className="mb-10 grid min-w-[480px] grid-cols-7 gap-1 text-center text-[0.68rem] text-text-muted">
          {DAY_LABELS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>

      {/* Sentiment bar */}
      <div className="mx-auto mb-10 max-w-[800px]">
        <div className="mb-2 flex justify-between text-[0.72rem] text-text-muted">
          <span>Overall sentiment this month</span>
          <span>147 observations</span>
        </div>
        <div className="flex h-6 overflow-hidden rounded-xl bg-white/[0.04]">
          {SENTIMENT_BAR.map((seg, i) => (
            <div
              key={i}
              className="h-full transition-all duration-1000"
              style={{
                width: `${seg.pct}%`,
                background: seg.color,
                opacity: seg.opacity,
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[0.72rem]">
          <span className="text-warm-1">Energised &middot; Urgent</span>
          <span className="text-cool-3">Uncertain &middot; Reflective</span>
        </div>
      </div>

      {/* Themed insights */}
      <div className="mx-auto grid max-w-[800px] gap-4 sm:grid-cols-3">
        {THEMES.map((theme) => (
          <div
            key={theme.title}
            className="rounded-[14px] border border-white/[0.04] bg-card p-5"
          >
            <div
              className="mb-3 h-[3px] w-8 rounded-sm"
              style={{ background: theme.gradient }}
            />
            <h4 className="font-display text-[1.05rem] font-normal">
              {theme.title}
            </h4>
            <p className="mt-2 text-[0.8rem] leading-relaxed text-text-secondary">
              {theme.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

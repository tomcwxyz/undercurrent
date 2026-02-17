"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SIGNAL_COLORS } from "@/lib/mock-data";
import type { SignalView } from "@/lib/types";

const DIRECTION_LABELS = {
  strengthening: { label: "↑ Strengthening", cls: "bg-cool-1/12 text-cool-1" },
  steady: { label: "→ Steady", cls: "bg-warm-3/12 text-warm-3" },
  new: { label: "✦ New", cls: "bg-cool-3/12 text-cool-3" },
} as const;

interface LandscapeViewProps {
  signals: SignalView[];
}

export function LandscapeView({ signals }: LandscapeViewProps) {
  return (
    <div className="max-h-[calc(100svh-72px)] overflow-y-auto px-6 py-10 md:px-8">
      <div className="mb-10 text-center">
        <h2 className="font-display text-[2.2rem] font-light">
          Signal landscape
        </h2>
        <p className="mx-auto mt-2 max-w-[500px] text-[0.9rem] leading-relaxed text-text-secondary">
          The terrain of what your organisation is sensing. Peaks form where
          observations converge into meaning.
        </p>
      </div>

      <TerrainCanvas />

      <div className="mx-auto mt-8 grid max-w-[1100px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map((signal) => {
          const color = SIGNAL_COLORS[signal.strength];
          const dir = DIRECTION_LABELS[signal.direction];
          const pct =
            signal.strength === "strong"
              ? 85
              : signal.strength === "emerging"
                ? 60
                : 30;

          return (
            <div
              key={signal.id}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[0.04] bg-card p-6 transition-all hover:-translate-y-0.5 hover:bg-card-hover hover:shadow-[0_16px_48px_rgba(0,0,0,0.3)]"
            >
              {/* Strength + Direction row */}
              <div className="mb-3.5 flex items-center gap-2">
                <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/[0.06]">
                  <div
                    className="h-full rounded-sm transition-all duration-1000"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${color.css}, color-mix(in srgb, ${color.css} 60%, transparent))`,
                    }}
                  />
                </div>
                <span className="whitespace-nowrap text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
                  {signal.strength}
                </span>
                <span className={`rounded-lg px-2 py-0.5 text-[0.7rem] font-medium ${dir.cls}`}>
                  {dir.label}
                </span>
              </div>

              <h3 className="font-display text-[1.2rem] font-normal leading-snug">
                {signal.title}
              </h3>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-text-secondary">
                {signal.description}
              </p>

              <div className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] text-text-muted">
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(7, signal.observationCount) }).map((_, j) => (
                    <span
                      key={j}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          j < 3
                            ? color.css
                            : j < 5
                              ? "color-mix(in srgb, var(--color-cool-1) 50%, transparent)"
                              : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </div>
                {signal.observationCount} observations · {signal.contributorCount} people
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Terrain layer type ── */
interface Layer {
  color: string;
  label: string;
  data: number[];
}

const LAYER_DEFS = [
  { color: "255,107,74", label: "Power & strategy" },
  { color: "255,209,102", label: "Community energy" },
  { color: "78,205,196", label: "Participation" },
  { color: "69,183,209", label: "Relationships" },
  { color: "108,92,231", label: "Process questions" },
];

const DAYS = 30;
const PADDING = 40;
const TIME_LABELS = ["4 weeks ago", "3 weeks ago", "2 weeks ago", "Last week", "Now"];

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function generateLayers(): Layer[] {
  return LAYER_DEFS.map((def, li) => {
    const data: number[] = [];
    let val = seededRandom(li * 100) * 20 + 10;
    for (let i = 0; i < DAYS; i++) {
      val += (seededRandom(li * 100 + i + 1) - 0.45) * 8;
      val = Math.max(5, Math.min(50, val));
      data.push(val);
    }
    if (li === 0) return { ...def, data: data.map((v, i) => v + (i / DAYS) * 20) };
    if (li === 1) return { ...def, data: data.map((v, i) => v + (i / DAYS) * 12) };
    return { ...def, data };
  });
}

function TerrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<Layer[]>(generateLayers());
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    day: number;
    layers: { label: string; color: string; value: number }[];
  } | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const draw = useCallback((highlightDay: number | null = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const plotW = w - PADDING * 2;
    const plotH = h - PADDING * 2;
    const baseY = h - PADDING;
    const layers = layersRef.current;

    // Draw stacked area
    for (let l = layers.length - 1; l >= 0; l--) {
      const layer = layers[l];
      ctx.beginPath();
      ctx.moveTo(PADDING, baseY);

      for (let i = 0; i < DAYS; i++) {
        const x = PADDING + (i / (DAYS - 1)) * plotW;
        const stack = layers.slice(0, l + 1).reduce((sum, ly) => sum + ly.data[i], 0);
        const y = baseY - (stack / 200) * plotH;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevX = PADDING + ((i - 1) / (DAYS - 1)) * plotW;
          const prevStack = layers.slice(0, l + 1).reduce((sum, ly) => sum + ly.data[i - 1], 0);
          const prevY = baseY - (prevStack / 200) * plotH;
          const cpx = (prevX + x) / 2;
          ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
        }
      }

      ctx.lineTo(PADDING + plotW, baseY);
      ctx.closePath();

      const isHighlighted = highlightDay === null;
      const grad = ctx.createLinearGradient(0, PADDING, 0, baseY);
      grad.addColorStop(0, `rgba(${layer.color},${isHighlighted ? 0.5 : 0.35})`);
      grad.addColorStop(1, `rgba(${layer.color},${isHighlighted ? 0.05 : 0.02})`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = `rgba(${layer.color},${isHighlighted ? 0.4 : 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Vertical hover line + dots
    if (highlightDay !== null && highlightDay >= 0 && highlightDay < DAYS) {
      const x = PADDING + (highlightDay / (DAYS - 1)) * plotW;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, baseY);
      ctx.strokeStyle = "rgba(232,228,223,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Dots at each layer boundary
      for (let l = 0; l < layers.length; l++) {
        const stack = layers.slice(0, l + 1).reduce((sum, ly) => sum + ly.data[highlightDay], 0);
        const y = baseY - (stack / 200) * plotH;
        const c = layers[l].color;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c},0.9)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${c},0.4)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Time labels
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.fillStyle = "rgba(86,91,114,0.7)";
    ctx.textAlign = "center";
    TIME_LABELS.forEach((label, i, arr) => {
      ctx.fillText(label, PADDING + (i / (arr.length - 1)) * plotW, h - 12);
    });
  }, []);

  useEffect(() => {
    draw(hoveredDay);
  }, [draw, hoveredDay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => draw(hoveredDay);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw, hoveredDay]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const w = canvas.offsetWidth;
    const plotW = w - PADDING * 2;

    const dayFloat = ((mx - PADDING) / plotW) * (DAYS - 1);
    const day = Math.round(dayFloat);

    if (day < 0 || day >= DAYS || mx < PADDING || mx > w - PADDING) {
      setTooltip(null);
      setHoveredDay(null);
      return;
    }

    const layers = layersRef.current;
    const layerValues = layers.map((l) => ({
      label: l.label,
      color: l.color,
      value: Math.round(l.data[day]),
    }));

    setHoveredDay(day);
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      day,
      layers: layerValues,
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
    setHoveredDay(null);
  }

  const weeksAgo = tooltip ? Math.floor((DAYS - 1 - tooltip.day) / 7) : 0;
  const dayLabel = tooltip
    ? tooltip.day === DAYS - 1
      ? "Today"
      : weeksAgo === 0
        ? `${DAYS - 1 - tooltip.day} days ago`
        : `~${weeksAgo} week${weeksAgo > 1 ? "s" : ""} ago`
    : "";

  return (
    <div className="relative mx-auto max-w-[1100px]">
      <canvas
        ref={canvasRef}
        className="h-[220px] w-full cursor-crosshair rounded-2xl md:h-[300px]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 min-w-[180px] rounded-xl border border-white/8 p-3.5 text-[0.78rem] backdrop-blur-2xl"
          style={{
            left: Math.min(tooltip.x + 16, (canvasRef.current?.offsetWidth ?? 400) - 210),
            top: Math.max(tooltip.y - 20, 8),
            background: "rgba(20,27,45,0.92)",
          }}
        >
          <div className="mb-2 text-[0.72rem] font-medium text-text-secondary">
            {dayLabel}
          </div>
          <div className="flex flex-col gap-1.5">
            {tooltip.layers.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: `rgb(${l.color})` }}
                  />
                  <span className="text-text-secondary">{l.label}</span>
                </div>
                <span className="font-medium text-text-primary">{l.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend below chart */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[0.72rem] text-text-muted">
        {LAYER_DEFS.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: `rgb(${l.color})` }}
            />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

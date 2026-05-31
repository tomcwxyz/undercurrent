"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { SIGNAL_COLORS } from "@/lib/mock-data";
import type { ConstellationNodeView, ObservationView, SignalObservationMaps } from "@/lib/types";

const TYPE_RGB: Record<string, { r: number; g: number; b: number }> = {
  strong: { r: 255, g: 107, b: 74 },
  emerging: { r: 255, g: 209, b: 102 },
  weak: { r: 69, g: 183, b: 209 },
  single: { r: 108, g: 92, b: 231 },
};

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  strong: { label: "Strong signal", cls: "bg-warm-1/12 text-warm-1" },
  emerging: { label: "Emerging", cls: "bg-warm-3/12 text-warm-3" },
  weak: { label: "Weak signal", cls: "bg-cool-2/12 text-cool-2" },
  single: { label: "Single observation", cls: "bg-cool-3/12 text-cool-3" },
};

interface ConstellationViewProps {
  nodes: ConstellationNodeView[];
  observations: ObservationView[];
  signalObservationMaps?: SignalObservationMaps;
}

export function ConstellationView({ nodes, observations, signalObservationMaps }: ConstellationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<ConstellationNodeView | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNodeView | null>(null);
  const [zoomedNode, setZoomedNode] = useState<ConstellationNodeView | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const nodesRef = useRef<(ConstellationNodeView & { px: number; py: number; phase: number })[]>([]);
  const hoveredRef = useRef<ConstellationNodeView | null>(null);
  const selectedRef = useRef<ConstellationNodeView | null>(null);
  const prefersReducedMotion = useRef(false);

  // Observations linked to the zoomed signal
  const linkedObservations = zoomedNode?.signalId && signalObservationMaps
    ? (signalObservationMaps.bySignal[zoomedNode.signalId] ?? [])
        .map((id) => observations.find((o) => o.id === id))
        .filter((o): o is ObservationView => Boolean(o))
    : [];

  const computeNodes = useCallback((data: ConstellationNodeView[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    nodesRef.current = data.map((d) => ({
      ...d,
      px: d.x * w,
      py: d.y * h,
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    const textPrimary = styles.getPropertyValue("--color-text-primary").trim() || "232,228,223";
    const labelRgb = textPrimary.startsWith("#")
      ? [parseInt(textPrimary.slice(1, 3), 16), parseInt(textPrimary.slice(3, 5), 16), parseInt(textPrimary.slice(5, 7), 16)].join(",")
      : textPrimary;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeNodes(nodes);
    }

    function draw() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);
      const t = Date.now() * 0.001;
      const currentNodes = nodesRef.current;
      const hov = hoveredRef.current;
      const nodeById = new Map(currentNodes.map((n) => [n.id, n]));

      // Connections
      for (const node of currentNodes) {
        for (const connId of node.connections) {
          const target = nodeById.get(connId);
          if (!target) continue;
          const c = TYPE_RGB[node.type];
          const sel = selectedRef.current;
          const isHov = (hov && (hov.id === node.id || hov.id === target.id)) ||
            (sel && (sel.id === node.id || sel.id === target.id));
          const alpha = isHov ? 0.4 : 0.08 + Math.sin(t + node.phase) * 0.03;
          ctx!.beginPath();
          ctx!.moveTo(node.px, node.py);
          const midX = (node.px + target.px) / 2 + Math.sin(t * 0.5 + node.phase) * 15;
          const midY = (node.py + target.py) / 2 + Math.cos(t * 0.3 + node.phase) * 15;
          ctx!.quadraticCurveTo(midX, midY, target.px, target.py);
          ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
          ctx!.lineWidth = isHov ? 2 : 1;
          ctx!.stroke();
        }
      }

      // Nodes
      for (const node of currentNodes) {
        const c = TYPE_RGB[node.type];
        const sel = selectedRef.current;
        const isHov = (hov && hov.id === node.id) || (sel && sel.id === node.id);
        const breathe = 1 + Math.sin(t * 0.8 + node.phase) * 0.08;
        const size = node.size * breathe * (isHov ? 1.3 : 1);

        const grad = ctx!.createRadialGradient(node.px, node.py, 0, node.px, node.py, size * 3);
        grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${isHov ? 0.25 : 0.1})`);
        grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx!.beginPath();
        ctx!.arc(node.px, node.py, size * 3, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(node.px, node.py, size * 0.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},${isHov ? 1 : 0.8})`;
        ctx!.fill();

        if (isHov || node.size > 12) {
          ctx!.font = `${isHov ? 13 : 11}px 'DM Sans', sans-serif`;
          ctx!.fillStyle = `rgba(${labelRgb},${isHov ? 1 : 0.78})`;
          ctx!.textAlign = "center";
          ctx!.fillText(node.label, node.px, node.py - size - 8);
        }
      }

      if (!prefersReducedMotion.current) {
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    draw();

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found: ConstellationNodeView | null = null;
      for (const node of nodesRef.current) {
        const dx = mx - node.px;
        const dy = my - node.py;
        if (Math.sqrt(dx * dx + dy * dy) < node.size + 8) { found = node; break; }
      }
      hoveredRef.current = found;
      setHovered(found);
      if (found) {
        const canvasW = canvas!.offsetWidth;
        setTooltipPos({ x: Math.min(e.clientX - rect.left + 16, canvasW - 276), y: Math.max(e.clientY - rect.top - 20, 8) });
      }
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found: ConstellationNodeView | null = null;
      for (const node of nodesRef.current) {
        const dx = mx - node.px;
        const dy = my - node.py;
        if (Math.sqrt(dx * dx + dy * dy) < node.size + 8) { found = node; break; }
      }

      if (found) {
        if (selectedRef.current?.id === found.id) {
          // Second click on same node — deselect
          selectedRef.current = null;
          setSelectedNode(null);
          setZoomedNode(null);
        } else {
          selectedRef.current = found;
          setSelectedNode(found);
          setZoomedNode(found);
        }
      } else {
        // Click on empty space — deselect
        selectedRef.current = null;
        setSelectedNode(null);
        setZoomedNode(null);
      }
    }

    const onResize = () => resize();
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [computeNodes, nodes]);

  function dismiss() {
    selectedRef.current = null;
    setSelectedNode(null);
    setZoomedNode(null);
  }

  const zoomTransform = zoomedNode
    ? { transformOrigin: `${zoomedNode.x * 100}% ${zoomedNode.y * 100}%`, transform: "scale(2.2)" }
    : { transform: "scale(1)" };

  return (
    <div className="relative flex-1 overflow-hidden">

      {/* Canvas — CSS-zoomed toward selected node */}
      <div
        style={{ ...zoomTransform, transition: "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)", willChange: "transform" }}
        className="h-full w-full"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Constellation map showing signal clusters and observation connections"
          className="h-[calc(100svh-72px)] w-full cursor-crosshair"
        />
      </div>

      {/* Back button — shown when zoomed */}
      {zoomedNode && (
        <button
          onClick={dismiss}
          className="absolute left-6 top-6 z-50 flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[0.78rem] text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          style={{ background: "rgba(20,27,45,0.85)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
          Zoom out
        </button>
      )}

      {/* Legend — hidden when zoomed */}
      {!zoomedNode && (
        <div
          className="absolute bottom-8 left-8 rounded-2xl border border-white/[0.06] p-5 text-[0.78rem] backdrop-blur-xl"
          style={{ background: "rgba(20,27,45,0.85)" }}
        >
          <h4 className="mb-3 font-display text-base font-normal text-text-secondary">Signal Clusters</h4>
          <div className="flex flex-col gap-2">
            {[
              { type: "strong", label: "Strong signal — clear pattern" },
              { type: "emerging", label: "Emerging — watch this space" },
              { type: "weak", label: "Weak signal — early ripple" },
              { type: "single", label: "Single observation" },
            ].map((item) => (
              <div key={item.type} className="flex items-center gap-2.5 text-text-secondary">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SIGNAL_COLORS[item.type as keyof typeof SIGNAL_COLORS].css, boxShadow: `0 0 8px ${SIGNAL_COLORS[item.type as keyof typeof SIGNAL_COLORS].css}` }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover tooltip — hidden when zoomed */}
      {hovered && !zoomedNode && (
        <div
          className="pointer-events-none absolute z-50 max-w-[260px] rounded-xl border border-white/8 p-3.5 text-[0.82rem] leading-relaxed backdrop-blur-2xl"
          style={{ left: tooltipPos.x, top: tooltipPos.y, background: "rgba(20,27,45,0.92)" }}
        >
          <div className="mb-1 font-display text-base text-text-primary">{hovered.label}</div>
          <div className="text-text-secondary">{hovered.text}</div>
        </div>
      )}

      {/* Observation drawer — slides up when zoomed */}
      <div
        className="absolute inset-x-0 bottom-0 z-50 transition-transform duration-500"
        style={{ transform: zoomedNode ? "translateY(0)" : "translateY(100%)" }}
        aria-live="polite"
      >
        <div
          className="rounded-t-3xl border-t border-x border-white/[0.06] p-6 pb-8"
          style={{ background: "rgba(10,14,26,0.94)", backdropFilter: "blur(24px)" }}
        >
          {/* Drag handle */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10" />

          {/* Signal header */}
          {zoomedNode && (
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-normal leading-snug text-text-primary">
                  {zoomedNode.label}
                </h3>
                {zoomedNode.text && (
                  <p className="mt-1.5 text-[0.82rem] leading-relaxed text-text-secondary line-clamp-2">
                    {zoomedNode.text}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-block rounded-lg px-2.5 py-1 text-[0.7rem] font-medium ${TYPE_LABELS[zoomedNode.type]?.cls ?? ""}`}>
                  {TYPE_LABELS[zoomedNode.type]?.label ?? zoomedNode.type}
                </span>
                <button
                  onClick={dismiss}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-secondary"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Observations */}
          {linkedObservations.length > 0 ? (
            <>
              <p className="mb-3 text-[0.72rem] uppercase tracking-wider text-text-muted">
                {linkedObservations.length} observation{linkedObservations.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                {linkedObservations.map((obs) => (
                  <div
                    key={obs.id}
                    className="w-[260px] shrink-0 rounded-2xl border border-white/[0.06] p-4"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <p className="mb-2 text-[0.82rem] leading-relaxed text-text-primary line-clamp-4">
                      {obs.text}
                    </p>
                    <div className="flex items-center justify-between text-[0.7rem] text-text-muted">
                      <span>{obs.author}</span>
                      <span>{obs.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[0.82rem] text-text-muted">
              {zoomedNode?.signalId ? "No observations linked yet." : "Select a signal node to see linked observations."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

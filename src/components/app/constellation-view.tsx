"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { SIGNAL_COLORS } from "@/lib/mock-data";
import { SourceFilter, matchesSource, type SourceFilterValue } from "@/components/app/source-filter";
import type { ConstellationNodeView, ObservationView, SignalObservationMaps, CollectionView } from "@/lib/types";

const TYPE_RGB: Record<string, { r: number; g: number; b: number }> = {
  strong: { r: 255, g: 107, b: 74 },
  emerging: { r: 255, g: 209, b: 102 },
  weak: { r: 69, g: 183, b: 209 },
  single: { r: 108, g: 92, b: 231 },
};

const TYPE_LABELS: Record<string, { label: string; dot: string }> = {
  strong: { label: "Strong signal", dot: "bg-warm-1" },
  emerging: { label: "Emerging signal", dot: "bg-warm-3" },
  weak: { label: "Weak signal", dot: "bg-cool-2" },
  single: { label: "Single observation", dot: "bg-cool-3" },
};

// Width of the detail panel; used to auto-pan a selected node into the visible
// area so the panel never sits on top of it.
const PANEL_WIDTH = 460;
// Max observation dots drawn around a selected node (keeps the orbit legible).
const MAX_SATELLITES = 12;

interface Satellite {
  ox: number; // origin (node centre)
  oy: number;
  tx: number; // target position
  ty: number;
  startMs: number;
  c: { r: number; g: number; b: number };
}

// Spring-like ease — flies out and settles with a slight overshoot
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

interface ConstellationViewProps {
  nodes: ConstellationNodeView[];
  observations: ObservationView[];
  signalObservationMaps?: SignalObservationMaps;
  collections?: CollectionView[];
}

export function ConstellationView({ nodes, observations, signalObservationMaps, collections }: ConstellationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<ConstellationNodeView | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNodeView | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>("all");

  // Only render nodes whose linked observations match the active source filter.
  const observationById = useMemo(
    () => new Map(observations.map((o) => [o.id, o])),
    [observations]
  );
  const hasReflections = useMemo(
    () => observations.some((o) => o.reflectionId),
    [observations]
  );
  const visibleNodes = useMemo(() => {
    if (sourceFilter === "all") return nodes;
    return nodes.filter((node) => {
      const obsIds = node.signalId ? signalObservationMaps?.bySignal[node.signalId] ?? [] : [];
      return obsIds.some((id) => {
        const obs = observationById.get(id);
        return obs ? matchesSource(obs, sourceFilter) : false;
      });
    });
  }, [nodes, sourceFilter, signalObservationMaps, observationById]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const nodesRef = useRef<(ConstellationNodeView & { px: number; py: number; phase: number })[]>([]);
  const hoveredRef = useRef<ConstellationNodeView | null>(null);
  const selectedRef = useRef<ConstellationNodeView | null>(null);
  const satellitesRef = useRef<Satellite[]>([]);
  const signalObsMapsRef = useRef(signalObservationMaps);
  const prefersReducedMotion = useRef(false);
  // Viewport panning: current offset, the animated target, and drag bookkeeping.
  const panRef = useRef({ x: 0, y: 0 });
  const panTargetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const movedRef = useRef(false);
  // Which sidebar observation is hovered → highlight its satellite on the canvas.
  const hoveredSatelliteRef = useRef<number | null>(null);

  // Keep signalObsMapsRef in sync so onClick always has fresh data
  useEffect(() => { signalObsMapsRef.current = signalObservationMaps; }, [signalObservationMaps]);

  // Close the detail panel, clear satellites, and recentre the map.
  function closePanel() {
    selectedRef.current = null;
    satellitesRef.current = [];
    panTargetRef.current = { x: 0, y: 0 };
    setSelectedNode(null);
  }

  // Changing the source filter clears any selection — the selected node may no
  // longer be on screen. Handled here (not in an effect) to avoid cascading renders.
  function handleSourceChange(value: SourceFilterValue) {
    closePanel();
    setSourceFilter(value);
  }

  // Observations linked to the selected signal (for the panel)
  const linkedObservations: ObservationView[] = selectedNode?.signalId && signalObservationMaps
    ? (signalObservationMaps.bySignal[selectedNode.signalId] ?? [])
        .map((id) => observations.find((o) => o.id === id))
        .filter((o): o is ObservationView => Boolean(o))
    : [];

  // Colour of the selected node — used for the sidebar number badges so they
  // match their satellite dots on the canvas.
  const selectedRgb = selectedNode ? TYPE_RGB[selectedNode.type] ?? TYPE_RGB.single : TYPE_RGB.single;

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

  function spawnSatellites(node: ConstellationNodeView & { px: number; py: number }) {
    const signalId = node.signalId;
    const obsIds = signalId && signalObsMapsRef.current
      ? (signalObsMapsRef.current.bySignal[signalId] ?? []).slice(0, MAX_SATELLITES)
      : [];
    if (obsIds.length === 0) { satellitesRef.current = []; return; }

    const c = TYPE_RGB[node.type] ?? TYPE_RGB.single;
    const radius = node.size * 4.5 + 55;
    const now = Date.now();
    satellitesRef.current = obsIds.map((_, i) => {
      const angle = (i / obsIds.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ox: node.px, oy: node.py,
        tx: node.px + Math.cos(angle) * radius,
        ty: node.py + Math.sin(angle) * radius,
        startMs: now + i * 55,
        c,
      };
    });
  }

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
      computeNodes(visibleNodes);
    }

    function draw() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);
      const t = Date.now() * 0.001;
      const now = Date.now();
      const currentNodes = nodesRef.current;
      const hov = hoveredRef.current;
      const sel = selectedRef.current;
      const nodeById = new Map(currentNodes.map((n) => [n.id, n]));

      // Ease the pan offset toward its target (auto-pan on select / drag), then
      // draw everything under that translation.
      const pan = panRef.current;
      if (prefersReducedMotion.current) {
        pan.x = panTargetRef.current.x;
        pan.y = panTargetRef.current.y;
      } else {
        pan.x += (panTargetRef.current.x - pan.x) * 0.12;
        pan.y += (panTargetRef.current.y - pan.y) * 0.12;
      }
      ctx!.save();
      ctx!.translate(pan.x, pan.y);

      // Connections
      for (const node of currentNodes) {
        for (const connId of node.connections) {
          const target = nodeById.get(connId);
          if (!target) continue;
          const c = TYPE_RGB[node.type];
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

      // Satellite spokes + numbered dots (each maps to a sidebar observation)
      satellitesRef.current.forEach((sat, i) => {
        const elapsed = now - sat.startMs;
        if (elapsed < 0) return; // not started yet (stagger)
        const rawT = Math.min(1, elapsed / 580);
        const eased = easeOutBack(rawT);
        const x = sat.ox + (sat.tx - sat.ox) * eased;
        const y = sat.oy + (sat.ty - sat.oy) * eased;
        const alpha = Math.min(1, rawT * 2); // fade in quickly
        const isHi = hoveredSatelliteRef.current === i;
        const dotR = isHi ? 9 : 7;
        const haloR = isHi ? 22 : 15;

        // Spoke from node to satellite
        ctx!.beginPath();
        ctx!.moveTo(sat.ox, sat.oy);
        ctx!.lineTo(x, y);
        ctx!.strokeStyle = `rgba(${sat.c.r},${sat.c.g},${sat.c.b},${alpha * (isHi ? 0.5 : 0.2)})`;
        ctx!.lineWidth = isHi ? 1.25 : 0.75;
        ctx!.setLineDash([3, 5]);
        ctx!.stroke();
        ctx!.setLineDash([]);

        // Glow halo
        const gGrad = ctx!.createRadialGradient(x, y, 0, x, y, haloR);
        gGrad.addColorStop(0, `rgba(${sat.c.r},${sat.c.g},${sat.c.b},${alpha * (isHi ? 0.4 : 0.25)})`);
        gGrad.addColorStop(1, `rgba(${sat.c.r},${sat.c.g},${sat.c.b},0)`);
        ctx!.beginPath();
        ctx!.arc(x, y, haloR, 0, Math.PI * 2);
        ctx!.fillStyle = gGrad;
        ctx!.fill();

        // Core dot
        ctx!.beginPath();
        ctx!.arc(x, y, dotR, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${sat.c.r},${sat.c.g},${sat.c.b},${alpha * (isHi ? 1 : 0.9)})`;
        ctx!.fill();

        // Number label inside the dot, matching the sidebar entry
        ctx!.fillStyle = `rgba(8,11,22,${alpha})`;
        ctx!.font = "600 9px 'DM Sans', sans-serif";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(String(i + 1), x, y + 0.5);
      });
      ctx!.textBaseline = "alphabetic"; // reset for node labels below

      // Signal nodes
      for (const node of currentNodes) {
        const c = TYPE_RGB[node.type];
        const isSelected = sel && sel.id === node.id;
        const isHov = (hov && hov.id === node.id) || !!isSelected;
        const breathe = 1 + Math.sin(t * 0.8 + node.phase) * 0.08;
        const size = node.size * breathe * (isHov ? 1.3 : 1);

        // Animated outer ring on selected node
        if (isSelected) {
          const ringSize = size * 2.4 + Math.sin(t * 1.2) * 3;
          ctx!.beginPath();
          ctx!.arc(node.px, node.py, ringSize, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.35 + Math.sin(t * 1.2) * 0.1})`;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }

        // Glow
        const glowSize = isSelected ? size * 5 : size * 3;
        const grad = ctx!.createRadialGradient(node.px, node.py, 0, node.px, node.py, glowSize);
        grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${isSelected ? 0.35 : isHov ? 0.25 : 0.1})`);
        grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx!.beginPath();
        ctx!.arc(node.px, node.py, glowSize, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        // Core
        ctx!.beginPath();
        ctx!.arc(node.px, node.py, size * 0.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},${isHov ? 1 : 0.8})`;
        ctx!.fill();

        // Label
        if (isHov || node.size > 12) {
          ctx!.font = `${isSelected ? 14 : isHov ? 13 : 11}px 'DM Sans', sans-serif`;
          ctx!.fillStyle = `rgba(${labelRgb},${isSelected ? 1 : isHov ? 1 : 0.78})`;
          ctx!.textAlign = "center";
          ctx!.fillText(node.label, node.px, node.py - size - 10);
        }
      }

      ctx!.restore(); // end pan translation

      if (!prefersReducedMotion.current) {
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    draw();

    // Find a node under the given screen coords, accounting for the pan offset.
    function nodeAt(mx: number, my: number) {
      const px = panRef.current.x;
      const py = panRef.current.y;
      for (const node of nodesRef.current) {
        const dx = mx - (node.px + px);
        const dy = my - (node.py + py);
        if (Math.sqrt(dx * dx + dy * dy) < node.size + 8) return node;
      }
      return null;
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      movedRef.current = false;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Dragging → pan the viewport (and suppress the next click).
      if (dragRef.current) {
        const dx = mx - dragRef.current.startX;
        const dy = my - dragRef.current.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
        panRef.current = { x: dragRef.current.panX + dx, y: dragRef.current.panY + dy };
        panTargetRef.current = { ...panRef.current }; // stop auto-pan fighting the drag
        return;
      }

      if (selectedRef.current) return; // no hover while a node is open

      const found = nodeAt(mx, my);
      hoveredRef.current = found;
      setHovered(found);
      if (found) {
        const canvasW = canvas!.offsetWidth;
        setTooltipPos({ x: Math.min(mx + 16, canvasW - 276), y: Math.max(my - 20, 8) });
      }
    }

    function onMouseUp() {
      dragRef.current = null;
    }

    function deselect() {
      selectedRef.current = null;
      satellitesRef.current = [];
      setSelectedNode(null);
      panTargetRef.current = { x: 0, y: 0 }; // recentre the map
    }

    function onClick(e: MouseEvent) {
      // A drag just happened — don't treat it as a click.
      if (movedRef.current) { movedRef.current = false; return; }
      const rect = canvas!.getBoundingClientRect();
      const found = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (found) {
        if (selectedRef.current?.id === found.id) {
          deselect();
        } else {
          selectedRef.current = found;
          setSelectedNode(found);
          hoveredRef.current = null;
          setHovered(null);
          spawnSatellites(found);
          // Auto-pan so the node sits in the open space left of the panel.
          const w = canvas!.offsetWidth;
          const h = canvas!.offsetHeight;
          panTargetRef.current = {
            x: (w - PANEL_WIDTH) / 2 - found.px,
            y: h / 2 - found.py,
          };
        }
      } else if (selectedRef.current) {
        deselect();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedRef.current) deselect();
    }

    const onResize = () => resize();
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [computeNodes, visibleNodes]);

  return (
    <div className="relative flex-1 overflow-hidden">

      {/* Source filter — floating top-left, hidden while a node is selected */}
      {(((collections && collections.length > 0) || hasReflections)) && !selectedNode && (
        <div
          className="absolute left-8 top-6 z-40 rounded-xl border border-white/[0.06] px-3 py-2 backdrop-blur-xl"
          style={{ background: "rgba(20,27,45,0.85)" }}
        >
          <SourceFilter
            collections={collections ?? []}
            hasReflections={hasReflections}
            value={sourceFilter}
            onChange={handleSourceChange}
          />
        </div>
      )}

      {/* Canvas — dims slightly when panel open so panel is readable */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Constellation map showing signal clusters and observation connections"
        className="h-[calc(100svh-72px)] w-full cursor-grab transition-opacity duration-500 active:cursor-grabbing"
        style={{ opacity: selectedNode ? 0.5 : 1 }}
      />

      {/* Click-to-close overlay over the canvas area left of panel */}
      {selectedNode && (
        <div
          className="absolute inset-y-0 left-0 right-[460px]"
          style={{ cursor: "pointer" }}
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      {/* Legend — hidden when panel open */}
      {!selectedNode && (
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
          <div className="mt-3 border-t border-white/[0.06] pt-3 text-[0.7rem] text-text-muted">
            Drag to pan · click a signal to explore
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hovered && !selectedNode && (
        <div
          className="pointer-events-none absolute z-50 max-w-[260px] rounded-xl border border-white/8 p-3.5 text-[0.82rem] leading-relaxed backdrop-blur-2xl"
          style={{ left: tooltipPos.x, top: tooltipPos.y, background: "rgba(20,27,45,0.92)" }}
        >
          <div className="mb-1 font-display text-base text-text-primary">{hovered.label}</div>
          <div className="text-text-secondary">{hovered.text}</div>
        </div>
      )}

      {/* Detail panel — slides in from right */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-50 w-full max-w-[460px] transition-transform duration-500"
        style={{
          transform: selectedNode ? "translateX(0)" : "translateX(100%)",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: selectedNode ? "auto" : "none",
        }}
        aria-live="polite"
      >
        <div
          className="flex h-full flex-col border-l border-white/[0.07]"
          style={{ background: "rgba(8,11,22,0.97)", backdropFilter: "blur(32px)" }}
        >
          {selectedNode && (
            <>
              {/* Header */}
              <div className="shrink-0 px-8 pb-6 pt-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${TYPE_LABELS[selectedNode.type]?.dot ?? "bg-cool-1"}`} />
                    <span className="text-[0.7rem] uppercase tracking-widest text-text-muted">
                      {TYPE_LABELS[selectedNode.type]?.label ?? selectedNode.type}
                    </span>
                  </div>
                  <button
                    onClick={closePanel}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                    aria-label="Close"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <h2 className="font-display text-[1.75rem] font-light leading-tight text-text-primary">
                  {selectedNode.label}
                </h2>

                {selectedNode.text && (
                  <p className="mt-3 text-[0.85rem] leading-relaxed text-text-secondary">
                    {selectedNode.text}
                  </p>
                )}

                {linkedObservations.length > 0 && (
                  <p className="mt-4 text-[0.72rem] uppercase tracking-widest text-text-muted">
                    {linkedObservations.length} observation{linkedObservations.length !== 1 ? "s" : ""}
                    <span className="ml-2 normal-case tracking-normal text-text-muted/70">
                      · numbers match the dots on the map
                      {linkedObservations.length > MAX_SATELLITES && ` (first ${MAX_SATELLITES} shown)`}
                    </span>
                  </p>
                )}
              </div>

              <div className="mx-8 border-t border-white/[0.06]" />

              {/* Observations — scrollable */}
              <div className="flex-1 overflow-y-auto px-8 py-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
                {linkedObservations.length > 0 ? (
                  <div className="py-4">
                    {linkedObservations.map((obs, i) => {
                      const images = obs.media.filter((m) => m.type === "image");
                      const audio = obs.media.filter((m) => m.type === "voice");
                      return (
                        <div
                          key={obs.id}
                          className={`py-6 ${i < linkedObservations.length - 1 ? "border-b border-white/[0.05]" : ""}`}
                          onMouseEnter={() => { hoveredSatelliteRef.current = i < MAX_SATELLITES ? i : null; }}
                          onMouseLeave={() => { hoveredSatelliteRef.current = null; }}
                        >
                          <div className="mb-2.5 flex items-center gap-2">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold"
                              style={{
                                background: `rgba(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b},0.18)`,
                                color: `rgb(${selectedRgb.r},${selectedRgb.g},${selectedRgb.b})`,
                              }}
                            >
                              {i + 1}
                            </span>
                            {obs.reflectionId && (
                              <span className="rounded-md bg-cool-2/12 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wider text-cool-2">
                                via reflection
                              </span>
                            )}
                            {i >= MAX_SATELLITES && (
                              <span className="text-[0.62rem] text-text-muted">not shown on map</span>
                            )}
                          </div>
                          <p className="font-display text-[1.05rem] font-light italic leading-relaxed text-text-primary">
                            &ldquo;{obs.text}&rdquo;
                          </p>

                          {images.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {images.map((img) => (
                                <img
                                  key={img.id}
                                  src={img.url}
                                  alt={img.aiDescription ?? img.fileName ?? "Attached image"}
                                  className="h-[110px] w-auto max-w-[180px] rounded-xl object-cover opacity-90 transition-opacity hover:opacity-100"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}

                          {audio.map((a) => (
                            <div key={a.id} className="mt-3">
                              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-cool-1" aria-hidden="true">
                                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                  <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                                <audio controls preload="none" className="h-7 w-full [&::-webkit-media-controls-panel]:bg-transparent">
                                  <source src={a.url} type={a.mimeType} />
                                </audio>
                              </div>
                              {a.aiTranscript && (
                                <p className="mt-2 px-1 text-[0.75rem] italic leading-relaxed text-text-muted">
                                  {a.aiTranscript}
                                </p>
                              )}
                            </div>
                          ))}

                          <div className="mt-4 flex items-center gap-2 text-[0.72rem] text-text-muted">
                            <span className="font-medium text-text-secondary">{obs.author}</span>
                            <span>·</span>
                            <span>{obs.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-[0.82rem] text-text-muted">
                    {selectedNode.signalId
                      ? "No observations linked yet."
                      : "Demo node — add real observations to see them here."}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

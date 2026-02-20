"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { SIGNAL_COLORS } from "@/lib/mock-data";
import type { ConstellationNodeView } from "@/lib/types";

const TYPE_RGB: Record<string, { r: number; g: number; b: number }> = {
  strong: { r: 255, g: 107, b: 74 },
  emerging: { r: 255, g: 209, b: 102 },
  weak: { r: 69, g: 183, b: 209 },
  single: { r: 108, g: 92, b: 231 },
};

interface ConstellationViewProps {
  nodes: ConstellationNodeView[];
}

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  strong: { label: "Strong signal", cls: "bg-warm-1/12 text-warm-1" },
  emerging: { label: "Emerging", cls: "bg-warm-3/12 text-warm-3" },
  weak: { label: "Weak signal", cls: "bg-cool-2/12 text-cool-2" },
  single: { label: "Single observation", cls: "bg-cool-3/12 text-cool-3" },
};

export function ConstellationView({ nodes }: ConstellationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<ConstellationNodeView | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNodeView | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const nodesRef = useRef<(ConstellationNodeView & { px: number; py: number; phase: number })[]>([]);
  const hoveredRef = useRef<ConstellationNodeView | null>(null);
  const selectedRef = useRef<ConstellationNodeView | null>(null);
  const prefersReducedMotion = useRef(false);

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

      // Build ID → node lookup for connections
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

        // Glow
        const grad = ctx!.createRadialGradient(node.px, node.py, 0, node.px, node.py, size * 3);
        grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${isHov ? 0.25 : 0.1})`);
        grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx!.beginPath();
        ctx!.arc(node.px, node.py, size * 3, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        // Core
        ctx!.beginPath();
        ctx!.arc(node.px, node.py, size * 0.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},${isHov ? 1 : 0.8})`;
        ctx!.fill();

        // Label
        if (isHov || node.size > 12) {
          ctx!.font = `${isHov ? 13 : 11}px 'DM Sans', sans-serif`;
          ctx!.fillStyle = `rgba(232,228,223,${isHov ? 0.9 : 0.5})`;
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
        if (Math.sqrt(dx * dx + dy * dy) < node.size + 8) {
          found = node;
          break;
        }
      }

      hoveredRef.current = found;
      setHovered(found);
      if (found) {
        const canvasW = canvas!.offsetWidth;
        setTooltipPos({
          x: Math.min(e.clientX - rect.left + 16, canvasW - 276),
          y: Math.max(e.clientY - rect.top - 20, 8),
        });
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
        if (Math.sqrt(dx * dx + dy * dy) < node.size + 8) {
          found = node;
          break;
        }
      }

      if (found && selectedRef.current?.id === found.id) {
        selectedRef.current = null;
        setSelectedNode(null);
      } else {
        selectedRef.current = found;
        setSelectedNode(found);
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

  return (
    <div className="relative flex-1">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Constellation map showing signal clusters and observation connections"
        className="h-[calc(100svh-72px)] w-full cursor-crosshair"
      />

      {/* Legend */}
      <div
        className="absolute bottom-8 left-8 rounded-2xl border border-white/[0.06] p-5 text-[0.78rem] backdrop-blur-xl"
        style={{ background: "rgba(20,27,45,0.85)" }}
      >
        <h4 className="mb-3 font-display text-base font-normal text-text-secondary">
          Signal Clusters
        </h4>
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
                style={{
                  background: SIGNAL_COLORS[item.type as keyof typeof SIGNAL_COLORS].css,
                  boxShadow: `0 0 8px ${SIGNAL_COLORS[item.type as keyof typeof SIGNAL_COLORS].css}`,
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip (only when no node is selected) */}
      {hovered && !selectedNode && (
        <div
          className="pointer-events-none absolute z-50 max-w-[260px] rounded-xl border border-white/8 p-3.5 text-[0.82rem] leading-relaxed backdrop-blur-2xl"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: "rgba(20,27,45,0.92)",
          }}
        >
          <div className="mb-1 font-display text-base text-text-primary">
            {hovered.label}
          </div>
          <div className="text-text-secondary">{hovered.text}</div>
        </div>
      )}

      {/* Detail panel */}
      {selectedNode && (
        <div
          className="absolute right-8 top-8 z-50 w-[280px] rounded-2xl border border-white/[0.06] p-5 backdrop-blur-xl"
          style={{ background: "rgba(20,27,45,0.92)" }}
          aria-live="polite"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h4 className="font-display text-[1.1rem] font-normal leading-snug text-text-primary">
              {selectedNode.label}
            </h4>
            <button
              onClick={() => { selectedRef.current = null; setSelectedNode(null); }}
              className="shrink-0 text-[0.85rem] text-text-muted transition-colors hover:text-text-secondary"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>

          <span className={`inline-block rounded-lg px-2 py-0.5 text-[0.7rem] font-medium ${TYPE_LABELS[selectedNode.type]?.cls ?? ""}`}>
            {TYPE_LABELS[selectedNode.type]?.label ?? selectedNode.type}
          </span>

          {selectedNode.text && (
            <p className="mt-3 text-[0.82rem] leading-relaxed text-text-secondary">
              {selectedNode.text}
            </p>
          )}

          <div className="mt-3 text-[0.72rem] text-text-muted">
            {selectedNode.connections.length} connection{selectedNode.connections.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

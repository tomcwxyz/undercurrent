"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  c: string;
  ph: number;
}

const PALETTE = [
  "78,205,196",
  "69,183,209",
  "108,92,231",
  "255,209,102",
  "255,140,66",
];

const LINE_COLOR = "78,205,196";

export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let pts: Particle[] = [];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const isMobile = window.innerWidth < 640;
      const count = Math.min(60, (window.innerWidth / (isMobile ? 12 : 18)) | 0);

      pts = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        r: Math.random() * 1.6 + 0.5,
        a: Math.random() * 0.3 + 0.06,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        ph: Math.random() * Math.PI * 2,
      }));
    }

    function tick() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx!.clearRect(0, 0, w, h);
      const t = performance.now() * 0.001;

      for (const p of pts) {
        p.x += p.vx + Math.sin(t * 0.3 + p.ph) * 0.07;
        p.y += p.vy + Math.cos(t * 0.2 + p.ph) * 0.05;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const breathe = 0.7 + Math.sin(t * 0.5 + p.ph) * 0.3;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.c},${(p.a * breathe).toFixed(3)})`;
        ctx!.fill();
      }

      // Connection lines
      const isMobile = window.innerWidth < 640;
      const maxDist = isMobile ? 60 : 90;
      const maxDistSq = maxDist * maxDist;

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxDistSq) {
            const alpha = 0.03 * (1 - Math.sqrt(d2) / maxDist);
            ctx!.beginPath();
            ctx!.moveTo(pts[i].x, pts[i].y);
            ctx!.lineTo(pts[j].x, pts[j].y);
            ctx!.strokeStyle = `rgba(${LINE_COLOR},${alpha.toFixed(4)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      raf = requestAnimationFrame(tick);
    }

    resize();
    seed();
    tick();

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ opacity: 0.5 }}
      aria-hidden="true"
    />
  );
}

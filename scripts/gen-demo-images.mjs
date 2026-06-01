// Generates on-brand SVG placeholder images for the demo seed data.
// Run from app/:  node scripts/gen-demo-images.mjs
// Output: public/demo/*.svg  (referenced by the seed as observation media)
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const OUT = join("public", "demo");
mkdirSync(OUT, { recursive: true });

// Brand palette (matches SIGNAL_COLORS / globals.css)
const IMAGES = [
  { file: "workshop-postits", label: "Workshop post-its", c1: "#ff6b4a", c2: "#ffd166" },
  { file: "community-space", label: "Community space", c1: "#4ecdc4", c2: "#45b7d1" },
  { file: "assembly", label: "Community assembly", c1: "#6c5ce7", c2: "#45b7d1" },
  { file: "whiteboard", label: "Strategy whiteboard", c1: "#ff6b4a", c2: "#6c5ce7" },
  { file: "garden", label: "Community garden", c1: "#4ecdc4", c2: "#ffd166" },
  { file: "gathering", label: "Evening gathering", c1: "#ffd166", c2: "#ff6b4a" },
  { file: "noticeboard", label: "The noticeboard", c1: "#45b7d1", c2: "#6c5ce7" },
  { file: "meeting", label: "Team check-in", c1: "#6c5ce7", c2: "#ff6b4a" },
];

function svg({ label, c1, c2 }, seed) {
  // Deterministic decorative circles from the seed so each image differs.
  const rnd = (n) => {
    const x = Math.sin((seed + n) * 9301 + 49297) * 49297;
    return x - Math.floor(x);
  };
  const circles = Array.from({ length: 5 }, (_, i) => {
    const cx = Math.round(rnd(i * 3 + 1) * 800);
    const cy = Math.round(rnd(i * 3 + 2) * 600);
    const r = Math.round(60 + rnd(i * 3 + 3) * 140);
    const op = (0.05 + rnd(i + 7) * 0.08).toFixed(3);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="${op}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="#0a0e1a"/>
  <rect width="800" height="600" fill="url(#g)" opacity="0.82"/>
  ${circles}
  <text x="400" y="300" text-anchor="middle" font-family="'DM Sans', sans-serif" font-size="36" font-weight="300" fill="rgba(255,255,255,0.95)">${label}</text>
  <text x="400" y="338" text-anchor="middle" font-family="'DM Sans', sans-serif" font-size="15" letter-spacing="3" fill="rgba(255,255,255,0.6)">SWELLS · DEMO</text>
</svg>
`;
}

IMAGES.forEach((img, i) => {
  writeFileSync(join(OUT, `${img.file}.svg`), svg(img, i + 1));
});

console.log(`Wrote ${IMAGES.length} demo images to ${OUT}`);

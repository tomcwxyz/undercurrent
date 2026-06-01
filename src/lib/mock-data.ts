// Display constants shared across the app views.
// (Demo/seed content now lives in src/lib/db/seed-data.ts.)

export const SIGNAL_COLORS = {
  strong: { css: "var(--color-warm-1)", rgb: "255,107,74" },
  emerging: { css: "var(--color-warm-3)", rgb: "255,209,102" },
  weak: { css: "var(--color-cool-2)", rgb: "69,183,209" },
  single: { css: "var(--color-cool-3)", rgb: "108,92,231" },
} as const;

"use client";

export interface R1SpaceOption {
  id: string;
  name: string;
}

export function R1SpacePicker({
  spaces,
  selectedIndex,
  onStep,
  onOpen,
  onCancel,
}: {
  spaces: R1SpaceOption[];
  selectedIndex: number;
  onStep: (delta: number) => void;
  onOpen: (space: R1SpaceOption) => void;
  onCancel: () => void;
}) {
  const selected = spaces[selectedIndex] ?? spaces[0];
  if (!selected) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5">
      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.16em] text-text-muted">
        <span>Choose space</span>
        <span>
          {selectedIndex + 1}/{spaces.length}
        </span>
      </div>

      <div className="my-auto min-h-0 py-5">
        <div className="mb-3 text-[0.62rem] uppercase tracking-[0.15em] text-cool-1">
          Current selection
        </div>
        <h2 className="line-clamp-4 font-display text-[2.45rem] font-light leading-[0.96] text-text-primary">
          {selected.name}
        </h2>
        <p className="mt-5 max-w-[300px] text-[0.78rem] leading-relaxed text-text-secondary">
          Turn the wheel to move through your spaces, then open this one.
        </p>
      </div>

      <div className="mb-3 flex items-center justify-center gap-3 text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="rounded-[14px] border border-white/[0.06] px-4 py-2"
        >
          ↑ Previous
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="rounded-[14px] border border-white/[0.06] px-4 py-2"
        >
          Next ↓
        </button>
      </div>

      <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[18px] border border-white/[0.06] px-3 py-3 text-[0.66rem] uppercase tracking-[0.12em] text-text-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onOpen(selected)}
          className="rounded-[18px] border border-cool-1/25 bg-cool-1/10 px-3 py-3 text-[0.66rem] font-medium uppercase tracking-[0.12em] text-cool-1"
        >
          Open space
        </button>
      </div>
    </div>
  );
}

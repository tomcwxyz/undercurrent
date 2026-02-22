export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-2.5 py-1 text-[0.72rem] transition-all ${
        active
          ? "bg-cool-1/15 text-cool-1 font-medium"
          : "bg-white/[0.03] text-text-secondary hover:text-text-primary hover:bg-white/[0.06]"
      }`}
    >
      {label}
    </button>
  );
}

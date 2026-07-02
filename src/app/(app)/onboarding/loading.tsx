export default function OnboardingLoading() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-4"
      style={{ background: "#0A0E1A" }}
    >
      <em
        className="font-display text-2xl font-light italic tracking-wide bg-gradient-to-r from-cool-1 to-cool-2 bg-clip-text text-transparent"
        style={{ fontStyle: "italic" }}
      >
        swells
      </em>
      <div className="flex items-center gap-2 text-[0.85rem] text-text-secondary">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cool-1" />
        Setting up your space&hellip;
      </div>
    </div>
  );
}

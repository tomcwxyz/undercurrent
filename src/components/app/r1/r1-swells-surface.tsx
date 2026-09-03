"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createObservation } from "@/app/(app)/actions";
import { R1VoiceNoticeButton } from "@/components/app/r1/r1-voice-notice-button";
import { R1AskSwellSurface } from "@/components/app/r1/r1-ask-swell-surface";
import { R1FeedbackButtons } from "@/components/app/r1/r1-feedback-buttons";
import { nativeSwellsDevice } from "@/lib/r1/device";
import type {
  SwellsLens,
  SwellsSwellReading,
  SwellsSurfaceProjection,
} from "@/lib/surfaces/types";

const TEMPERATURE_COLOURS = [
  "#6c5ce7",
  "#45b7d1",
  "#4ecdc4",
  "#ffd166",
  "#ff8c42",
  "#ff6b4a",
] as const;

const LENS_LABELS: Partial<Record<SwellsLens, string>> = {
  temperature: "Temperature",
  horizon: "Horizon",
  change: "Change",
  notice: "Notice",
};

function deviceHaptic(duration = 14) {
  nativeSwellsDevice()?.haptic?.(duration);
}

function directionLabel(direction: SwellsSwellReading["direction"]) {
  if (direction === "strengthening") return "Strengthening ↑";
  if (direction === "new") return "New ✦";
  return "Steady →";
}

function strengthLabel(strength: SwellsSwellReading["strength"]) {
  return strength[0].toUpperCase() + strength.slice(1);
}

function signalAmplitude(signal: SwellsSwellReading) {
  const strength =
    signal.strength === "strong" ? 1 : signal.strength === "emerging" ? 0.72 : 0.48;
  const direction = signal.direction === "strengthening" ? 1 : signal.direction === "new" ? 0.82 : 0.62;
  return strength * direction;
}

function SwellWave({ signal }: { signal: SwellsSwellReading }) {
  const amplitude = signalAmplitude(signal);
  const peak = 72 - amplitude * 42;
  const shoulder = 95 - amplitude * 24;

  return (
    <svg
      viewBox="0 0 420 150"
      className="h-[150px] w-full overflow-visible"
      role="img"
      aria-label={`${signal.title}, ${directionLabel(signal.direction)}`}
    >
      <defs>
        <linearGradient id={`wave-${signal.id}`} x1="0" x2="1">
          <stop offset="0%" stopColor="var(--color-cool-2)" stopOpacity="0.2" />
          <stop offset="55%" stopColor="var(--color-cool-1)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--color-warm-3)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path
        d={`M0 118 C52 118 70 ${shoulder} 112 ${shoulder} C156 ${shoulder} 162 ${peak} 212 ${peak} C262 ${peak} 270 ${shoulder} 316 ${shoulder} C356 ${shoulder} 370 118 420 118`}
        fill="none"
        stroke={`url(#wave-${signal.id})`}
        strokeWidth="4"
        strokeLinecap="round"
        className="swells-r1-wave"
      />
      <path
        d="M0 121 H420"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        strokeDasharray="4 9"
      />
    </svg>
  );
}

function TemperatureSurface({
  projection,
  onExplore,
}: {
  projection: SwellsSurfaceProjection;
  onExplore: () => void;
}) {
  const reading = projection.temperature;
  const colour = TEMPERATURE_COLOURS[reading.index] ?? TEMPERATURE_COLOURS[0];
  const trend =
    reading.trend === "warming"
      ? "warming ↑"
      : reading.trend === "cooling"
        ? "cooling ↓"
        : reading.trend === "steady"
          ? "steady →"
          : "this period";

  return (
    <button
      type="button"
      onClick={onExplore}
      className="relative flex min-h-0 flex-1 flex-col items-center justify-between overflow-hidden rounded-[34px] border border-white/[0.06] px-7 pb-8 pt-7 text-center"
      style={{
        background:
          `radial-gradient(circle at 50% 45%, ${colour}55 0%, ${colour}22 27%, rgba(10,14,26,0.2) 62%, rgba(10,14,26,0.78) 100%)`,
      }}
    >
      <div className="z-10 flex w-full items-center justify-between text-[0.66rem] uppercase tracking-[0.2em] text-white/55">
        <span>The temperature of things</span>
        <span>{trend}</span>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div
          className="mb-5 h-36 w-36 rounded-full blur-[1px]"
          style={{
            background: `radial-gradient(circle at 42% 38%, #ffffff99, ${colour} 42%, ${colour}55 68%, transparent 72%)`,
            boxShadow: `0 0 70px ${colour}66`,
          }}
        />
        <div className="font-display text-[3.45rem] font-light leading-none tracking-tight text-text-primary">
          {reading.label}
        </div>
        <p className="mt-3 max-w-[300px] text-[0.82rem] leading-relaxed text-text-secondary">
          Warm means energised or urgent. Cool means calm, reflective or uncertain.
          Neither is better.
        </p>
      </div>

      <div className="z-10 flex w-full items-end justify-between text-left">
        <div>
          <div className="text-[1.2rem] font-medium text-text-primary">
            {reading.observationCount}
          </div>
          <div className="text-[0.68rem] uppercase tracking-[0.16em] text-text-muted">
            observations
          </div>
        </div>
        <div className="text-right text-[0.72rem] leading-relaxed text-text-muted">
          Tap to see
          <br />
          what is forming
        </div>
      </div>
    </button>
  );
}

function HorizonSurface({
  signal,
  index,
  total,
  onOpen,
}: {
  signal: SwellsSwellReading;
  index: number;
  total: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-0 flex-1 flex-col rounded-[34px] border border-white/[0.06] bg-white/[0.02] px-7 pb-7 pt-7 text-left"
    >
      <div className="flex items-center justify-between text-[0.66rem] uppercase tracking-[0.2em] text-text-muted">
        <span>On the horizon</span>
        <span>
          {index + 1}/{total}
        </span>
      </div>

      <div className="mt-8">
        <div className="font-display text-[2.6rem] font-light leading-[0.95] text-text-primary">
          {signal.title}
        </div>
        <div className="mt-4 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.13em]">
          <span className="text-cool-1">{directionLabel(signal.direction)}</span>
          <span className="text-white/20">•</span>
          <span className="text-text-muted">{strengthLabel(signal.strength)}</span>
        </div>
      </div>

      <div className="my-auto -mx-2">
        <SwellWave signal={signal} />
      </div>

      <div className="flex items-end justify-between gap-5">
        <p className="line-clamp-3 max-w-[270px] text-[0.83rem] leading-relaxed text-text-secondary">
          {signal.description || "A pattern is forming across recent observations."}
        </p>
        <div className="shrink-0 text-right">
          <div className="text-[1.15rem] font-medium text-text-primary">
            {signal.observationCount}
          </div>
          <div className="text-[0.65rem] uppercase tracking-[0.14em] text-text-muted">
            observations
          </div>
        </div>
      </div>
    </button>
  );
}

function SwellSurface({
  spaceId,
  signal,
  onBack,
  onAsk,
}: {
  spaceId: string;
  signal: SwellsSwellReading;
  onBack: () => void;
  onAsk: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[34px] border border-white/[0.06] bg-white/[0.02] px-7 pb-7 pt-7">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-[0.72rem] uppercase tracking-[0.18em] text-text-muted"
        >
          ← Horizon
        </button>
        <span className="text-[0.68rem] uppercase tracking-[0.16em] text-cool-1">
          {directionLabel(signal.direction)}
        </span>
      </div>

      <div className="mt-10 font-display text-[3rem] font-light leading-[0.92] text-text-primary">
        {signal.title}
      </div>

      <p className="mt-6 text-[0.9rem] leading-[1.65] text-text-secondary">
        {signal.description || "A pattern emerging across observations in this space."}
      </p>

      <div className="my-auto">
        <SwellWave signal={signal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="strength" value={strengthLabel(signal.strength)} />
        <Metric label="observations" value={String(signal.observationCount)} />
        <Metric label="voices" value={String(signal.contributorCount)} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[0.62rem] uppercase tracking-[0.11em] text-text-muted">
          Does this interpretation fit?
        </span>
        <R1FeedbackButtons
          spaceId={spaceId}
          signalId={signal.id}
          kind="signal_interpretation"
          mode="signal"
        />
      </div>
      <button
        type="button"
        onClick={onAsk}
        className="mt-3 w-full rounded-[18px] border border-cool-1/20 bg-cool-1/8 py-3 text-[0.68rem] font-medium uppercase tracking-[0.13em] text-cool-1"
      >
        Ask this swell
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.025] px-3 py-3">
      <div className="truncate text-[0.86rem] font-medium text-text-primary">{value}</div>
      <div className="mt-1 text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
    </div>
  );
}

function ChangeSurface({
  projection,
  changeIndex,
}: {
  projection: SwellsSurfaceProjection;
  changeIndex: number;
}) {
  const change = projection.changes[changeIndex];
  if (!change) return null;

  const signal = projection.swells.find((item) => item.id === change.signalId);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[34px] border border-white/[0.06] bg-white/[0.02] px-7 pb-8 pt-7">
      <div className="flex items-center justify-between text-[0.66rem] uppercase tracking-[0.2em] text-text-muted">
        <span>Something changed</span>
        <span>
          {changeIndex + 1}/{projection.changes.length}
        </span>
      </div>

      <div className="my-auto">
        <div className="mb-5 text-[0.72rem] uppercase tracking-[0.18em] text-warm-3">
          {change.reason === "new" ? "A new swell is forming" : "This swell is strengthening"}
        </div>
        <h2 className="font-display text-[3.25rem] font-light leading-[0.92] text-text-primary">
          {change.title}
        </h2>
        <p className="mt-7 text-[0.9rem] leading-[1.65] text-text-secondary">
          {signal?.description ||
            `${change.observationCount} observations now point in this direction.`}
        </p>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[1.25rem] font-medium text-text-primary">
            {change.observationCount}
          </div>
          <div className="text-[0.65rem] uppercase tracking-[0.14em] text-text-muted">
            observations
          </div>
        </div>
        <span className="text-[0.7rem] text-text-muted">Wheel for next</span>
      </div>
    </div>
  );
}

function NoticeSurface({
  spaceId,
  onDone,
  onCancel,
}: {
  spaceId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const clean = text.trim();
    if (!clean || isPending) return;
    setError("");

    const form = new FormData();
    form.set("spaceId", spaceId);
    form.set("text", clean);

    startTransition(async () => {
      try {
        await createObservation(form);
        deviceHaptic(28);
        setSaved(true);
        setText("");
        router.refresh();
        window.setTimeout(onDone, 650);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save that observation.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[34px] border border-white/[0.06] bg-white/[0.025] px-7 pb-7 pt-7">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-[0.7rem] uppercase tracking-[0.17em] text-text-muted"
        >
          Cancel
        </button>
        <span className="text-[0.68rem] uppercase tracking-[0.17em] text-warm-3">
          Notice
        </span>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-[3.15rem] font-light leading-[0.94] text-text-primary">
          What are you noticing?
        </h2>
        <p className="mt-4 max-w-[330px] text-[0.82rem] leading-relaxed text-text-secondary">
          Capture the observation first. Swells can work out what it may connect to afterwards.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write it here…"
        maxLength={5000}
        className="my-7 min-h-0 flex-1 resize-none rounded-[24px] border border-white/[0.07] bg-black/10 p-5 text-[1rem] leading-relaxed text-text-primary outline-none placeholder:text-text-muted/60 focus:border-cool-1/30"
      />

      {error ? <p className="mb-3 text-[0.72rem] text-warm-1">{error}</p> : null}

      <R1VoiceNoticeButton
        spaceId={spaceId}
        disabled={isPending || saved}
        onError={setError}
        onSaved={() => {
          setSaved(true);
          setText("");
          router.refresh();
          window.setTimeout(onDone, 650);
        }}
      />

      <div className="my-2 text-center text-[0.62rem] uppercase tracking-[0.16em] text-text-muted">
        or write it
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!text.trim() || isPending || saved}
        className="w-full rounded-[22px] border border-cool-1/25 bg-cool-1/10 py-4 text-[0.82rem] font-medium uppercase tracking-[0.14em] text-cool-1 disabled:opacity-35"
      >
        {saved ? "Noticed ✓" : isPending ? "Saving…" : "Keep this"}
      </button>
    </div>
  );
}

export function R1SwellsSurface({
  projection,
  spaceName,
  canCapture,
}: {
  projection: SwellsSurfaceProjection;
  spaceName: string;
  canCapture: boolean;
}) {
  const [lens, setLens] = useState<SwellsLens>(projection.defaultLens);
  const [signalIndex, setSignalIndex] = useState(0);
  const [changeIndex, setChangeIndex] = useState(0);
  const pointerStart = useRef<number | null>(null);

  const signals = projection.swells;
  const signal = signals[Math.min(signalIndex, Math.max(0, signals.length - 1))];

  const primaryLenses = useMemo(
    () =>
      (["temperature", "horizon", "change"] as SwellsLens[]).filter((candidate) =>
        projection.availableLenses.includes(candidate)
      ),
    [projection.availableLenses]
  );

  function selectLens(next: SwellsLens) {
    deviceHaptic(12);
    setLens(next);
  }

  function step(delta: number) {
    deviceHaptic(10);

    if (lens === "horizon" || lens === "swell") {
      if (!signals.length) return;
      setSignalIndex((current) => (current + delta + signals.length) % signals.length);
      return;
    }

    if (lens === "change" && projection.changes.length) {
      setChangeIndex(
        (current) =>
          (current + delta + projection.changes.length) % projection.changes.length
      );
      return;
    }

    if (lens === "temperature" && delta > 0 && signals.length) {
      setLens("horizon");
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      step(event.key === "ArrowDown" ? 1 : -1);
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lens, signals.length, projection.changes.length]);

  function pointerDown(event: React.PointerEvent) {
    pointerStart.current = event.clientX;
  }

  function pointerUp(event: React.PointerEvent) {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < 45) return;
    step(delta < 0 ? 1 : -1);
  }

  return (
    <main
      className="mx-auto flex h-svh w-full max-w-[480px] select-none flex-col overflow-hidden bg-deep px-4 pb-4 pt-4 text-text-primary"
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      data-swells-surface="r1"
    >
      <header className="mb-3 flex h-9 shrink-0 items-center justify-between px-2">
        <em
          className="font-display text-[1.45rem] font-light tracking-wide text-cool-1"
          style={{ fontStyle: "italic" }}
        >
          swells
        </em>
        <span className="max-w-[230px] truncate text-[0.68rem] uppercase tracking-[0.16em] text-text-muted">
          {spaceName}
        </span>
      </header>

      {lens === "notice" ? (
        <NoticeSurface
          spaceId={projection.spaceId}
          onCancel={() => setLens("temperature")}
          onDone={() => setLens("temperature")}
        />
      ) : lens === "temperature" ? (
        <TemperatureSurface
          projection={projection}
          onExplore={() => signals.length && setLens("horizon")}
        />
      ) : lens === "horizon" && signal ? (
        <HorizonSurface
          signal={signal}
          index={signalIndex}
          total={signals.length}
          onOpen={() => setLens("swell")}
        />
      ) : lens === "swell" && signal ? (
        <SwellSurface
          spaceId={projection.spaceId}
          signal={signal}
          onBack={() => setLens("horizon")}
          onAsk={() => setLens("ask")}
        />
      ) : lens === "ask" && signal ? (
        <R1AskSwellSurface
          spaceId={projection.spaceId}
          signal={signal}
          onBack={() => setLens("swell")}
        />
      ) : lens === "change" ? (
        <ChangeSurface projection={projection} changeIndex={changeIndex} />
      ) : (
        <TemperatureSurface projection={projection} onExplore={() => undefined} />
      )}

      {lens !== "notice" && lens !== "swell" && lens !== "ask" ? (
        <nav
          aria-label="Swells R1 views"
          className="mt-3 flex h-12 shrink-0 items-center gap-2 rounded-[20px] border border-white/[0.05] bg-white/[0.025] p-1.5"
        >
          {primaryLenses.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => selectLens(item)}
              className={`h-full flex-1 rounded-[14px] px-2 text-[0.66rem] uppercase tracking-[0.1em] transition-colors ${
                lens === item
                  ? "bg-white/[0.08] text-text-primary"
                  : "text-text-muted"
              }`}
            >
              {LENS_LABELS[item]}
            </button>
          ))}
          {canCapture && projection.availableLenses.includes("notice") ? (
            <button
              type="button"
              onClick={() => selectLens("notice")}
              className="h-full rounded-[14px] border border-warm-3/20 bg-warm-3/8 px-4 text-[0.68rem] uppercase tracking-[0.11em] text-warm-3"
            >
              Notice
            </button>
          ) : null}
        </nav>
      ) : null}

      <style jsx global>{`
        @keyframes swells-r1-drift {
          0%, 100% { transform: translateY(0px); opacity: 0.86; }
          50% { transform: translateY(-3px); opacity: 1; }
        }

        .swells-r1-wave {
          animation: swells-r1-drift 5.5s ease-in-out infinite;
          transform-origin: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .swells-r1-wave {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}

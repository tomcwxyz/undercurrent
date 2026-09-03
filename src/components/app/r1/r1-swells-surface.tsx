"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createObservation } from "@/app/(app)/actions";
import { R1VoiceNoticeButton } from "@/components/app/r1/r1-voice-notice-button";
import { R1AskSwellSurface } from "@/components/app/r1/r1-ask-swell-surface";
import { R1FeedbackButtons } from "@/components/app/r1/r1-feedback-buttons";
import { R1CaptureReviewSurface } from "@/components/app/r1/r1-capture-review-surface";
import { R1TemperatureGrid } from "@/components/app/r1/r1-temperature-grid";
import {
  R1SpacePicker,
  type R1SpaceOption,
} from "@/components/app/r1/r1-space-picker";
import { nativeSwellsDevice } from "@/lib/r1/device";
import { useR1CaptureReview } from "@/lib/r1/use-capture-review";
import { recordR1Interaction } from "@/lib/r1/telemetry";
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
  temperature: "Temp",
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
      className="h-[88px] w-full overflow-visible"
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
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] px-5 pb-5 pt-5 text-left"
      style={{
        background:
          `radial-gradient(circle at 50% 42%, ${colour}24 0%, rgba(10,14,26,0.08) 48%, rgba(10,14,26,0.72) 100%)`,
      }}
    >
      <div className="z-10 flex w-full items-center justify-between text-[0.58rem] uppercase tracking-[0.16em] text-white/55">
        <span>The temperature of things</span>
        <span>{trend}</span>
      </div>

      <div className="z-10 my-auto w-full py-4">
        <R1TemperatureGrid reading={reading} />
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="font-display text-[2.65rem] font-light leading-none tracking-tight text-text-primary">
              {reading.label}
            </div>
            <div className="mt-1 text-[0.58rem] uppercase tracking-[0.14em] text-text-muted">
              current reading
            </div>
          </div>
          <div className="text-right">
            <div className="text-[1.05rem] font-medium text-text-primary">
              {reading.observationCount}
            </div>
            <div className="text-[0.56rem] uppercase tracking-[0.12em] text-text-muted">
              observations
            </div>
          </div>
        </div>
      </div>

      <div className="z-10 flex w-full items-end justify-between gap-5 border-t border-white/[0.045] pt-3">
        <p className="max-w-[275px] text-[0.66rem] leading-relaxed text-text-muted">
          Warm is energy or urgency. Cool is calm, reflection or uncertainty.
        </p>
        <span className="shrink-0 text-[0.6rem] text-text-muted">Tap for horizon →</span>
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5 text-left"
    >
      <div className="flex items-center justify-between text-[0.66rem] uppercase tracking-[0.2em] text-text-muted">
        <span>On the horizon</span>
        <span>
          {index + 1}/{total}
        </span>
      </div>

      <div className="mt-5 min-h-0">
        <div className="line-clamp-3 font-display text-[clamp(1.6rem,7vw,2.25rem)] font-light leading-[0.97] text-text-primary">
          {signal.title}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.11em]">
          <span className="text-cool-1">{directionLabel(signal.direction)}</span>
          <span className="text-white/20">•</span>
          <span className="text-text-muted">{strengthLabel(signal.strength)}</span>
        </div>
      </div>

      <div className="my-2 flex min-h-0 flex-1 items-center -mx-2">
        <SwellWave signal={signal} />
      </div>

      <div className="flex items-end justify-between gap-5">
        <p className="line-clamp-2 max-w-[275px] text-[0.72rem] leading-relaxed text-text-secondary">
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5">
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

      <div className="mt-5 line-clamp-3 font-display text-[clamp(1.65rem,7vw,2.25rem)] font-light leading-[0.96] text-text-primary">
        {signal.title}
      </div>

      <p className="mt-3 line-clamp-3 text-[0.72rem] leading-[1.5] text-text-secondary">
        {signal.description || "A pattern emerging across observations in this space."}
      </p>

      <div className="my-1 flex min-h-0 flex-1 items-center">
        <SwellWave signal={signal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="strength" value={strengthLabel(signal.strength)} />
        <Metric label="observations" value={String(signal.observationCount)} />
        <Metric label="voices" value={String(signal.contributorCount)} />
      </div>
      <div className="mt-2">
        <div className="mb-1 text-[0.56rem] uppercase tracking-[0.1em] text-text-muted">
          Does this interpretation fit?
        </div>
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
        className="mt-2 w-full rounded-[16px] border border-cool-1/20 bg-cool-1/8 py-2.5 text-[0.62rem] font-medium uppercase tracking-[0.11em] text-cool-1"
      >
        Ask this swell
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] px-2 py-2">
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
  onOpen,
}: {
  projection: SwellsSurfaceProjection;
  changeIndex: number;
  onOpen: (signalId: string) => void;
}) {
  const change = projection.changes[changeIndex];
  if (!change) return null;

  const signal = projection.swells.find((item) => item.id === change.signalId);

  return (
    <button
      type="button"
      onClick={() => onOpen(change.signalId)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5 text-left"
    >
      <div className="flex items-center justify-between text-[0.66rem] uppercase tracking-[0.2em] text-text-muted">
        <span>Something changed</span>
        <span>
          {changeIndex + 1}/{projection.changes.length}
        </span>
      </div>

      <div className="my-auto min-h-0 py-4">
        <div className="mb-3 text-[0.6rem] uppercase tracking-[0.14em] text-warm-3">
          {change.reason === "new" ? "A new swell is forming" : "This swell is strengthening"}
        </div>
        <h2 className="line-clamp-4 font-display text-[clamp(1.75rem,7.5vw,2.45rem)] font-light leading-[0.96] text-text-primary">
          {change.title}
        </h2>
        <p className="mt-4 line-clamp-3 text-[0.72rem] leading-[1.5] text-text-secondary">
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
        <span className="text-[0.6rem] text-text-muted">Tap to open · wheel for next</span>
      </div>
    </button>
  );
}

function NoticeSurface({
  spaceId,
  onDone,
  onCancel,
  onCaptured,
}: {
  spaceId: string;
  onDone: () => void;
  onCancel: () => void;
  onCaptured: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showText, setShowText] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const clean = text.trim();
    if (!clean || isPending) return;
    setError("");

    const form = new FormData();
    form.set("spaceId", spaceId);
    form.set("surface", "r1");
    form.set("text", clean);

    startTransition(async () => {
      try {
        await createObservation(form);
        deviceHaptic(28);
        setSaved(true);
        setText("");
        onCaptured();
        router.refresh();
        window.setTimeout(onDone, 650);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save that observation.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.025] px-5 pb-5 pt-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-[0.62rem] uppercase tracking-[0.14em] text-text-muted"
        >
          Cancel
        </button>
        <span className="text-[0.6rem] uppercase tracking-[0.14em] text-warm-3">
          Notice
        </span>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-[2.5rem] font-light leading-[0.96] text-text-primary">
          What are you noticing?
        </h2>
        <p className="mt-3 max-w-[330px] text-[0.72rem] leading-relaxed text-text-secondary">
          Say the observation. Swells can work out what it may connect to afterwards.
        </p>
      </div>

      {!showText ? (
        <div className="my-auto py-5">
          <R1VoiceNoticeButton
            spaceId={spaceId}
            disabled={isPending || saved}
            onError={setError}
            onSaved={() => {
              setSaved(true);
              setText("");
              onCaptured();
              router.refresh();
              window.setTimeout(onDone, 650);
            }}
          />
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="mt-3 w-full py-2 text-center text-[0.6rem] uppercase tracking-[0.12em] text-text-muted"
          >
            Type instead
          </button>
        </div>
      ) : (
        <div className="my-auto min-h-0 py-4">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write it here…"
            maxLength={5000}
            rows={4}
            className="h-28 w-full resize-none rounded-[18px] border border-white/[0.07] bg-black/10 p-4 text-[0.86rem] leading-relaxed text-text-primary outline-none placeholder:text-text-muted/60 focus:border-cool-1/30"
          />
          <div className="mt-3 grid grid-cols-[0.7fr_1.3fr] gap-2">
            <button
              type="button"
              onClick={() => setShowText(false)}
              className="rounded-[16px] border border-white/[0.06] px-3 py-3 text-[0.6rem] uppercase tracking-[0.11em] text-text-muted"
            >
              Voice
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || isPending || saved}
              className="rounded-[16px] border border-cool-1/25 bg-cool-1/10 px-3 py-3 text-[0.64rem] font-medium uppercase tracking-[0.11em] text-cool-1 disabled:opacity-35"
            >
              {saved ? "Noticed ✓" : isPending ? "Saving…" : "Keep this"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-2 text-[0.66rem] leading-relaxed text-warm-1">{error}</p> : null}

      <div className="border-t border-white/[0.045] pt-3 text-[0.58rem] uppercase tracking-[0.1em] text-text-muted">
        Voice-first on Rabbit · your notice is kept before analysis
      </div>
    </div>
  );
}

export function R1SwellsSurface({
  projection,
  spaceName,
  spaces,
  canCapture,
}: {
  projection: SwellsSurfaceProjection;
  spaceName: string;
  spaces: R1SpaceOption[];
  canCapture: boolean;
}) {
  const [lens, setLens] = useState<SwellsLens>(projection.defaultLens);
  const [signalIndex, setSignalIndex] = useState(0);
  const [changeIndex, setChangeIndex] = useState(0);
  const [spacePickerOpen, setSpacePickerOpen] = useState(false);
  const currentSpaceIndex = Math.max(
    0,
    spaces.findIndex((space) => space.id === projection.spaceId),
  );
  const [spacePickerIndex, setSpacePickerIndex] = useState(currentSpaceIndex);
  const pointerStart = useRef<number | null>(null);
  const reviewSeenRef = useRef<string | null>(null);
  const router = useRouter();
  const captureReview = useR1CaptureReview(projection.spaceId);

  const signals = projection.swells;
  const signal = signals[Math.min(signalIndex, Math.max(0, signals.length - 1))];

  useEffect(() => {
    document.cookie = `swells-r1-space=${projection.spaceId}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [projection.spaceId]);

  useEffect(() => {
    setSpacePickerIndex(currentSpaceIndex);
  }, [currentSpaceIndex]);

  const primaryLenses = useMemo(
    () =>
      (["temperature", "horizon", "change"] as SwellsLens[]).filter((candidate) =>
        projection.availableLenses.includes(candidate)
      ),
    [projection.availableLenses]
  );

  useEffect(() => {
    recordR1Interaction({
      spaceId: projection.spaceId,
      event: "surface_open",
      lens: projection.defaultLens,
    });
  }, [projection.defaultLens, projection.spaceId]);

  useEffect(() => {
    if (captureReview.review) return;
    recordR1Interaction({
      spaceId: projection.spaceId,
      event: "lens_view",
      lens,
      signalId:
        lens === "horizon" || lens === "swell" || lens === "ask"
          ? signal?.id
          : undefined,
    });
  }, [captureReview.review, lens, projection.spaceId, signal?.id]);

  useEffect(() => {
    if (!captureReview.review || reviewSeenRef.current === captureReview.review.id) {
      return;
    }
    reviewSeenRef.current = captureReview.review.id;
    recordR1Interaction({
      spaceId: projection.spaceId,
      event: "capture_review_opened",
      observationId: captureReview.review.observationId,
      metadata: { processing: captureReview.review.processing },
    });
  }, [captureReview.review, projection.spaceId]);

  function stepSpace(delta: number) {
    if (!spaces.length) return;
    deviceHaptic(10);
    setSpacePickerIndex(
      (current) => (current + delta + spaces.length) % spaces.length,
    );
  }

  function openSpace(space: R1SpaceOption) {
    document.cookie = `swells-r1-space=${space.id}; Path=/; Max-Age=31536000; SameSite=Lax`;
    deviceHaptic(18);
    setSpacePickerOpen(false);
    router.push(`/r1/${space.id}`);
  }

  function selectLens(next: SwellsLens) {
    deviceHaptic(12);
    setLens(next);
  }

  function step(delta: number) {
    deviceHaptic(10);
    recordR1Interaction({
      spaceId: projection.spaceId,
      event: "navigate",
      lens,
      signalId: signal?.id,
      metadata: { delta },
    });

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
      if (spacePickerOpen) {
        stepSpace(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      step(event.key === "ArrowDown" ? 1 : -1);
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lens, signals.length, projection.changes.length, spacePickerOpen, spaces.length]);

  async function handleReviewDecision(
    decision: "keep_connection" | "keep_separate",
  ) {
    const current = captureReview.review;
    if (!current) return;

    const saved = await captureReview.decide(decision);
    if (!saved) return;

    recordR1Interaction({
      spaceId: projection.spaceId,
      event: "capture_reviewed",
      observationId: current.observationId,
      signalId: current.signals[0]?.id,
      metadata: {
        decision,
        signalCount: current.signals.length,
      },
    });
    deviceHaptic(24);
    router.refresh();
  }

  function pointerDown(event: React.PointerEvent) {
    pointerStart.current = event.clientX;
  }

  function pointerUp(event: React.PointerEvent) {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < 45) return;
    if (spacePickerOpen) {
      stepSpace(delta < 0 ? 1 : -1);
      return;
    }
    step(delta < 0 ? 1 : -1);
  }

  return (
    <main
      className="mx-auto flex h-svh w-full max-w-[480px] select-none flex-col overflow-hidden bg-deep px-3 pb-3 pt-3 text-text-primary"
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      data-swells-surface="r1"
    >
      <header className="mb-2 flex h-8 shrink-0 items-center justify-between px-2">
        <em
          className="font-display text-[1.32rem] font-light tracking-wide text-cool-1"
          style={{ fontStyle: "italic" }}
        >
          swells
        </em>
        <button
          type="button"
          onClick={() => {
            if (spaces.length > 1) {
              deviceHaptic(10);
              setSpacePickerIndex(currentSpaceIndex);
              setSpacePickerOpen(true);
            }
          }}
          className="max-w-[270px] truncate text-[0.6rem] uppercase tracking-[0.13em] text-text-muted"
          aria-label={spaces.length > 1 ? "Change Swells space" : undefined}
        >
          {spaceName}{spaces.length > 1 ? "  ▾" : ""}
        </button>
      </header>

      {spacePickerOpen ? (
        <R1SpacePicker
          spaces={spaces}
          selectedIndex={spacePickerIndex}
          onStep={stepSpace}
          onOpen={openSpace}
          onCancel={() => setSpacePickerOpen(false)}
        />
      ) : captureReview.review ? (
        <R1CaptureReviewSurface
          review={captureReview.review}
          deciding={captureReview.deciding}
          error={captureReview.error}
          onDecision={(decision) => void handleReviewDecision(decision)}
        />
      ) : lens === "notice" ? (
        <NoticeSurface
          spaceId={projection.spaceId}
          onCancel={() => setLens("temperature")}
          onDone={() => setLens("temperature")}
          onCaptured={() => {
            recordR1Interaction({
              spaceId: projection.spaceId,
              event: "capture_saved",
              lens: "notice",
            });
            void captureReview.refresh();
          }}
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
        <ChangeSurface
          projection={projection}
          changeIndex={changeIndex}
          onOpen={(signalId) => {
            const index = signals.findIndex((item) => item.id === signalId);
            if (index >= 0) setSignalIndex(index);
            setLens("swell");
          }}
        />
      ) : (
        <TemperatureSurface projection={projection} onExplore={() => undefined} />
      )}

      {!spacePickerOpen &&
      !captureReview.review &&
      lens !== "notice" &&
      lens !== "swell" &&
      lens !== "ask" ? (
        <nav
          aria-label="Swells R1 views"
          className="mt-2 flex h-10 shrink-0 items-center gap-1 rounded-[16px] border border-white/[0.05] bg-white/[0.025] p-1"
        >
          {[
            ...primaryLenses,
            ...(canCapture && projection.availableLenses.includes("notice")
              ? (["notice"] as SwellsLens[])
              : []),
          ].map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => selectLens(item)}
              className={`h-full min-w-0 flex-1 rounded-[12px] px-1 text-[0.56rem] uppercase tracking-[0.07em] transition-colors ${
                lens === item
                  ? "bg-white/[0.08] text-text-primary"
                  : item === "notice"
                    ? "text-warm-3"
                    : "text-text-muted"
              }`}
            >
              {LENS_LABELS[item]}
            </button>
          ))}
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

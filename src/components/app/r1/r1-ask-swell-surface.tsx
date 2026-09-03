"use client";

import { useState } from "react";
import { R1VoiceQuestionButton } from "@/components/app/r1/r1-voice-question-button";
import { R1FeedbackButtons } from "@/components/app/r1/r1-feedback-buttons";
import type { SwellsSwellReading } from "@/lib/surfaces/types";
import {
  nativeSwellsDevice,
  speakR1Text,
  stopR1Speech,
} from "@/lib/r1/device";

type AskResult = {
  answer: string;
  confidence: "low" | "medium" | "high";
  caveat: string | null;
  evidence: {
    id: string;
    createdAt: string;
    preview: string;
  }[];
  evidenceAvailable: number;
};

const QUICK_QUESTIONS = [
  "Why is this strengthening?",
  "What contradicts it?",
  "When did this start?",
  "What might I be missing?",
] as const;

export function R1AskSwellSurface({
  spaceId,
  signal,
  onBack,
}: {
  spaceId: string;
  signal: SwellsSwellReading;
  onBack: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  async function ask(raw: string) {
    const clean = raw.trim();
    if (!clean || asking) return;

    stopR1Speech();
    setQuestion(clean);
    setResult(null);
    setError("");
    setAsking(true);

    try {
      const response = await fetch("/api/r1/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId,
          signalId: signal.id,
          question: clean,
        }),
      });
      const payload = (await response.json()) as {
        data?: AskResult;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Swells could not answer that.");
      }

      setResult(payload.data);
      nativeSwellsDevice()?.haptic?.(18);

      // On the Rabbit, spoken questions should naturally get spoken answers.
      // Browser users can still tap "Read aloud" below.
      if (nativeSwellsDevice()?.speak) {
        speakR1Text(
          payload.data.answer +
            (payload.data.caveat ? " " + payload.data.caveat : ""),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Swells could not answer that.",
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 pb-5 pt-5">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            stopR1Speech();
            onBack();
          }}
          className="text-[0.68rem] uppercase tracking-[0.16em] text-text-muted"
        >
          ← Swell
        </button>
        <span className="max-w-[190px] truncate text-[0.58rem] uppercase tracking-[0.14em] text-cool-1">
          Ask this swell
        </span>
      </div>

      {!result ? (
        <>
          <div className="mt-5">
            <h2 className="font-display text-[2rem] font-light leading-[0.97] text-text-primary">
              What do you want to understand?
            </h2>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-text-secondary">
              Swells will answer only from observations linked to this signal.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {QUICK_QUESTIONS.map((item) => (
              <button
                type="button"
                key={item}
                disabled={asking}
                onClick={() => void ask(item)}
                className="min-h-12 rounded-[15px] border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-left text-[0.66rem] leading-snug text-text-secondary disabled:opacity-40"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-3">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Or ask something else…"
              maxLength={400}
              rows={2}
              className="h-16 w-full resize-none rounded-[16px] border border-white/[0.07] bg-black/10 px-3 py-2 text-[0.74rem] leading-relaxed text-text-primary outline-none placeholder:text-text-muted/60 focus:border-cool-1/30"
            />

            {error ? (
              <p className="mt-2 text-[0.7rem] leading-relaxed text-warm-1">
                {error}
              </p>
            ) : null}

            <div className="mt-2 flex gap-2">
              <R1VoiceQuestionButton
                disabled={asking}
                onError={setError}
                onTranscript={(text) => void ask(text)}
              />
              <button
                type="button"
                disabled={!question.trim() || asking}
                onClick={() => void ask(question)}
                className="flex-1 rounded-[18px] border border-cool-1/25 bg-cool-1/10 px-4 py-3 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-cool-1 disabled:opacity-35"
              >
                {asking ? "Looking…" : "Ask"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 line-clamp-2 text-[0.58rem] uppercase tracking-[0.12em] text-text-muted">
            {question}
          </div>

          <div className="my-auto min-h-0 py-3">
            <p className="line-clamp-6 font-display text-[1.35rem] font-light leading-[1.16] text-text-primary">
              {result.answer}
            </p>
            {result.caveat ? (
              <p className="mt-3 line-clamp-2 text-[0.68rem] leading-relaxed text-text-secondary">
                {result.caveat}
              </p>
            ) : null}
          </div>

          <div className="rounded-[15px] border border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <div className="text-[0.56rem] uppercase tracking-[0.11em] text-text-muted">
              Evidence support · {result.confidence}
            </div>
            <div className="mt-1 text-[0.66rem] text-text-secondary">
              {result.evidence.length
                ? `Based on ${result.evidence.length} linked observation${result.evidence.length === 1 ? "" : "s"}.`
                : `No specific linked observation was strong enough to cite from ${result.evidenceAvailable} available.`}
            </div>
            <div className="mt-3">
              <R1FeedbackButtons
                spaceId={spaceId}
                signalId={signal.id}
                kind="ask_answer"
                question={question}
                answer={result.answer}
                evidenceIds={result.evidence.map((item) => item.id)}
                mode="ask"
              />
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                speakR1Text(
                  result.answer +
                    (result.caveat ? " " + result.caveat : ""),
                )
              }
              className="rounded-[18px] border border-white/[0.07] px-4 py-3 text-[0.66rem] uppercase tracking-[0.12em] text-text-secondary"
            >
              Read aloud
            </button>
            <button
              type="button"
              onClick={() => {
                stopR1Speech();
                setResult(null);
                setQuestion("");
                setError("");
              }}
              className="flex-1 rounded-[18px] border border-cool-1/20 bg-cool-1/8 px-4 py-3 text-[0.66rem] uppercase tracking-[0.12em] text-cool-1"
            >
              Ask another
            </button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SwellsSwellReading } from "@/lib/surfaces/types";

interface AskResult {
  answer: string;
  confidence: "low" | "medium" | "high";
  caveat: string | null;
  evidence: Array<{ id: string; createdAt: string; preview: string }>;
  evidenceAvailable: number;
}

const QUICK = [
  "Why is this strengthening?",
  "What contradicts it?",
  "What changed recently?",
  "What might we be missing?",
] as const;

export function TabletAskPanel({
  spaceId,
  signal,
}: {
  spaceId: string;
  signal: SwellsSwellReading;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(raw: string) {
    const clean = raw.trim();
    if (!clean || loading) return;
    setQuestion(clean);
    setResult(null);
    setError("");
    setLoading(true);
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
      const payload = (await response.json()) as { data?: AskResult; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Swells could not answer that.");
      }
      setResult(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Swells could not answer that.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.58rem] uppercase tracking-[0.14em] text-cool-1">Ask this swell</p>
          <p className="mt-1 line-clamp-1 font-display text-[1.45rem] font-light text-text-primary">
            {signal.title}
          </p>
        </div>
        {result ? (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setQuestion("");
              setError("");
            }}
            className="text-[0.6rem] uppercase tracking-[0.11em] text-text-muted"
          >
            Ask another
          </button>
        ) : null}
      </div>

      {!result ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {QUICK.map((item) => (
              <button
                key={item}
                type="button"
                disabled={loading}
                onClick={() => void ask(item)}
                className="rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-left text-[0.7rem] leading-snug text-text-secondary disabled:opacity-40"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void ask(question);
              }}
              placeholder="Ask from the evidence…"
              maxLength={400}
              className="min-w-0 flex-1 rounded-[18px] border border-white/[0.06] bg-black/10 px-4 py-3 text-[0.78rem] text-text-primary outline-none placeholder:text-text-muted/50 focus:border-cool-1/30"
            />
            <button
              type="button"
              disabled={loading || !question.trim()}
              onClick={() => void ask(question)}
              className="rounded-[18px] border border-cool-1/25 bg-cool-1/10 px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.11em] text-cool-1 disabled:opacity-35"
            >
              {loading ? "Looking…" : "Ask"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <p className="text-[0.6rem] uppercase tracking-[0.11em] text-text-muted">{question}</p>
          <p className="mt-3 font-display text-[1.45rem] font-light leading-[1.16] text-text-primary">
            {result.answer}
          </p>
          {result.caveat ? (
            <p className="mt-3 text-[0.72rem] leading-relaxed text-text-secondary">{result.caveat}</p>
          ) : null}
          <div className="mt-4 border-t border-white/[0.05] pt-3">
            <p className="text-[0.58rem] uppercase tracking-[0.11em] text-text-muted">
              {result.confidence} confidence · {result.evidence.length} cited of {result.evidenceAvailable} available
            </p>
            {result.evidence.length ? (
              <div className="mt-2 space-y-2">
                {result.evidence.slice(0, 3).map((item) => (
                  <p key={item.id} className="line-clamp-2 text-[0.68rem] leading-relaxed text-text-secondary">
                    “{item.preview}”
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-[0.7rem] text-warm-1">{error}</p> : null}
    </section>
  );
}

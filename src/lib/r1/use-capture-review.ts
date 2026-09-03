"use client";

import { useCallback, useEffect, useState } from "react";

export interface R1CaptureReviewSignal {
  id: string;
  title: string;
  description: string | null;
  strength: "strong" | "emerging" | "weak";
  direction: "strengthening" | "steady" | "new";
}

export interface R1CaptureReview {
  id: string;
  observationId: string;
  createdAt: string;
  processing: boolean;
  text: string;
  signals: R1CaptureReviewSignal[];
}

export function useR1CaptureReview(spaceId: string) {
  const [review, setReview] = useState<R1CaptureReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/r1/capture-review?spaceId=${encodeURIComponent(spaceId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        data?: R1CaptureReview | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load capture review.");
      }

      setReview(payload.data ?? null);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load capture review.",
      );
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!review?.processing) return;

    const timer = window.setInterval(() => {
      void refresh();
    }, 1800);

    return () => window.clearInterval(timer);
  }, [review?.processing, refresh]);

  const decide = useCallback(
    async (decision: "keep_connection" | "keep_separate") => {
      if (!review || deciding || review.processing) return false;

      setDeciding(true);
      setError("");
      try {
        const response = await fetch("/api/r1/capture-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewId: review.id, decision }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Could not save review.");
        }

        setReview(null);
        return true;
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not save review.",
        );
        return false;
      } finally {
        setDeciding(false);
      }
    },
    [deciding, review],
  );

  return {
    review,
    loading,
    deciding,
    error,
    refresh,
    decide,
  };
}

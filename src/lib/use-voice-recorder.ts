"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type VoiceStatus = "idle" | "recording";

interface VoiceRecorderReturn {
  status: VoiceStatus;
  elapsed: number;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  discard: () => void;
  error: string | null;
}

export function useVoiceRecorder(): VoiceRecorderReturn {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        resolveStopRef.current?.(blob);
        resolveStopRef.current = null;
      };

      recorder.start();
      setStatus("recording");

      const startTime = new Date().getTime();
      timerRef.current = setInterval(() => {
        const now = new Date().getTime();
        setElapsed(Math.floor((now - startTime) / 1000));
      }, 200);
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access denied");
      } else {
        setError("Could not start recording");
      }
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return null;
    }
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;
      recorderRef.current!.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
      setStatus("idle");
    });
  }, []);

  const discard = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    resolveStopRef.current?.(null);
    resolveStopRef.current = null;
    cleanup();
  }, [cleanup]);

  return { status, elapsed, start, stop, discard, error };
}

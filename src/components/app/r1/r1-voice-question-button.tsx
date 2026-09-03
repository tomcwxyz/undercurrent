"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import {
  blobFromBase64,
  extensionForMime,
  hasNativeSwellsRecorder,
  nativeSwellsDevice,
  parseNativeRecordingResult,
  stopR1Speech,
} from "@/lib/r1/device";

async function transcribeQuestion(blob: Blob) {
  const mimeType = blob.type || "audio/webm";
  const file = new File(
    [blob],
    `swells-question.${extensionForMime(mimeType)}`,
    { type: mimeType },
  );
  const form = new FormData();
  form.set("audio", file);

  const response = await fetch("/api/r1/transcribe", {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as { text?: string; error?: string };
  if (!response.ok || !data.text) {
    throw new Error(data.error || "Voice transcription failed.");
  }
  return data.text;
}

export function R1VoiceQuestionButton({
  disabled,
  onTranscript,
  onError,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}) {
  const browserRecorder = useVoiceRecorder();
  const [nativeRecording, setNativeRecording] = useState(false);
  const [nativeElapsed, setNativeElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeRecordingRef = useRef(false);

  const recording =
    nativeRecording || browserRecorder.status === "recording";
  const elapsed =
    nativeRecording ? nativeElapsed : browserRecorder.elapsed;

  useEffect(() => {
    return () => {
      if (nativeRecordingRef.current) {
        nativeSwellsDevice()?.cancelVoiceRecording?.();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (browserRecorder.error) onError(browserRecorder.error);
  }, [browserRecorder.error, onError]);

  async function finish(blob: Blob | null) {
    if (!blob?.size) {
      onError("The recording was empty.");
      return;
    }

    setTranscribing(true);
    onError("");
    try {
      onTranscript(await transcribeQuestion(blob));
    } catch (cause) {
      onError(
        cause instanceof Error
          ? cause.message
          : "Swells could not transcribe that question.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function start() {
    if (disabled || recording || transcribing) return;
    onError("");
    stopR1Speech();

    if (hasNativeSwellsRecorder()) {
      const result =
        nativeSwellsDevice()?.startVoiceRecording?.() ?? "";
      if (result !== "started") {
        const diagnostic = nativeSwellsDevice()?.microphoneState?.();
        console.warn("Swells R1 question recording could not start", {
          result,
          diagnostic,
        });
        onError(
          result === "permission_denied"
            ? "Microphone access is not allowed for Swells."
            : result.startsWith("error:")
              ? result.slice("error:".length).replaceAll(":", " · ")
              : "Could not start the Rabbit microphone.",
        );
        return;
      }

      nativeRecordingRef.current = true;
      setNativeElapsed(0);
      setNativeRecording(true);
      timerRef.current = setInterval(() => {
        setNativeElapsed((current) => current + 1);
      }, 1000);
      return;
    }

    await browserRecorder.start();
  }

  async function stop() {
    if (!recording || transcribing) return;

    if (nativeRecording) {
      nativeRecordingRef.current = false;
      setNativeRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      const result = parseNativeRecordingResult(
        nativeSwellsDevice()?.stopVoiceRecording?.() ?? "",
      );
      setNativeElapsed(0);

      if (!result.ok || !result.base64) {
        onError(
          result.error === "empty_recording"
            ? "The recording was empty."
            : "The Rabbit could not finish this recording" +
                (result.error ? ": " + result.error : "."),
        );
        return;
      }

      await finish(
        blobFromBase64(
          result.base64,
          result.mimeType || "audio/mp4",
        ),
      );
      return;
    }

    await finish(await browserRecorder.stop());
  }

  const label = transcribing
    ? "Listening…"
    : recording
      ? `Stop · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
      : "Ask by voice";

  return (
    <button
      type="button"
      onClick={() => void (recording ? stop() : start())}
      disabled={disabled || transcribing}
      className={`rounded-[18px] border px-4 py-3 text-[0.68rem] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-40 ${
        recording
          ? "border-warm-1/40 bg-warm-1/12 text-warm-1"
          : "border-cool-1/20 bg-cool-1/8 text-cool-1"
      }`}
    >
      {recording ? (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
      ) : null}
      {label}
    </button>
  );
}

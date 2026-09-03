"use client";

import { useEffect, useRef, useState } from "react";
import { createObservation } from "@/app/(app)/actions";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";

type NativeRecordingResult = {
  ok?: boolean;
  mimeType?: string;
  base64?: string;
  error?: string;
};

type NativeSwellsDevice = {
  haptic?: (milliseconds: number) => void;
  startVoiceRecording?: () => string;
  stopVoiceRecording?: () => string;
  cancelVoiceRecording?: () => string;
  microphoneState?: () => string;
};

function nativeDevice(): NativeSwellsDevice | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { SwellsDevice?: NativeSwellsDevice }).SwellsDevice;
}

function hasNativeRecorder() {
  const device = nativeDevice();
  return (
    typeof device?.startVoiceRecording === "function" &&
    typeof device?.stopVoiceRecording === "function"
  );
}

function parseNativeResult(raw: string): NativeRecordingResult {
  try {
    return JSON.parse(raw) as NativeRecordingResult;
  } catch {
    return { ok: false, error: raw || "Invalid native recording response" };
  }
}

function blobFromBase64(base64: string, mimeType: string) {
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function extensionFor(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

async function saveVoiceObservation(spaceId: string, blob: Blob) {
  const mimeType = blob.type || "audio/webm";
  const fileName = `r1-notice-${Date.now()}.${extensionFor(mimeType)}`;

  const presignResponse = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName,
      contentType: mimeType,
      spaceId,
      fileSize: blob.size,
    }),
  });

  const presign = (await presignResponse.json()) as {
    uploadUrl?: string;
    key?: string;
    publicUrl?: string;
    mediaType?: "image" | "voice" | "file";
    error?: string;
  };

  if (
    !presignResponse.ok ||
    !presign.uploadUrl ||
    !presign.key ||
    !presign.publicUrl ||
    presign.mediaType !== "voice"
  ) {
    throw new Error(presign.error || "Could not prepare the voice observation.");
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": mimeType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("The voice recording could not be uploaded.");
  }

  const form = new FormData();
  form.set("spaceId", spaceId);
  form.set(
    "mediaKeys",
    JSON.stringify([
      {
        key: presign.key,
        url: presign.publicUrl,
        type: "voice",
        fileName,
        mimeType,
        fileSize: blob.size,
      },
    ]),
  );

  await createObservation(form);
}

export function R1VoiceNoticeButton({
  spaceId,
  disabled,
  onSaved,
  onError,
}: {
  spaceId: string;
  disabled?: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const browserRecorder = useVoiceRecorder();
  const [nativeRecording, setNativeRecording] = useState(false);
  const [nativeElapsed, setNativeElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeRecordingRef = useRef(false);

  const recording = nativeRecording || browserRecorder.status === "recording";
  const elapsed = nativeRecording ? nativeElapsed : browserRecorder.elapsed;

  useEffect(() => {
    return () => {
      if (nativeRecordingRef.current) nativeDevice()?.cancelVoiceRecording?.();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (browserRecorder.error) onError(browserRecorder.error);
  }, [browserRecorder.error, onError]);

  async function persist(blob: Blob | null) {
    if (!blob?.size) {
      onError("The recording was empty.");
      return;
    }

    setSaving(true);
    onError("");
    try {
      await saveVoiceObservation(spaceId, blob);
      nativeDevice()?.haptic?.(30);
      setSaved(true);
      window.setTimeout(onSaved, 650);
    } catch (cause) {
      onError(
        cause instanceof Error
          ? cause.message
          : "Could not save the voice observation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function start() {
    if (disabled || recording || saving || saved) return;
    onError("");

    if (hasNativeRecorder()) {
      const result = nativeDevice()?.startVoiceRecording?.() ?? "";
      if (result !== "started") {
        const diagnostic = nativeDevice()?.microphoneState?.();
        console.warn("Swells native voice capture could not start", {
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
    if (!recording || saving) return;

    if (nativeRecording) {
      setNativeRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      const result = parseNativeResult(
        nativeDevice()?.stopVoiceRecording?.() ?? "",
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

      const mimeType = result.mimeType || "audio/mp4";
      await persist(blobFromBase64(result.base64, mimeType));
      return;
    }

    await persist(await browserRecorder.stop());
  }

  const label = saved
    ? "Noticed ✓"
    : saving
      ? "Keeping voice note…"
      : recording
        ? `Stop · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
        : "Record voice";

  return (
    <button
      type="button"
      onClick={() => void (recording ? stop() : start())}
      disabled={disabled || saving || saved}
      className={`w-full rounded-[22px] border py-4 text-[0.82rem] font-medium uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${
        recording
          ? "border-warm-1/40 bg-warm-1/12 text-warm-1"
          : "border-warm-3/25 bg-warm-3/8 text-warm-3"
      }`}
    >
      {recording ? (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
      ) : null}
      {label}
    </button>
  );
}

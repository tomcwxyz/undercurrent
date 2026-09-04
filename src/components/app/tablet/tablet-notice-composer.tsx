"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

async function uploadVoice(spaceId: string, blob: Blob) {
  const mimeType = blob.type || "audio/webm";
  const fileName = `tablet-notice-${Date.now()}.${extensionForMime(mimeType)}`;
  const response = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName,
      contentType: mimeType,
      spaceId,
      fileSize: blob.size,
    }),
  });
  const payload = (await response.json()) as {
    uploadUrl?: string;
    key?: string;
    publicUrl?: string;
    mediaType?: "image" | "voice" | "file";
    error?: string;
  };
  if (
    !response.ok ||
    !payload.uploadUrl ||
    !payload.key ||
    !payload.publicUrl ||
    payload.mediaType !== "voice"
  ) {
    throw new Error(payload.error || "Could not prepare the recording.");
  }

  const upload = await fetch(payload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": mimeType },
    body: blob,
  });
  if (!upload.ok) throw new Error("Could not upload the recording.");

  return {
    key: payload.key,
    url: payload.publicUrl,
    type: "voice" as const,
    fileName,
    mimeType,
    fileSize: blob.size,
  };
}

export function TabletNoticeComposer({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const recorder = useVoiceRecorder();
  const [text, setText] = useState("");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (recorder.error) setError(recorder.error);
  }, [recorder.error]);

  async function toggleRecording() {
    setError("");
    if (recorder.status === "recording") {
      const blob = await recorder.stop();
      if (blob?.size) setRecordingBlob(blob);
      return;
    }
    setRecordingBlob(null);
    await recorder.start();
  }

  async function save() {
    if (saving || saved || (!text.trim() && !recordingBlob)) return;
    setSaving(true);
    setError("");
    try {
      const media = recordingBlob
        ? [await uploadVoice(spaceId, recordingBlob)]
        : [];
      const response = await fetch("/api/tablet/observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId,
          text: text.trim() || undefined,
          media,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not keep this notice.");
      setSaved(true);
      router.refresh();
      window.setTimeout(onClose, 500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not keep this notice.");
    } finally {
      setSaving(false);
    }
  }

  const recording = recorder.status === "recording";
  const elapsed = `${Math.floor(recorder.elapsed / 60)}:${String(recorder.elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep/75 p-6 backdrop-blur-xl">
      <section className="flex max-h-[min(860px,92dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-[40px] border border-white/[0.08] bg-[#0c1220] p-7 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.17em] text-warm-3">Notice</p>
            <h2 className="mt-2 font-display text-[clamp(2.5rem,5vw,4.6rem)] font-light leading-[.92] text-text-primary">
              What are you noticing?
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              recorder.discard();
              onClose();
            }}
            className="rounded-full border border-white/[0.07] px-4 py-2 text-[0.68rem] uppercase tracking-[0.12em] text-text-muted"
          >
            Close
          </button>
        </div>

        <p className="mt-4 max-w-xl text-[0.86rem] leading-relaxed text-text-secondary">
          Capture the observation first. Swells can work out what it may connect to afterwards.
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write what you noticed…"
          className="mt-6 min-h-40 flex-1 resize-none rounded-[28px] border border-white/[0.07] bg-black/10 p-5 text-[1.05rem] leading-relaxed text-text-primary outline-none placeholder:text-text-muted/50 focus:border-cool-1/30"
          maxLength={5000}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={saving || saved}
            className={`rounded-[22px] border px-5 py-4 text-[0.76rem] font-medium uppercase tracking-[0.12em] ${
              recording
                ? "border-warm-1/35 bg-warm-1/10 text-warm-1"
                : recordingBlob
                  ? "border-cool-1/25 bg-cool-1/8 text-cool-1"
                  : "border-white/[0.07] bg-white/[0.025] text-text-secondary"
            }`}
          >
            {recording ? `Stop recording · ${elapsed}` : recordingBlob ? "Voice note ready ✓ · record again" : "Add voice note"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || saved || (!text.trim() && !recordingBlob)}
            className="rounded-[22px] border border-cool-1/30 bg-cool-1/10 px-5 py-4 text-[0.76rem] font-medium uppercase tracking-[0.12em] text-cool-1 disabled:opacity-35"
          >
            {saved ? "Noticed ✓" : saving ? "Keeping…" : "Keep this notice"}
          </button>
        </div>

        {error ? <p className="mt-3 text-[0.75rem] text-warm-1">{error}</p> : null}
      </section>
    </div>
  );
}

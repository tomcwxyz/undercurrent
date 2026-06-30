"use client";

import { useState, useRef, useCallback } from "react";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";

interface Props {
  token: string;
  title: string;
  description?: string;
}

type PendingMedia = {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  objectUrl: string;
  uploadProgress: number;
  uploaded: boolean;
  storageKey?: string;
  publicUrl?: string;
  type: "image" | "voice" | "file";
};

async function uploadFile(
  token: string,
  file: File,
  fileName: string,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<{ key: string; publicUrl: string; mediaType: "image" | "voice" | "file" }> {
  const res = await fetch(`/api/c/${token}/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType, fileSize: file.size }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  const { uploadUrl, key, publicUrl, mediaType } = await res.json();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener("load", () =>
      xhr.status < 300 ? resolve() : reject(new Error("Upload failed"))
    );
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.send(file);
  });

  return { key, publicUrl, mediaType };
}

export function CollectionForm({ token, title, description }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  const addFiles = useCallback(
    (files: FileList | File[], type: "image" | "voice" | "file") => {
      const items: PendingMedia[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        mimeType: file.type,
        objectUrl: URL.createObjectURL(file),
        uploadProgress: 0,
        uploaded: false,
        type,
      }));
      setPendingMedia((prev) => [...prev, ...items]);
    },
    []
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const text = (
      form.elements.namedItem("text") as HTMLTextAreaElement
    ).value.trim();
    const name = (
      form.elements.namedItem("name") as HTMLInputElement
    ).value.trim();

    if (!text && pendingMedia.length === 0) {
      setError("Please add some text or attach media.");
      return;
    }

    setSubmitting(true);

    const mediaRefs: {
      key: string;
      url: string;
      type: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    }[] = [];

    try {
      for (const item of pendingMedia) {
        const result = await uploadFile(
          token,
          item.file,
          item.fileName,
          item.mimeType,
          (pct) => {
            setPendingMedia((prev) =>
              prev.map((m) =>
                m.id === item.id ? { ...m, uploadProgress: pct } : m
              )
            );
          }
        );
        mediaRefs.push({
          key: result.key,
          url: result.publicUrl,
          type: result.mediaType,
          fileName: item.fileName,
          mimeType: item.mimeType,
          fileSize: item.file.size,
        });
      }
    } catch {
      setError("Upload failed. Please try again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch(`/api/c/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text || undefined,
        name: name || undefined,
        mediaRefs,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div>
        <h1 className="font-display text-3xl font-light text-text-primary mb-4">
          {title}
        </h1>
        <p className="text-text-secondary mb-6">
          Thank you. Your observation has been added.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setPendingMedia([]);
          }}
          className="text-[0.85rem] text-cool-1 hover:text-cool-2 transition-colors"
        >
          Submit another →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="font-display text-[2rem] font-light leading-tight text-text-primary mb-3">
        {title}
      </h1>
      {description && (
        <p className="text-[0.9rem] leading-relaxed text-text-secondary mb-8">
          {description}
        </p>
      )}

      <input
        type="text"
        name="name"
        placeholder="Your name (optional)"
        className="mb-4 w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />

      <textarea
        name="text"
        placeholder="What do you notice?"
        className="mb-4 w-full resize-y rounded-[14px] border border-white/8 bg-white/[0.04] p-4 text-[0.92rem] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
        style={{ minHeight: "140px" }}
      />

      {/* Media previews */}
      {pendingMedia.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pendingMedia.map((m) => (
            <div key={m.id} className="relative">
              {m.type === "image" ? (
                <img
                  src={m.objectUrl}
                  className="h-16 w-16 rounded-lg object-cover opacity-80"
                  alt=""
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.06] text-[0.65rem] text-text-muted text-center px-1">
                  {m.type === "voice" ? "🎙" : "📄"} {m.fileName.slice(0, 12)}
                </div>
              )}
              {!m.uploaded && m.uploadProgress > 0 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-[0.65rem] text-white">
                  {Math.round(m.uploadProgress)}%
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setPendingMedia((prev) => prev.filter((x) => x.id !== m.id))
                }
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-deep text-[0.6rem] text-text-muted hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Media buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2 text-[0.78rem] text-text-secondary hover:bg-white/[0.04] transition-colors"
        >
          📷 Photo
        </button>
        <button
          type="button"
          onClick={async () => {
            if (voice.status === "idle") {
              await voice.start();
            } else {
              const blob = await voice.stop();
              if (blob && blob.size > 0) {
                const ext = blob.type.includes("webm")
                  ? "webm"
                  : blob.type.includes("mp4")
                  ? "mp4"
                  : "ogg";
                addFiles(
                  [
                    new File([blob], `voice-${new Date().getTime()}.${ext}`, {
                      type: blob.type,
                    }),
                  ],
                  "voice"
                );
              }
            }
          }}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[0.78rem] transition-colors ${
            voice.status === "recording"
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : "border-white/8 text-text-secondary hover:bg-white/[0.04]"
          }`}
        >
          {voice.status === "recording" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />{" "}
              Stop
            </>
          ) : (
            "🎙 Voice"
          )}
        </button>
        {voice.status === "idle" && (
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2 text-[0.78rem] text-text-muted hover:bg-white/[0.04] transition-colors"
          >
            ↑ Upload audio
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2 text-[0.78rem] text-text-secondary hover:bg-white/[0.04] transition-colors"
        >
          📎 File
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files, "image");
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.csv"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files, "file");
          e.target.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,.mp3,.wav,.m4a"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files, "voice");
          e.target.value = "";
        }}
      />

      {error && <p className="mb-4 text-[0.82rem] text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 py-3.5 text-[0.88rem] font-medium text-deep transition-all hover:shadow-[0_4px_24px_rgba(78,205,196,0.3)] disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit observation"}
      </button>
    </form>
  );
}

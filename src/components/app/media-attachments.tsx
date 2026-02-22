"use client";

import { useState } from "react";
import type { MediaView } from "@/lib/types";

interface MediaAttachmentsProps {
  media: MediaView[];
}

export function MediaAttachments({ media }: MediaAttachmentsProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (media.length === 0) return null;

  const images = media.filter((m) => m.type === "image");
  const audio = media.filter((m) => m.type === "voice");
  const files = media.filter((m) => m.type === "file");

  return (
    <>
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(img.url);
              }}
              className="overflow-hidden rounded-[10px] transition-transform hover:scale-[1.02]"
            >
              <img
                src={img.url}
                alt={img.aiDescription ?? img.fileName ?? "Attached image"}
                className="h-[120px] w-auto max-w-[200px] rounded-[10px] object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Audio players */}
      {audio.map((a) => (
        <div key={a.id} className="mb-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0 text-cool-1"
              aria-hidden="true"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <audio
              controls
              preload="none"
              className="h-8 w-full [&::-webkit-media-controls-panel]:bg-transparent"
            >
              <source src={a.url} type={a.mimeType} />
            </audio>
          </div>
          {a.aiTranscript && (
            <p className="mt-1.5 px-3 text-[0.78rem] italic leading-relaxed text-text-muted">
              {a.aiTranscript}
            </p>
          )}
        </div>
      ))}

      {/* File links */}
      {files.map((f) => (
        <a
          key={f.id}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mb-3 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[0.8rem] text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0"
            aria-hidden="true"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          </svg>
          <span className="truncate">{f.fileName ?? "File"}</span>
        </a>
      ))}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightboxUrl(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-lg text-white/60 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

"use client";

export interface PendingMedia {
  id: string;
  type: "image" | "voice" | "file";
  file: File | Blob;
  objectUrl: string;
  fileName: string;
  mimeType: string;
  uploadProgress: number; // 0-100
  uploaded: boolean;
  // Set after presign + upload
  storageKey?: string;
  publicUrl?: string;
}

interface MediaUploadPreviewProps {
  items: PendingMedia[];
  onRemove: (id: string) => void;
}

export function MediaUploadPreview({ items, onRemove }: MediaUploadPreviewProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative rounded-xl border border-white/[0.06] bg-white/[0.03] p-1.5"
        >
          {item.type === "image" ? (
            <img
              src={item.objectUrl}
              alt={item.fileName}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : item.type === "voice" ? (
            <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-white/[0.04]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-cool-1"
                aria-hidden="true"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              <span className="ml-1.5 text-[0.65rem] text-text-muted">Audio</span>
            </div>
          ) : (
            <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-white/[0.04]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-text-secondary"
                aria-hidden="true"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              </svg>
              <span className="ml-1.5 max-w-[50px] truncate text-[0.65rem] text-text-muted">
                {item.fileName}
              </span>
            </div>
          )}

          {/* Upload progress overlay */}
          {!item.uploaded && item.uploadProgress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
              <span className="text-[0.7rem] font-medium text-white">
                {Math.round(item.uploadProgress)}%
              </span>
            </div>
          )}

          {/* Remove button */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-deep border border-white/10 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
            aria-label={`Remove ${item.fileName}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

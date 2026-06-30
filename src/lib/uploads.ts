/**
 * Shared upload validation — single source of truth for the file types and
 * size caps the upload presign routes and the public collection submit route
 * all enforce. Keeping this in one place stops the authenticated and public
 * paths from drifting apart.
 */

export type MediaType = "image" | "voice" | "file";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
]);

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Strip codec params ("audio/webm;codecs=opus" → "audio/webm"). */
export function baseContentType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

/** Map a (validated) content type to its media bucket, or null if disallowed. */
export function getMediaType(contentType: string): MediaType | null {
  const base = baseContentType(contentType);
  if (ALLOWED_IMAGE_TYPES.has(base)) return "image";
  if (ALLOWED_AUDIO_TYPES.has(base)) return "voice";
  if (ALLOWED_FILE_TYPES.has(base)) return "file";
  return null;
}

export function getMaxSize(mediaType: MediaType): number {
  switch (mediaType) {
    case "image":
      return MAX_IMAGE_SIZE;
    case "voice":
      return MAX_AUDIO_SIZE;
    case "file":
      return MAX_FILE_SIZE;
  }
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

export type PresignRequest = {
  fileName: unknown;
  contentType: unknown;
  fileSize: unknown;
};

export type ValidatedUpload = {
  mediaType: MediaType;
  contentType: string;
  fileSize: number;
};

/**
 * Validate a presign request: known content type, a positive integer byte
 * size within the cap for that type. Returns the media bucket + normalised
 * values, or an error string suitable for a 400 response.
 */
export function validatePresignRequest(
  req: PresignRequest
): { ok: true; value: ValidatedUpload } | { ok: false; error: string } {
  const { fileName, contentType, fileSize } = req;
  if (typeof fileName !== "string" || !fileName) {
    return { ok: false, error: "Missing fileName" };
  }
  if (typeof contentType !== "string" || !contentType) {
    return { ok: false, error: "Missing contentType" };
  }
  const mediaType = getMediaType(contentType);
  if (!mediaType) {
    return { ok: false, error: "Unsupported file type" };
  }
  if (
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    !Number.isInteger(fileSize)
  ) {
    return { ok: false, error: "Missing or invalid fileSize" };
  }
  if (fileSize > getMaxSize(mediaType)) {
    return { ok: false, error: "File too large" };
  }
  return {
    ok: true,
    value: { mediaType, contentType: baseContentType(contentType), fileSize },
  };
}

/**
 * Validate a media reference submitted alongside an observation. Confirms the
 * declared type/mime/size are allowed and consistent, and that the storage key
 * lives under the expected prefix (so a client can't reference another space's
 * objects — an IDOR guard).
 */
export function validateMediaRef(
  ref: {
    key: string;
    type: MediaType;
    mimeType: string;
    fileSize: number;
  },
  expectedKeyPrefix: string
): { ok: true } | { ok: false; error: string } {
  if (!ref.key.startsWith(expectedKeyPrefix)) {
    return { ok: false, error: "Invalid media reference" };
  }
  const mediaType = getMediaType(ref.mimeType);
  if (!mediaType || mediaType !== ref.type) {
    return { ok: false, error: "Unsupported or mismatched media type" };
  }
  if (
    typeof ref.fileSize !== "number" ||
    !Number.isFinite(ref.fileSize) ||
    ref.fileSize <= 0 ||
    ref.fileSize > getMaxSize(mediaType)
  ) {
    return { ok: false, error: "Invalid media size" };
  }
  return { ok: true };
}

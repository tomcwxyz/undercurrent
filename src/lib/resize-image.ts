/**
 * Downscale an image client-side before upload — full-resolution phone
 * photos otherwise go straight to R2 untouched, hurting both upload time
 * and storage/egress cost. Falls back to the original file whenever the
 * browser can't decode it (e.g. HEIC) or it's already small enough.
 */
export async function resizeImageIfNeeded(
  file: File,
  maxEdge = 2000,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    if (Math.max(width, height) <= maxEdge) {
      bitmap.close();
      return file;
    }

    const scale = maxEdge / Math.max(width, height);
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    const resizedName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], resizedName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

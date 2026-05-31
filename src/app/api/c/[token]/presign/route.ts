import { NextRequest, NextResponse } from "next/server";
import { getCollectionByToken } from "@/lib/db/queries";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "audio/webm", "audio/mp4", "audio/ogg", "audio/wav",
  "application/pdf", "text/plain", "text/csv",
]);

function getMediaType(contentType: string): "image" | "voice" | "file" | null {
  const base = contentType.split(";")[0].trim();
  if (base.startsWith("image/")) return "image";
  if (base.startsWith("audio/")) return "voice";
  if (["application/pdf", "text/plain", "text/csv"].includes(base)) return "file";
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!checkRateLimit(`presign:${ip}:${token}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const collection = await getCollectionByToken(token);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!collection.isOpen) return NextResponse.json({ error: "Closed" }, { status: 403 });
  if (collection.closeAt && collection.closeAt < new Date()) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }
  if (collection.maxResponses && collection.responseCount >= collection.maxResponses) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }

  const { fileName, contentType } = await req.json();
  if (!fileName || !contentType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const base = contentType.split(";")[0].trim();
  if (!ALLOWED_TYPES.has(base)) {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }

  const mediaType = getMediaType(contentType);
  const fileId = crypto.randomUUID();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const key = `collections/${token}/${fileId}/${sanitized}`;

  const { uploadUrl } = await generatePresignedUploadUrl(key, base, 25 * 1024 * 1024);
  const publicUrl = getPublicUrl(key);

  return NextResponse.json({ uploadUrl, key, publicUrl, mediaType });
}

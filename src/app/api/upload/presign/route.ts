import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { checkSubscriptionAccess } from "@/lib/stripe";

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

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getMediaType(
  contentType: string
): "image" | "voice" | "file" | null {
  if (ALLOWED_IMAGE_TYPES.has(contentType)) return "image";
  if (ALLOWED_AUDIO_TYPES.has(contentType)) return "voice";
  if (ALLOWED_FILE_TYPES.has(contentType)) return "file";
  return null;
}

function getMaxSize(mediaType: "image" | "voice" | "file"): number {
  switch (mediaType) {
    case "image":
      return MAX_IMAGE_SIZE;
    case "voice":
      return MAX_AUDIO_SIZE;
    case "file":
      return MAX_FILE_SIZE;
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const access = await checkSubscriptionAccess(
    session.user.id,
    session.user.email
  );
  if (!access.allowed) {
    return NextResponse.json(
      { error: `Subscription ${access.reason}` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { fileName, contentType, spaceId } = body as {
    fileName: string;
    contentType: string;
    spaceId: string;
  };

  if (!fileName || !contentType || !spaceId) {
    return NextResponse.json(
      { error: "Missing required fields: fileName, contentType, spaceId" },
      { status: 400 }
    );
  }

  const mediaType = getMediaType(contentType);
  if (!mediaType) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const maxSize = getMaxSize(mediaType);
  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFileName(fileName);
  const key = `spaces/${spaceId}/${fileId}/${sanitized}`;

  try {
    const { uploadUrl } = await generatePresignedUploadUrl(
      key,
      contentType,
      maxSize
    );
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl,
      mediaType,
      maxSize,
    });
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return NextResponse.json(
      { error: "Upload service is currently unavailable" },
      { status: 503 }
    );
  }
}

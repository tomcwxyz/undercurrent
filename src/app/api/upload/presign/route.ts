import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePresignedUploadUrl, getPublicUrl, sanitizeFileName } from "@/lib/r2";
import { checkSubscriptionAccess } from "@/lib/stripe";
import { getMemberRole } from "@/lib/db/queries";
import { canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";

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
  // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm")
  const baseType = contentType.split(";")[0].trim();
  if (ALLOWED_IMAGE_TYPES.has(baseType)) return "image";
  if (ALLOWED_AUDIO_TYPES.has(baseType)) return "voice";
  if (ALLOWED_FILE_TYPES.has(baseType)) return "file";
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
  const { fileName, contentType, spaceId, fileSize } = body as {
    fileName: string;
    contentType: string;
    spaceId: string;
    fileSize: number;
  };

  if (!fileName || !contentType || !spaceId || !fileSize) {
    return NextResponse.json(
      { error: "Missing required fields: fileName, contentType, spaceId, fileSize" },
      { status: 400 }
    );
  }

  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canCreateObservation(role as SpaceRole)) {
    return NextResponse.json({ error: "Not authorized for this space" }, { status: 403 });
  }

  const mediaType = getMediaType(contentType);
  if (!mediaType) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const maxSize = getMaxSize(mediaType);
  if (fileSize > maxSize) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(maxSize / (1024 * 1024))}MB limit for this type` },
      { status: 400 }
    );
  }

  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFileName(fileName);
  const key = `spaces/${spaceId}/${fileId}/${sanitized}`;

  try {
    const { uploadUrl } = await generatePresignedUploadUrl(
      key,
      contentType,
      fileSize
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

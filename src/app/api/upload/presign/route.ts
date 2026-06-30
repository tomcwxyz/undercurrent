import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { checkSubscriptionAccess } from "@/lib/stripe";
import { getMemberRole } from "@/lib/db/queries";
import { canCreateObservation } from "@/lib/permissions";
import type { SpaceRole } from "@/lib/types";
import { sanitizeFileName, validatePresignRequest } from "@/lib/uploads";

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
  const { fileName, contentType, fileSize, spaceId } = body as {
    fileName: string;
    contentType: string;
    fileSize: number;
    spaceId: string;
  };

  if (!spaceId || typeof spaceId !== "string") {
    return NextResponse.json(
      { error: "Missing required field: spaceId" },
      { status: 400 }
    );
  }

  // Only members who can contribute may obtain an upload URL for a space — and
  // only into that space's own key prefix.
  const role = await getMemberRole(session.user.id, spaceId);
  if (!role || !canCreateObservation(role as SpaceRole)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const validated = validatePresignRequest({ fileName, contentType, fileSize });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { mediaType, contentType: baseType, fileSize: size } = validated.value;

  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFileName(fileName);
  const key = `spaces/${spaceId}/${fileId}/${sanitized}`;

  try {
    const { uploadUrl } = await generatePresignedUploadUrl(key, baseType, size);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl,
      mediaType,
    });
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return NextResponse.json(
      { error: "Upload service is currently unavailable" },
      { status: 503 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCollectionByToken } from "@/lib/db/queries";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeFileName, validatePresignRequest } from "@/lib/uploads";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = getClientIp(req);

  if (!(await checkRateLimit(`presign:${ip}:${token}`, 20, 60 * 60 * 1000))) {
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

  const { fileName, contentType, fileSize } = await req.json();
  const validated = validatePresignRequest({ fileName, contentType, fileSize });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { mediaType, contentType: baseType, fileSize: size } = validated.value;

  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFileName(fileName);
  const key = `collections/${token}/${fileId}/${sanitized}`;

  const { uploadUrl } = await generatePresignedUploadUrl(key, baseType, size);
  const publicUrl = getPublicUrl(key);

  return NextResponse.json({ uploadUrl, key, publicUrl, mediaType });
}

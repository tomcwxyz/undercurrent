import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!_client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "Missing R2 configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables are required"
      );
    }

    _client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Disable automatic CRC32 checksums — R2 doesn't support them
      // Types lag behind runtime for these options, hence the cast
      ...({ requestChecksumCalculation: "when_required", responseChecksumValidation: "when_required" } as object),
    });
  }
  return _client;
}

const BUCKET = () => process.env.R2_BUCKET_NAME ?? "swells";

/**
 * Generate a presigned PUT URL for direct browser upload.
 *
 * `contentLength` is the EXACT byte size of the upload (validated server-side
 * against the per-type cap before calling this) and is included as a signed
 * header. R2 then rejects any PUT whose Content-Length differs, so a client
 * cannot upload a larger object than it declared — the size cap is enforced at
 * the edge, not merely advisory. (Signing an exact length works; signing a
 * *max* length is what previously caused 403s.)
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number
): Promise<{ uploadUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn: 600, // 10 minutes
    signableHeaders: new Set(["content-length"]),
  });

  return { uploadUrl, key };
}

/** Delete an object from R2 */
export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: BUCKET(),
      Key: key,
    })
  );
}

/** Construct the public URL for an R2 object */
export function getPublicUrl(key: string): string {
  const bucket = BUCKET();
  const customDomain = process.env.R2_PUBLIC_DOMAIN;
  if (customDomain) {
    return `https://${customDomain}/${key}`;
  }
  return `https://${bucket}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

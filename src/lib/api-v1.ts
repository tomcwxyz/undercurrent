import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/api-schema";
import { spaceMemberships, users } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

export const API_V1_SCOPES = [
  "spaces:read",
  "observations:read",
  "observations:write",
  "signals:read",
] as const;

export type ApiV1Scope = (typeof API_V1_SCOPES)[number];

export class ApiV1Error extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueApiToken() {
  const secret = randomBytes(32).toString("base64url");
  const token = "swl_v1_" + secret;
  return {
    token,
    keyHash: tokenHash(token),
    keyPrefix: token.slice(0, 15),
  };
}

export async function createUserApiKey(input: {
  userId: string;
  name: string;
  scopes: ApiV1Scope[];
  expiresAt?: Date | null;
}) {
  const active = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, input.userId), isNull(apiKeys.revokedAt)))
    .limit(10);

  if (active.length >= 10) {
    throw new ApiV1Error(
      "You can have at most 10 active API keys",
      400,
      "key_limit_reached",
    );
  }

  const issued = issueApiToken();
  const [created] = await db
    .insert(apiKeys)
    .values({
      userId: input.userId,
      name: input.name,
      keyPrefix: issued.keyPrefix,
      keyHash: issued.keyHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    });

  return { ...created, token: issued.token };
}

export async function listUserApiKeys(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeUserApiKey(userId: string, keyId: string) {
  const [revoked] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });

  return revoked ?? null;
}

export async function requireApiV1Key(
  request: Request,
  requiredScope: ApiV1Scope,
) {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token || !token.startsWith("swl_v1_")) {
    throw new ApiV1Error("Missing or invalid API key", 401, "invalid_api_key");
  }

  const [record] = await db
    .select({
      keyId: apiKeys.id,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(and(eq(apiKeys.keyHash, tokenHash(token)), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!record) {
    throw new ApiV1Error("Missing or invalid API key", 401, "invalid_api_key");
  }

  if (record.expiresAt && record.expiresAt <= new Date()) {
    throw new ApiV1Error("API key has expired", 401, "expired_api_key");
  }

  if (!(record.scopes ?? []).includes(requiredScope)) {
    throw new ApiV1Error(
      "API key does not include the required scope",
      403,
      "insufficient_scope",
    );
  }

  if (!(await checkRateLimit("api:v1:" + record.keyId, 120, 60 * 1000))) {
    throw new ApiV1Error("API rate limit exceeded", 429, "rate_limited");
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.keyId));

  return {
    keyId: record.keyId,
    scopes: record.scopes as ApiV1Scope[],
    user: {
      id: record.userId,
      name: record.userName,
      email: record.userEmail,
    },
  };
}

export async function requireApiV1SpaceMembership(userId: string, spaceId: string) {
  const [membership] = await db
    .select({ role: spaceMemberships.role })
    .from(spaceMemberships)
    .where(
      and(
        eq(spaceMemberships.userId, userId),
        eq(spaceMemberships.spaceId, spaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new ApiV1Error("Not authorised for this space", 403, "space_forbidden");
  }

  return membership;
}

export function encodeApiV1Cursor(at: Date, id: string) {
  return Buffer.from(
    JSON.stringify({ at: at.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

export function decodeApiV1Cursor(value: string) {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { at?: unknown; id?: unknown };

    if (
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)
    ) {
      throw new Error("bad cursor");
    }

    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) throw new Error("bad cursor");
    return { at, id: parsed.id };
  } catch {
    throw new ApiV1Error("Invalid cursor", 400, "invalid_cursor");
  }
}

export function apiV1ErrorResponse(error: unknown) {
  if (error instanceof ApiV1Error) {
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (error.status === 401) {
      headers.set("WWW-Authenticate", 'Bearer realm="Swells API v1"');
    }

    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers },
    );
  }

  console.error("Swells API v1 error", error);
  return Response.json(
    { error: { code: "internal_error", message: "API request failed" } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

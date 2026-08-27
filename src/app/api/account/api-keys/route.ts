import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  API_V1_SCOPES,
  ApiV1Error,
  createUserApiKey,
  listUserApiKeys,
} from "@/lib/api-v1";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_V1_SCOPES)).min(1).max(API_V1_SCOPES.length),
  expiresInDays: z
    .union([z.literal(30), z.literal(90), z.literal(365)])
    .nullable()
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const data = await listUserApiKeys(session.user.id);
  return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const expiresAt = parsed.data.expiresInDays
    ? new Date(
        Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000,
      )
    : null;

  try {
    const created = await createUserApiKey({
      userId: session.user.id,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      expiresAt,
    });
    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiV1Error) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create API key", error);
    return Response.json({ error: "Could not create API key" }, { status: 500 });
  }
}

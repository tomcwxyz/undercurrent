import { z } from "zod";
import { auth } from "@/lib/auth";
import { revokeUserApiKey } from "@/lib/api-v1";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { keyId } = await params;
  const parsed = z.string().uuid().safeParse(keyId);
  if (!parsed.success) {
    return Response.json({ error: "Invalid API key id" }, { status: 400 });
  }

  const revoked = await revokeUserApiKey(session.user.id, parsed.data);
  if (!revoked) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}

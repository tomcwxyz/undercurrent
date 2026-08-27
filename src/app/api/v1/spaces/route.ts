import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spaceMemberships, spaces } from "@/lib/db/schema";
import { apiV1ErrorResponse, requireApiV1Key } from "@/lib/api-v1";

export async function GET(request: Request) {
  try {
    const principal = await requireApiV1Key(request, "spaces:read");
    const data = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        description: spaces.description,
        type: spaces.type,
        role: spaceMemberships.role,
      })
      .from(spaceMemberships)
      .innerJoin(spaces, eq(spaces.id, spaceMemberships.spaceId))
      .where(eq(spaceMemberships.userId, principal.user.id))
      .orderBy(asc(spaces.name));

    return Response.json(
      { data, meta: { version: "v1" } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiV1ErrorResponse(error);
  }
}

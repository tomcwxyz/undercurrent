import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSpacesForUser } from "@/lib/db/queries";

export default async function TabletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const spaces = await getSpacesForUser(session.user.id);
  if (!spaces.length) redirect("/dashboard");

  const cookieStore = await cookies();
  const preferredSpaceId = cookieStore.get("swells-tablet-space")?.value;
  const preferredSpace =
    spaces.find((space) => space.id === preferredSpaceId) ?? spaces[0];

  redirect(`/tablet/${preferredSpace.id}`);
}

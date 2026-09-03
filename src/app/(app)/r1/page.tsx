import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSpacesForUser } from "@/lib/db/queries";

export default async function R1Page() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const spaces = await getSpacesForUser(session.user.id);
  const firstSpace = spaces[0];

  if (!firstSpace) {
    redirect("/dashboard");
  }

  redirect(`/r1/${firstSpace.id}`);
}

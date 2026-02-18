import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserDefaultSpace } from "@/lib/db/queries";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const spaceId = await getUserDefaultSpace(session.user.id);
  if (!spaceId) redirect("/onboarding");

  redirect(`/dashboard/${spaceId}`);
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserDefaultSpace } from "@/lib/db/queries";
import { seedDemoData } from "@/lib/db/seed";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  // If user already has a space, skip onboarding
  const existingSpace = await getUserDefaultSpace(session.user.id);
  if (existingSpace) redirect("/dashboard");

  // Seed demo data and redirect
  await seedDemoData(session.user.id);
  redirect("/dashboard");
}

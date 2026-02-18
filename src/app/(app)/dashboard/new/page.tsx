import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateSpaceForm } from "./form";

export default async function NewSpacePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div
        className="w-full max-w-[480px] rounded-3xl border p-8"
        style={{
          background: "rgba(15,20,35,0.8)",
          borderColor: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        <h1 className="font-display text-3xl font-light text-text-primary">
          Create a new space
        </h1>
        <p className="mt-2 text-[0.85rem] text-text-secondary">
          Spaces are where teams observe, make sense, and reflect together.
        </p>
        <CreateSpaceForm />
      </div>
    </div>
  );
}

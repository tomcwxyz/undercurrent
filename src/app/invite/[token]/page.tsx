import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInvitationByToken, acceptInvitation } from "@/lib/db/queries";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  // Not logged in — redirect to sign-in with callback
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/invite/${token}`);
  }

  // Check token validity
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return <InviteError message="This invitation link is invalid." />;
  }

  if (invitation.acceptedAt) {
    return <InviteError message="This invitation has already been accepted." />;
  }

  if (invitation.expiresAt < new Date()) {
    return <InviteError message="This invitation has expired. Ask the space admin for a new link." />;
  }

  // Accept and redirect
  const spaceId = await acceptInvitation(token, session.user.id);
  if (!spaceId) {
    return <InviteError message="Could not accept invitation. Please try again." />;
  }

  redirect(`/dashboard/${spaceId}`);
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div
        className="w-full max-w-[400px] rounded-3xl border p-8 text-center"
        style={{
          background: "rgba(15,20,35,0.8)",
          borderColor: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="mb-4 text-3xl">✕</div>
        <h1 className="font-display text-xl font-light text-text-primary">
          Invitation problem
        </h1>
        <p className="mt-2 text-[0.85rem] text-text-secondary">
          {message}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-xl bg-cool-1/15 px-5 py-2.5 text-[0.82rem] font-medium text-cool-1 transition-colors hover:bg-cool-1/25"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

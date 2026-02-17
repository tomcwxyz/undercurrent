"use client";

import { useTransition } from "react";
import { clearDemoDataAction } from "@/app/(app)/actions";

export function DemoBanner({ spaceId }: { spaceId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="flex flex-col items-start gap-2 px-6 py-2.5 text-[0.8rem] sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-8"
      style={{
        background:
          "linear-gradient(90deg, rgba(255,209,102,0.06), rgba(255,107,74,0.06))",
        borderBottom: "1px solid rgba(255,209,102,0.1)",
      }}
    >
      <span className="text-warm-3">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warm-3" />
        You&apos;re exploring demo data — real observations will replace these
      </span>
      <form
        action={(formData) => {
          startTransition(() => clearDemoDataAction(formData));
        }}
      >
        <input type="hidden" name="spaceId" value={spaceId} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl border border-warm-3/20 bg-warm-3/8 px-3.5 py-1 text-[0.75rem] font-medium text-warm-3 transition-all hover:border-warm-3/40 hover:bg-warm-3/15 disabled:opacity-50"
        >
          {isPending ? "Clearing..." : "Clear demo data & start fresh"}
        </button>
      </form>
    </div>
  );
}

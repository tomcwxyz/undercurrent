"use client";

import { useTransition } from "react";
import Link from "next/link";
import { createSpaceAction } from "@/app/(app)/actions";

export function CreateSpaceForm() {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await createSpaceAction(formData);
        });
      }}
      className="mt-6 space-y-4"
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-[0.75rem] text-text-muted">
          Space name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.9rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
          placeholder="e.g. Product Team"
        />
      </div>
      <div>
        <label htmlFor="description" className="mb-1 block text-[0.75rem] text-text-muted">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          className="w-full resize-y rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[0.9rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
          style={{ minHeight: "80px" }}
          placeholder="What is this space for?"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <input
          type="checkbox"
          name="seedSample"
          value="true"
          className="mt-0.5 h-4 w-4 rounded"
        />
        <span className="text-[0.8rem] leading-relaxed text-text-secondary">
          Fill with sample data
          <span className="block text-[0.72rem] text-text-muted">
            Adds example observations, signals, collections and reflections so you
            can explore every view straight away. You can clear it anytime.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 px-6 py-2.5 text-[0.85rem] font-medium text-deep transition-all hover:shadow-[0_4px_24px_rgba(78,205,196,0.3)] hover:-translate-y-px disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create space"}
        </button>
        <Link
          href="/dashboard"
          className="text-[0.82rem] text-text-muted transition-colors hover:text-text-secondary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

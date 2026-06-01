"use client";

import { useState, useTransition, useMemo } from "react";
import { MediaAttachments } from "@/components/app/media-attachments";
import type { CollectionView, ObservationView } from "@/lib/types";
import {
  createCollectionAction,
  updateCollectionAction,
  deleteCollectionAction,
  moderateObservationAction,
} from "@/app/(app)/actions";

interface CollectViewProps {
  collections: CollectionView[];
  observations: ObservationView[];
  pendingObservations: ObservationView[];
  spaceId: string;
  canManage: boolean;
}

export function CollectView({
  collections,
  observations,
  pendingObservations,
  spaceId,
  canManage,
}: CollectViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-derive the selected collection from props so it stays fresh after updates
  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedId) ?? null,
    [collections, selectedId]
  );

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function toggleOpen(collection: CollectionView) {
    const fd = new FormData();
    fd.set("id", collection.id);
    fd.set("spaceId", spaceId);
    fd.set("isOpen", String(!collection.isOpen));
    startTransition(() => updateCollectionAction(fd));
  }

  if (selectedCollection) {
    return (
      <CollectionDetail
        collection={selectedCollection}
        observations={observations}
        pendingObservations={pendingObservations}
        spaceId={spaceId}
        canManage={canManage}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-2xl font-light text-text-primary">Collections</h2>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl border border-white/8 bg-white/[0.06] px-4 py-2 text-[0.82rem] text-text-secondary transition-colors hover:bg-white/[0.09]"
          >
            + New collection
          </button>
        )}
      </div>
      <p className="mb-6 text-[0.85rem] leading-relaxed text-text-secondary">
        Gather observations from anyone — no account needed. Share a link and responses
        flow straight into your space.
      </p>

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] p-10 text-center">
          <p className="text-[0.88rem] text-text-secondary">No collections yet.</p>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-[0.82rem] text-cool-1 transition-colors hover:text-cool-2"
            >
              Create your first collection →
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((c) => {
            const pendingCount = pendingObservations.filter(
              (o) => o.collectionId === c.id
            ).length;
            return (
              <div
                key={c.id}
                className="cursor-pointer rounded-2xl border border-white/[0.06] p-5 transition-colors hover:border-white/[0.1]"
                style={{ background: "rgba(255,255,255,0.02)" }}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${c.isOpen ? "bg-cool-1" : "bg-white/20"}`}
                      />
                      <span className="text-[0.7rem] uppercase tracking-wider text-text-muted">
                        {c.isOpen ? "Open" : "Closed"} · {c.responseCount} response
                        {c.responseCount !== 1 ? "s" : ""}
                      </span>
                      {c.moderationEnabled && pendingCount > 0 && (
                        <span className="rounded-full bg-warm-1/15 px-2 py-0.5 text-[0.65rem] font-medium text-warm-1">
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[0.92rem] font-medium text-text-primary">{c.title}</p>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => copyLink(c.shareUrl, c.id)}
                      className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary transition-colors hover:bg-white/[0.04]"
                    >
                      {copied === c.id ? "Copied!" : "Copy link"}
                    </button>
                    {canManage && (
                      <button
                        onClick={() => toggleOpen(c)}
                        disabled={isPending}
                        className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary transition-colors hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        {c.isOpen ? "Close" : "Open"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && canManage && (
        <CreateCollectionModal spaceId={spaceId} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CreateCollectionModal({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [newLink, setNewLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("spaceId", spaceId);
    // Drop empty optional fields so Zod doesn't choke on "" values
    if (!fd.get("description")) fd.delete("description");
    if (!fd.get("closeAt")) fd.delete("closeAt");
    if (!fd.get("maxResponses")) fd.delete("maxResponses");
    else {
      // datetime-local gives "YYYY-MM-DDTHH:mm" — convert to ISO for z.string().datetime()
    }
    const closeAtRaw = fd.get("closeAt");
    if (closeAtRaw) {
      fd.set("closeAt", new Date(closeAtRaw as string).toISOString());
    }
    startTransition(async () => {
      try {
        const result = await createCollectionAction(fd);
        setNewLink(result.shareUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create collection.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: "rgba(10,14,26,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[90%] max-w-[520px] rounded-3xl border border-white/[0.06] bg-surface p-8">
        {newLink ? (
          <div>
            <h3 className="mb-4 font-display text-2xl font-light text-text-primary">
              Collection created
            </h3>
            <p className="mb-3 text-[0.82rem] text-text-secondary">Share this link:</p>
            <div className="mb-6 break-all rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 font-mono text-[0.82rem] text-cool-1">
              {newLink}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(newLink)}
                className="flex-1 rounded-xl border border-white/8 bg-white/[0.06] py-2.5 text-[0.85rem] text-text-secondary transition-colors hover:bg-white/[0.09]"
              >
                Copy link
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 py-2.5 text-[0.85rem] font-medium text-deep transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-2xl font-light text-text-primary">New collection</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-muted transition-colors hover:text-text-secondary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <input
                name="title"
                required
                maxLength={200}
                placeholder="The question (e.g. What did you notice this week?)"
                className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-white/20"
              />
              <textarea
                name="description"
                maxLength={1000}
                placeholder="Optional context for respondents"
                className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-white/20"
                style={{ minHeight: "80px" }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.72rem] uppercase tracking-wider text-text-muted">
                    Close date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    name="closeAt"
                    className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[0.82rem] text-text-primary outline-none transition-colors focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.72rem] uppercase tracking-wider text-text-muted">
                    Response cap (optional)
                  </label>
                  <input
                    type="number"
                    name="maxResponses"
                    min="1"
                    placeholder="∞"
                    className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[0.82rem] text-text-primary outline-none transition-colors focus:border-white/20"
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" name="moderationEnabled" value="true" className="h-4 w-4 rounded" />
                <span className="text-[0.85rem] text-text-secondary">
                  Review responses before they appear
                </span>
              </label>
            </div>
            {error && <p className="mt-4 text-[0.82rem] text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 py-3 text-[0.85rem] font-medium text-deep transition-all disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create collection"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CollectionDetail({
  collection,
  observations,
  pendingObservations,
  spaceId,
  canManage,
  onBack,
}: {
  collection: CollectionView;
  observations: ObservationView[];
  pendingObservations: ObservationView[];
  spaceId: string;
  canManage: boolean;
  onBack: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const responses = useMemo(
    () => observations.filter((o) => o.collectionId === collection.id),
    [observations, collection.id]
  );
  const pending = useMemo(
    () => pendingObservations.filter((o) => o.collectionId === collection.id),
    [pendingObservations, collection.id]
  );

  function moderate(observationId: string, action: "approve" | "reject") {
    const fd = new FormData();
    fd.set("observationId", observationId);
    fd.set("spaceId", spaceId);
    fd.set("collectionId", collection.id);
    fd.set("action", action);
    startTransition(() => moderateObservationAction(fd));
  }

  function setModeration(enabled: boolean) {
    const fd = new FormData();
    fd.set("id", collection.id);
    fd.set("spaceId", spaceId);
    fd.set("moderationEnabled", String(enabled));
    startTransition(() => updateCollectionAction(fd));
  }

  function toggleOpen() {
    const fd = new FormData();
    fd.set("id", collection.id);
    fd.set("spaceId", spaceId);
    fd.set("isOpen", String(!collection.isOpen));
    startTransition(() => updateCollectionAction(fd));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", collection.id);
    fd.set("spaceId", spaceId);
    startTransition(async () => {
      await deleteCollectionAction(fd);
      onBack();
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-[0.8rem] text-text-muted transition-colors hover:text-text-secondary"
      >
        ← Back to collections
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="mb-2 font-display text-2xl font-light text-text-primary">
            {collection.title}
          </h2>
          <p className="mb-1 text-[0.72rem] uppercase tracking-wider text-text-muted">
            {collection.responseCount} response{collection.responseCount !== 1 ? "s" : ""} ·{" "}
            {collection.isOpen ? "Open" : "Closed"}
            {collection.maxResponses != null && ` · cap ${collection.maxResponses}`}
          </p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(collection.shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary transition-colors hover:bg-white/[0.04]"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      {collection.description && (
        <p className="mt-3 text-[0.85rem] leading-relaxed text-text-secondary">
          {collection.description}
        </p>
      )}

      {/* Management controls */}
      {canManage && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] p-4">
          <button
            onClick={toggleOpen}
            disabled={isPending}
            className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.78rem] text-text-secondary transition-colors hover:bg-white/[0.04] disabled:opacity-50"
          >
            {collection.isOpen ? "Close collection" : "Reopen collection"}
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-text-secondary">
            <input
              type="checkbox"
              checked={collection.moderationEnabled}
              onChange={(e) => setModeration(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded"
            />
            Moderate responses
          </label>
          <div className="ml-auto">
            {confirmDelete ? (
              <span className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[0.78rem] text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  Confirm delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[0.78rem] text-text-muted hover:text-text-secondary"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.78rem] text-text-muted transition-colors hover:bg-white/[0.04] hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Moderation queue */}
      {canManage && pending.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 flex items-center gap-2 text-[0.82rem] font-medium text-text-primary">
            Pending review
            <span className="rounded-full bg-warm-1/15 px-2 py-0.5 text-[0.65rem] font-medium text-warm-1">
              {pending.length}
            </span>
          </h3>
          <div className="flex flex-col gap-3">
            {pending.map((obs) => (
              <ResponseCard
                key={obs.id}
                obs={obs}
                actions={
                  <div className="flex gap-2">
                    <button
                      onClick={() => moderate(obs.id, "approve")}
                      disabled={isPending}
                      className="rounded-lg border border-cool-1/30 bg-cool-1/10 px-3 py-1.5 text-[0.72rem] text-cool-1 transition-colors hover:bg-cool-1/20 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => moderate(obs.id, "reject")}
                      disabled={isPending}
                      className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-muted transition-colors hover:bg-white/[0.04] hover:text-red-400 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Approved responses */}
      <div className="mt-8">
        <h3 className="mb-3 text-[0.82rem] font-medium text-text-primary">Responses</h3>
        {responses.length === 0 ? (
          <p className="rounded-2xl border border-white/[0.06] p-8 text-center text-[0.82rem] text-text-muted">
            No responses yet. Share the link to start gathering observations.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {responses.map((obs) => (
              <ResponseCard key={obs.id} obs={obs} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResponseCard({ obs, actions }: { obs: ObservationView; actions?: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.04] p-5"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {obs.media.length > 0 && <MediaAttachments media={obs.media} />}
      <div className="text-[0.72rem] tracking-wide text-text-muted">
        {obs.time} · {obs.author}
      </div>
      <div className="mt-1.5 text-[0.92rem] leading-relaxed text-text-primary">{obs.text}</div>
      {actions && <div className="mt-3">{actions}</div>}
    </div>
  );
}

import { notFound } from "next/navigation";
import { getCollectionByToken } from "@/lib/db/queries";
import { CollectionForm } from "./collection-form";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const collection = await getCollectionByToken(token);

  if (!collection) notFound();

  const isClosed =
    !collection.isOpen ||
    (collection.closeAt && collection.closeAt < new Date()) ||
    (collection.maxResponses != null &&
      collection.responseCount >= collection.maxResponses);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0A0E1A" }}
    >
      <div className="mx-auto max-w-[640px] px-6 py-12">
        {/* Wordmark */}
        <div className="mb-12">
          <span
            className="font-display text-lg font-light italic"
            style={{
              background: "linear-gradient(90deg, var(--color-cool-1), var(--color-cool-2))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            swells
          </span>
        </div>

        {isClosed ? (
          <div>
            <h1 className="font-display text-3xl font-light text-text-primary mb-4">
              {collection.title}
            </h1>
            <p className="text-text-secondary">This collection is closed.</p>
          </div>
        ) : (
          <CollectionForm
            token={token}
            title={collection.title}
            description={collection.description ?? undefined}
            moderationEnabled={collection.moderationEnabled}
          />
        )}
      </div>
    </div>
  );
}

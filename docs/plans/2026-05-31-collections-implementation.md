# Collections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add public shareable submission links — anyone with a link can submit an observation (text + photo + voice + file) without an account; submissions flow through the full AI pipeline.

**Architecture:** New `collections` table linked to spaces. Public routes at `/c/[token]` (submission page) and `/api/c/[token]/*` (presign + submit) validate the collection token instead of user auth. Submissions land as observations with `collectionId` set and `moderationStatus: approved` (or `pending` if moderation is on). A new Collect tab in AppShell handles CRUD. All existing views get a Source filter dropdown.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon, Zod validation, `crypto.randomBytes` for token generation, R2 via `@aws-sdk/client-s3`, `after()` from `next/server` for async pipeline trigger.

---

## Task 1: Schema — collections table + observations changes

**Files:**
- Modify: `src/lib/db/schema.ts`

**Context:** The `observations` table is defined in schema.ts. `authorId` already uses `onDelete: "set null"` and is NOT `.notNull()` — it's already nullable. No change needed there. We add: `collections` table, `collectionId` FK on observations, `moderationStatus` text column on observations.

**Step 1: Add collections table and update observations in schema.ts**

After the `spaceMemberships` table and before `observations`, add:

```ts
export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  token: text("token").notNull().unique(),
  isOpen: boolean("is_open").default(true).notNull(),
  closeAt: timestamp("close_at", { mode: "date" }),
  maxResponses: integer("max_responses"),
  responseCount: integer("response_count").default(0).notNull(),
  moderationEnabled: boolean("moderation_enabled").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
```

Add two columns to the `observations` table (after `isDemo`):

```ts
  collectionId: uuid("collection_id").references(() => collections.id, {
    onDelete: "set null",
  }),
  moderationStatus: text("moderation_status")
    .$type<"approved" | "pending" | "rejected">()
    .default("approved")
    .notNull(),
```

**Step 2: Push schema to Neon**

```bash
cd app && npx drizzle-kit push
```

Expected: "Changes applied" with 1 new table + 2 new columns.

**Step 3: Verify build still passes**

```bash
npm run build
```

Expected: No TypeScript errors. 0 new warnings.

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(schema): add collections table, collectionId + moderationStatus on observations"
```

---

## Task 2: DB queries for collections

**Files:**
- Modify: `src/lib/db/queries.ts`

**Context:** All DB access goes through `queries.ts`. Follow the existing pattern — functions return raw Drizzle results, transforms handle view conversion.

**Step 1: Add collection queries**

Add to the end of `queries.ts`:

```ts
import { collections } from "./schema";

// ── Collection queries ──

export async function getCollectionsForSpace(spaceId: string) {
  return db
    .select()
    .from(collections)
    .where(eq(collections.spaceId, spaceId))
    .orderBy(desc(collections.createdAt));
}

export async function getCollectionByToken(token: string) {
  const [row] = await db
    .select()
    .from(collections)
    .where(eq(collections.token, token))
    .limit(1);
  return row ?? null;
}

export async function createCollection(data: {
  spaceId: string;
  title: string;
  description?: string | null;
  token: string;
  closeAt?: Date | null;
  maxResponses?: number | null;
  moderationEnabled?: boolean;
}) {
  const [row] = await db.insert(collections).values(data).returning();
  return row;
}

export async function updateCollection(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    isOpen: boolean;
    closeAt: Date | null;
    maxResponses: number | null;
    moderationEnabled: boolean;
  }>
) {
  await db.update(collections).set(data).where(eq(collections.id, id));
}

export async function deleteCollection(id: string) {
  await db.delete(collections).where(eq(collections.id, id));
}

export async function incrementCollectionResponseCount(id: string) {
  await db
    .update(collections)
    .set({ responseCount: sql`${collections.responseCount} + 1` })
    .where(eq(collections.id, id));
}

export async function getObservationsForCollection(collectionId: string) {
  return db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.collectionId, collectionId),
        ne(observations.moderationStatus, "rejected")
      )
    )
    .orderBy(desc(observations.createdAt));
}
```

Make sure `sql`, `desc`, `ne` are imported from `drizzle-orm` at the top.

**Step 2: Build check**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/db/queries.ts
git commit -m "feat(queries): add collection CRUD and observation filter queries"
```

---

## Task 3: Types + transforms for collections

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db/transforms.ts`

**Step 1: Add CollectionView to types.ts**

```ts
export interface CollectionView {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  token: string;
  isOpen: boolean;
  closeAt: string | null; // ISO string
  maxResponses: number | null;
  responseCount: number;
  moderationEnabled: boolean;
  createdAt: string;
  shareUrl: string;
}
```

Also add `collectionId?: string | null` and `moderationStatus?: "approved" | "pending" | "rejected"` to `ObservationView`.

**Step 2: Add toCollectionView to transforms.ts**

```ts
export function toCollectionView(
  row: typeof import("./schema").collections.$inferSelect,
  baseUrl: string
): CollectionView {
  return {
    id: row.id,
    spaceId: row.spaceId,
    title: row.title,
    description: row.description ?? null,
    token: row.token,
    isOpen: row.isOpen,
    closeAt: row.closeAt ? row.closeAt.toISOString() : null,
    maxResponses: row.maxResponses ?? null,
    responseCount: row.responseCount,
    moderationEnabled: row.moderationEnabled,
    createdAt: row.createdAt.toISOString(),
    shareUrl: `${baseUrl}/c/${row.token}`,
  };
}
```

Also update `toObservationView` to map the two new fields:
```ts
collectionId: row.collectionId ?? null,
moderationStatus: row.moderationStatus ?? "approved",
```

**Step 3: Build check**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/db/transforms.ts
git commit -m "feat(types): add CollectionView, collectionId+moderationStatus to ObservationView"
```

---

## Task 4: Rate limiting utility

**Files:**
- Create: `src/lib/rate-limit.ts`

**Context:** No Redis available — use a simple in-memory Map with TTL cleanup. Good enough for single-process serverless (each invocation gets its own memory, but this provides per-request protection against bursts within a single cold-start window). For production multi-instance rate limiting, Upstash Redis would be added later.

**Step 1: Create rate-limit.ts**

```ts
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Returns true if the request is allowed, false if rate limited. */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}
```

**Step 2: Build check**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat(util): add in-memory rate limit helper"
```

---

## Task 5: Public presign API route

**Files:**
- Create: `src/app/api/c/[token]/presign/route.ts`

**Context:** The existing presign route at `app/api/upload/presign/route.ts` requires user auth. This new route validates a collection token instead. Media goes to `collections/[token]/[uuid]/[filename]` in R2. Reuse `generatePresignedUploadUrl` and `getPublicUrl` from `src/lib/r2.ts`.

**Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCollectionByToken } from "@/lib/db/queries";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "audio/webm", "audio/mp4", "audio/ogg", "audio/wav",
  "application/pdf", "text/plain", "text/csv",
]);

function getMediaType(contentType: string): "image" | "voice" | "file" | null {
  const base = contentType.split(";")[0].trim();
  if (base.startsWith("image/")) return "image";
  if (base.startsWith("audio/")) return "voice";
  if (["application/pdf", "text/plain", "text/csv"].includes(base)) return "file";
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!checkRateLimit(`presign:${ip}:${token}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const collection = await getCollectionByToken(token);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!collection.isOpen) return NextResponse.json({ error: "Closed" }, { status: 403 });
  if (collection.closeAt && collection.closeAt < new Date()) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }
  if (collection.maxResponses && collection.responseCount >= collection.maxResponses) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }

  const { fileName, contentType } = await req.json();
  if (!fileName || !contentType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const base = contentType.split(";")[0].trim();
  if (!ALLOWED_TYPES.has(base)) {
    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }

  const mediaType = getMediaType(contentType);
  const fileId = crypto.randomUUID();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const key = `collections/${token}/${fileId}/${sanitized}`;

  const { uploadUrl } = await generatePresignedUploadUrl(key, base, 25 * 1024 * 1024);
  const publicUrl = getPublicUrl(key);

  return NextResponse.json({ uploadUrl, key, publicUrl, mediaType });
}
```

**Step 2: Build check**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/c/
git commit -m "feat(api): add collection presign endpoint at /api/c/[token]/presign"
```

---

## Task 6: Public submit API route

**Files:**
- Create: `src/app/api/c/[token]/submit/route.ts`

**Context:** Receives the form submission, validates the collection is open, creates an observation with `collectionId` set and `moderationStatus` based on `collection.moderationEnabled`. If approved, triggers the AI pipeline via `after()`. Increments response count only on approval.

**Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { observations, observationMedia } from "@/lib/db/schema";
import {
  getCollectionByToken,
  incrementCollectionResponseCount,
} from "@/lib/db/queries";
import { processObservation, IMAGE_OBSERVATION_PLACEHOLDER } from "@/lib/ai/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";

const submitSchema = z.object({
  text: z.string().max(5000).optional(),
  name: z.string().max(100).optional(),
  mediaRefs: z.array(z.object({
    key: z.string(),
    url: z.string(),
    type: z.enum(["image", "voice", "file"]),
    fileName: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
  })).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!checkRateLimit(`submit:${ip}:${token}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const collection = await getCollectionByToken(token);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!collection.isOpen) return NextResponse.json({ error: "Closed" }, { status: 403 });
  if (collection.closeAt && collection.closeAt < new Date()) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }
  if (collection.maxResponses && collection.responseCount >= collection.maxResponses) {
    return NextResponse.json({ error: "Closed" }, { status: 403 });
  }

  const body = submitSchema.parse(await req.json());
  const { text, name, mediaRefs } = body;

  const hasText = !!text?.trim();
  const hasMedia = mediaRefs.length > 0;
  if (!hasText && !hasMedia) {
    return NextResponse.json({ error: "Please add text or media" }, { status: 400 });
  }

  const moderationStatus = collection.moderationEnabled ? "pending" : "approved";
  const contentText = hasText ? text! : IMAGE_OBSERVATION_PLACEHOLDER;

  const [inserted] = await db
    .insert(observations)
    .values({
      spaceId: collection.spaceId,
      collectionId: collection.id,
      authorName: name?.trim() || "Anonymous",
      contentText,
      signalStrength: "single",
      moderationStatus,
    })
    .returning({ id: observations.id });

  if (mediaRefs.length > 0) {
    await db.insert(observationMedia).values(
      mediaRefs.map((m) => ({
        observationId: inserted.id,
        type: m.type,
        storageKey: m.key,
        url: m.url,
        fileName: m.fileName,
        mimeType: m.mimeType,
        fileSize: m.fileSize,
      }))
    );
  }

  if (moderationStatus === "approved") {
    await incrementCollectionResponseCount(collection.id);
    after(async () => {
      await processObservation(inserted.id, collection.spaceId);
    });
  }

  return NextResponse.json({ success: true, moderated: moderationStatus === "pending" });
}
```

**Step 2: Build check**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/c/[token]/submit/
git commit -m "feat(api): add collection submit endpoint at /api/c/[token]/submit"
```

---

## Task 7: Public submission page

**Files:**
- Create: `src/app/c/[token]/page.tsx`
- Create: `src/app/c/[token]/collection-form.tsx` (client component)

**Context:** This is a public page — no auth, no app shell. It should feel like Swells but stripped back. Uses the same upload flow as the observation modal (presign → XHR → submit). The `page.tsx` is a server component that fetches the collection and renders the appropriate state. The `collection-form.tsx` handles the interactive form.

**Step 1: Create page.tsx**

```tsx
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
          <span className="font-display text-lg font-light italic"
            style={{ background: "linear-gradient(90deg, var(--color-cool-1), var(--color-cool-2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
          />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create collection-form.tsx**

This is a full client component. Mirrors the observation modal upload logic but as a standalone page form.

```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";

interface Props {
  token: string;
  title: string;
  description?: string;
}

type PendingMedia = {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  objectUrl: string;
  uploadProgress: number;
  uploaded: boolean;
  storageKey?: string;
  publicUrl?: string;
  type: "image" | "voice" | "file";
};

async function uploadFile(
  token: string,
  file: File,
  fileName: string,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<{ key: string; publicUrl: string; mediaType: "image" | "voice" | "file" }> {
  const res = await fetch(`/api/c/${token}/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  const { uploadUrl, key, publicUrl, mediaType } = await res.json();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener("load", () => xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.send(file);
  });

  return { key, publicUrl, mediaType };
}

export function CollectionForm({ token, title, description }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  const addFiles = useCallback((files: FileList | File[], type: "image" | "voice" | "file") => {
    const items: PendingMedia[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      mimeType: file.type,
      objectUrl: URL.createObjectURL(file),
      uploadProgress: 0,
      uploaded: false,
      type,
    }));
    setPendingMedia((prev) => [...prev, ...items]);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const text = (form.elements.namedItem("text") as HTMLTextAreaElement).value.trim();
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();

    if (!text && pendingMedia.length === 0) {
      setError("Please add some text or attach media.");
      return;
    }

    setSubmitting(true);

    const mediaRefs: { key: string; url: string; type: string; fileName: string; mimeType: string; fileSize: number }[] = [];

    try {
      for (const item of pendingMedia) {
        const result = await uploadFile(token, item.file, item.fileName, item.mimeType, (pct) => {
          setPendingMedia((prev) => prev.map((m) => m.id === item.id ? { ...m, uploadProgress: pct } : m));
        });
        mediaRefs.push({ key: result.key, url: result.publicUrl, type: result.mediaType, fileName: item.fileName, mimeType: item.mimeType, fileSize: item.file.size });
      }
    } catch {
      setError("Upload failed. Please try again.");
      setSubmitting(false);
      return;
    }

    const res = await fetch(`/api/c/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || undefined, name: name || undefined, mediaRefs }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div>
        <h1 className="font-display text-3xl font-light text-text-primary mb-4">{title}</h1>
        <p className="text-text-secondary mb-6">Thank you. Your observation has been added.</p>
        <button
          onClick={() => { setSubmitted(false); setPendingMedia([]); }}
          className="text-[0.85rem] text-cool-1 hover:text-cool-2 transition-colors"
        >
          Submit another →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="font-display text-[2rem] font-light leading-tight text-text-primary mb-3">
        {title}
      </h1>
      {description && (
        <p className="text-[0.9rem] leading-relaxed text-text-secondary mb-8">{description}</p>
      )}

      <input
        type="text"
        name="name"
        placeholder="Your name (optional)"
        className="mb-4 w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors"
      />

      <textarea
        name="text"
        placeholder="What do you notice?"
        className="mb-4 w-full resize-y rounded-[14px] border border-white/8 bg-white/[0.04] p-4 text-[0.92rem] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cool-1/30"
        style={{ minHeight: "140px" }}
      />

      {/* Media previews */}
      {pendingMedia.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pendingMedia.map((m) => (
            <div key={m.id} className="relative">
              {m.type === "image" ? (
                <img src={m.objectUrl} className="h-16 w-16 rounded-lg object-cover opacity-80" alt="" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.06] text-[0.65rem] text-text-muted text-center px-1">
                  {m.type === "voice" ? "🎙" : "📄"} {m.fileName.slice(0, 12)}
                </div>
              )}
              {!m.uploaded && m.uploadProgress > 0 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-[0.65rem] text-white">
                  {Math.round(m.uploadProgress)}%
                </div>
              )}
              <button
                type="button"
                onClick={() => setPendingMedia((prev) => prev.filter((x) => x.id !== m.id))}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-deep text-[0.6rem] text-text-muted hover:text-white"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Media buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => imageInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2 text-[0.78rem] text-text-secondary hover:bg-white/[0.04] transition-colors">
          📷 Photo
        </button>
        <button
          type="button"
          onClick={async () => {
            if (voice.status === "idle") {
              await voice.start();
            } else {
              const blob = await voice.stop();
              if (blob && blob.size > 0) {
                const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "mp4" : "ogg";
                addFiles([new File([blob], `voice-${new Date().getTime()}.${ext}`, { type: blob.type })], "voice");
              }
            }
          }}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[0.78rem] transition-colors ${voice.status === "recording" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-white/8 text-text-secondary hover:bg-white/[0.04]"}`}
        >
          {voice.status === "recording" ? (
            <><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" /> Stop</>
          ) : "🎙 Voice"}
        </button>
        {voice.status === "idle" && (
          <button type="button" onClick={() => audioInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2 text-[0.78rem] text-text-muted hover:bg-white/[0.04] transition-colors">
            ↑ Upload audio
          </button>
        )}
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-white/8 px-3 py-2 text-[0.78rem] text-text-secondary hover:bg-white/[0.04] transition-colors">
          📎 File
        </button>
      </div>

      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files, "image"); e.target.value = ""; }} />
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.csv" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files, "file"); e.target.value = ""; }} />
      <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,.mp3,.wav,.m4a" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files, "voice"); e.target.value = ""; }} />

      {error && <p className="mb-4 text-[0.82rem] text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 py-3.5 text-[0.88rem] font-medium text-deep transition-all hover:shadow-[0_4px_24px_rgba(78,205,196,0.3)] disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit observation"}
      </button>
    </form>
  );
}
```

**Step 3: Build check**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/c/
git commit -m "feat(page): add public collection submission page at /c/[token]"
```

---

## Task 8: Collection CRUD server actions

**Files:**
- Modify: `src/app/(app)/actions.ts`

**Context:** Server actions follow the existing pattern — `"use server"`, Zod validation, auth check, permission check. Add four new actions: `createCollectionAction`, `updateCollectionAction`, `deleteCollectionAction`, `moderateObservationAction`.

**Step 1: Add token generator helper**

At the top of actions.ts, the `randomBytes` import is already there. Add this helper:

```ts
function generateCollectionToken(): string {
  return randomBytes(9).toString("base64url"); // 12 URL-safe chars
}
```

**Step 2: Add collection actions**

```ts
import { collections } from "@/lib/db/schema";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionsForSpace,
  getCollectionByToken,
  incrementCollectionResponseCount,
} from "@/lib/db/queries";
import { toCollectionView } from "@/lib/db/transforms";

const createCollectionSchema = z.object({
  spaceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  closeAt: z.string().datetime().optional(),
  maxResponses: z.coerce.number().int().positive().optional(),
  moderationEnabled: z.coerce.boolean().optional(),
});

export async function createCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createCollectionSchema.parse(Object.fromEntries(formData));
  const role = await getMemberRole(parsed.spaceId, session.user.id);
  if (!role || !canEditSpace(role)) throw new Error("Permission denied");

  const baseUrl = getBaseUrl();
  const row = await createCollection({
    spaceId: parsed.spaceId,
    title: parsed.title,
    description: parsed.description ?? null,
    token: generateCollectionToken(),
    closeAt: parsed.closeAt ? new Date(parsed.closeAt) : null,
    maxResponses: parsed.maxResponses ?? null,
    moderationEnabled: parsed.moderationEnabled ?? false,
  });

  revalidatePath(`/dashboard/${parsed.spaceId}`);
  return toCollectionView(row, baseUrl);
}

const updateCollectionSchema = z.object({
  id: z.string().uuid(),
  spaceId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isOpen: z.coerce.boolean().optional(),
  closeAt: z.string().datetime().optional().nullable(),
  maxResponses: z.coerce.number().int().positive().optional().nullable(),
  moderationEnabled: z.coerce.boolean().optional(),
});

export async function updateCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updateCollectionSchema.parse(Object.fromEntries(formData));
  const role = await getMemberRole(parsed.spaceId, session.user.id);
  if (!role || !canEditSpace(role)) throw new Error("Permission denied");

  await updateCollection(parsed.id, {
    title: parsed.title,
    description: parsed.description,
    isOpen: parsed.isOpen,
    closeAt: parsed.closeAt ? new Date(parsed.closeAt) : parsed.closeAt === null ? null : undefined,
    maxResponses: parsed.maxResponses,
    moderationEnabled: parsed.moderationEnabled,
  });

  revalidatePath(`/dashboard/${parsed.spaceId}`);
}

export async function deleteCollectionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().uuid().parse(formData.get("id"));
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const role = await getMemberRole(spaceId, session.user.id);
  if (!role || !canEditSpace(role)) throw new Error("Permission denied");

  await deleteCollection(id);
  revalidatePath(`/dashboard/${spaceId}`);
}

export async function moderateObservationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const obsId = z.string().uuid().parse(formData.get("observationId"));
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const collectionId = z.string().uuid().parse(formData.get("collectionId"));
  const action = z.enum(["approve", "reject"]).parse(formData.get("action"));

  const role = await getMemberRole(spaceId, session.user.id);
  if (!role || !canEditSpace(role)) throw new Error("Permission denied");

  const newStatus = action === "approve" ? "approved" : "rejected";
  await db
    .update(observations)
    .set({ moderationStatus: newStatus })
    .where(eq(observations.id, obsId));

  if (action === "approve") {
    await incrementCollectionResponseCount(collectionId);
    after(async () => {
      await processObservation(obsId, spaceId);
    });
  }

  revalidatePath(`/dashboard/${spaceId}`);
}
```

**Step 3: Build check**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/\(app\)/actions.ts
git commit -m "feat(actions): add collection CRUD and moderation server actions"
```

---

## Task 9: Fetch collections in dashboard page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (or `dashboard/[spaceId]/page.tsx` — wherever data is fetched)

**Context:** The dashboard page is a server component that fetches all data and passes props to AppShell. Add collections fetch here.

**Step 1: Find the dashboard data-fetching page**

```bash
find src/app/\(app\) -name "page.tsx" | head -5
```

**Step 2: Add collections fetch**

In the dashboard page, alongside existing data fetches, add:

```ts
import { getCollectionsForSpace } from "@/lib/db/queries";
import { toCollectionView } from "@/lib/db/transforms";
import { getBaseUrl } from "@/lib/env";

// Inside the page component, alongside other fetches:
const collectionsRaw = await getCollectionsForSpace(spaceId);
const baseUrl = getBaseUrl();
const collections = collectionsRaw.map((c) => toCollectionView(c, baseUrl));
```

Pass `collections` to `AppShell` props.

**Step 3: Add `collections` to AppShellProps in app-shell.tsx**

```ts
collections?: CollectionView[];
```

**Step 4: Build check**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/\(app\)/
git commit -m "feat(dashboard): fetch collections and pass to AppShell"
```

---

## Task 10: Collect tab component

**Files:**
- Create: `src/components/app/collect-view.tsx`

**Context:** A new view tab in AppShell. Shows a list of collections with open/close toggle, copy-link button, response count. Has a "New collection" button that opens a creation modal. Clicking a collection shows its submissions.

**Step 1: Create collect-view.tsx**

This is a client component. Key sections:

```tsx
"use client";

import { useState, useTransition } from "react";
import type { CollectionView, ObservationView } from "@/lib/types";
import {
  createCollectionAction,
  updateCollectionAction,
  deleteCollectionAction,
  moderateObservationAction,
} from "@/app/(app)/actions";

interface CollectViewProps {
  collections: CollectionView[];
  spaceId: string;
  canManage: boolean;
}

export function CollectView({ collections, spaceId, canManage }: CollectViewProps) {
  const [selectedCollection, setSelectedCollection] = useState<CollectionView | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  // Collection list view
  if (!selectedCollection) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl mx-auto w-full">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-light text-text-primary">Collections</h2>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-white/[0.06] border border-white/8 px-4 py-2 text-[0.82rem] text-text-secondary hover:bg-white/[0.09] transition-colors"
            >
              + New collection
            </button>
          )}
        </div>

        {collections.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] p-10 text-center">
            <p className="text-text-secondary text-[0.88rem]">No collections yet.</p>
            {canManage && (
              <button onClick={() => setShowCreateModal(true)} className="mt-4 text-[0.82rem] text-cool-1 hover:text-cool-2 transition-colors">
                Create your first collection →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {collections.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/[0.06] p-5 cursor-pointer hover:border-white/[0.1] transition-colors"
                style={{ background: "rgba(255,255,255,0.02)" }}
                onClick={() => setSelectedCollection(c)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block h-2 w-2 rounded-full ${c.isOpen ? "bg-cool-1" : "bg-white/20"}`} />
                      <span className="text-[0.7rem] uppercase tracking-wider text-text-muted">
                        {c.isOpen ? "Open" : "Closed"} · {c.responseCount} response{c.responseCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-text-primary text-[0.92rem] font-medium truncate">{c.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => copyLink(c.shareUrl, c.id)}
                      className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary hover:bg-white/[0.04] transition-colors"
                    >
                      {copied === c.id ? "Copied!" : "Copy link"}
                    </button>
                    {canManage && (
                      <button
                        onClick={() => toggleOpen(c)}
                        disabled={isPending}
                        className="rounded-lg border border-white/8 px-3 py-1.5 text-[0.72rem] text-text-secondary hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                      >
                        {c.isOpen ? "Close" : "Open"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && canManage && (
          <CreateCollectionModal
            spaceId={spaceId}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    );
  }

  // Collection detail view
  return (
    <CollectionDetail
      collection={selectedCollection}
      spaceId={spaceId}
      canManage={canManage}
      onBack={() => setSelectedCollection(null)}
    />
  );
}
```

**Step 2: Add CreateCollectionModal sub-component** (in the same file)

Simple form with title, description, optional close date, optional response cap, moderation toggle:

```tsx
function CreateCollectionModal({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [newLink, setNewLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("spaceId", spaceId);
    startTransition(async () => {
      const result = await createCollectionAction(fd);
      setNewLink(result.shareUrl);
    });
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: "rgba(10,14,26,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="w-[90%] max-w-[520px] rounded-3xl border border-white/[0.06] bg-surface p-8">
        {newLink ? (
          <div>
            <h3 className="font-display text-2xl font-light text-text-primary mb-4">Collection created</h3>
            <p className="text-[0.82rem] text-text-secondary mb-3">Share this link:</p>
            <div className="rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.82rem] text-cool-1 font-mono break-all mb-6">{newLink}</div>
            <button onClick={onClose} className="w-full rounded-xl bg-white/[0.06] border border-white/8 py-2.5 text-[0.85rem] text-text-secondary hover:bg-white/[0.09] transition-colors">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-2xl font-light text-text-primary">New collection</h3>
              <button type="button" onClick={onClose} className="text-text-muted hover:text-text-secondary">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <input name="title" required placeholder="The question (e.g. What did you notice this week?)"
                className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors" />
              <textarea name="description" placeholder="Optional context for respondents"
                className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[0.88rem] text-text-primary placeholder:text-text-muted outline-none focus:border-white/20 transition-colors resize-none"
                style={{ minHeight: "80px" }} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.72rem] uppercase tracking-wider text-text-muted">Close date (optional)</label>
                  <input type="datetime-local" name="closeAt" className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[0.82rem] text-text-primary outline-none focus:border-white/20 transition-colors" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.72rem] uppercase tracking-wider text-text-muted">Response cap (optional)</label>
                  <input type="number" name="maxResponses" min="1" placeholder="∞"
                    className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[0.82rem] text-text-primary outline-none focus:border-white/20 transition-colors" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="moderationEnabled" value="true" className="h-4 w-4 rounded" />
                <span className="text-[0.85rem] text-text-secondary">Require moderation before responses appear</span>
              </label>
            </div>
            <button type="submit" disabled={isPending}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-cool-1 to-cool-2 py-3 text-[0.85rem] font-medium text-deep disabled:opacity-50 transition-all">
              {isPending ? "Creating…" : "Create collection"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Add CollectionDetail sub-component** (in same file)

Shows the collection's submissions. When moderation is on, shows pending submissions with approve/reject buttons.

```tsx
function CollectionDetail({ collection, spaceId, canManage, onBack }: {
  collection: CollectionView;
  spaceId: string;
  canManage: boolean;
  onBack: () => void;
}) {
  // Fetch pending observations via a server action or pass them as props from parent
  // For simplicity: show a message about moderation queue, link to River view with filter
  // Full implementation: fetch observations with collectionId + moderationStatus
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl mx-auto w-full">
      <button onClick={onBack} className="mb-6 flex items-center gap-1.5 text-[0.8rem] text-text-muted hover:text-text-secondary transition-colors">
        ← Back to collections
      </button>
      <h2 className="font-display text-2xl font-light text-text-primary mb-2">{collection.title}</h2>
      <p className="text-[0.72rem] uppercase tracking-wider text-text-muted mb-6">
        {collection.responseCount} response{collection.responseCount !== 1 ? "s" : ""} · {collection.isOpen ? "Open" : "Closed"}
      </p>
      {collection.description && (
        <p className="text-[0.85rem] text-text-secondary mb-6">{collection.description}</p>
      )}
      <p className="text-[0.82rem] text-text-secondary">
        Responses appear in the River, Signals, and Constellation views. Use the Source filter to show only this collection.
      </p>
    </div>
  );
}
```

**Step 4: Build check**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/components/app/collect-view.tsx
git commit -m "feat(component): add CollectView with collection list, create modal, detail view"
```

---

## Task 11: Wire Collect tab into AppShell

**Files:**
- Modify: `src/components/app/app-shell.tsx`

**Step 1: Add "collect" to the View type and nav**

```ts
type View = "river" | "constellation" | "landscape" | "heat" | "reflect" | "timeline" | "collect";
```

Add to `VIEW_LABELS`:
```ts
collect: "Collect",
```

Import `CollectView` with `dynamic()`:
```ts
const CollectView = dynamic(() => import("@/components/app/collect-view").then((m) => m.CollectView));
```

Add `collections?: CollectionView[]` to `AppShellProps`.

Add the view render:
```tsx
{activeView === "collect" && (
  <CollectView
    collections={collections ?? []}
    spaceId={spaceId}
    canManage={canEditSpace(userRole)}
  />
)}
```

Add nav button (desktop header + mobile tab bar) — follow the existing pattern for other views.

**Step 2: Build check**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(nav): add Collect tab to AppShell navigation"
```

---

## Task 12: Source filter on River view

**Files:**
- Modify: `src/components/app/river-view.tsx`
- Modify: `src/lib/types.ts` (add collections to ObservationView for filtering)

**Context:** River view already has search + filter chips. Add a "Source" dropdown. The dropdown options come from the collections available in the space. `ObservationView.collectionId` is already added in Task 3.

**Step 1: Add source filter state and UI to river-view.tsx**

```tsx
// Add to props:
collections?: CollectionView[];

// Add state:
const [sourceFilter, setSourceFilter] = useState<"all" | "no-collections" | "collections-only" | string>("all");

// Add to the filtered observations memo:
.filter((obs) => {
  if (sourceFilter === "all") return true;
  if (sourceFilter === "no-collections") return !obs.collectionId;
  if (sourceFilter === "collections-only") return !!obs.collectionId;
  return obs.collectionId === sourceFilter; // specific collection ID
})
```

Add the Source dropdown in the filter bar alongside the existing chips:

```tsx
<select
  value={sourceFilter}
  onChange={(e) => setSourceFilter(e.target.value)}
  className="rounded-xl border border-white/8 bg-deep px-3 py-1.5 text-[0.78rem] text-text-secondary outline-none"
>
  <option value="all">All sources</option>
  <option value="no-collections">Exclude collections</option>
  <option value="collections-only">Collections only</option>
  {(collections ?? []).map((c) => (
    <option key={c.id} value={c.id}>{c.title}</option>
  ))}
</select>
```

**Step 2: Pass collections to RiverView from AppShell**

In app-shell.tsx:
```tsx
<RiverView
  observations={observations}
  signals={signals}
  collections={collections}
/>
```

**Step 3: Build check**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/app/river-view.tsx src/components/app/app-shell.tsx
git commit -m "feat(filter): add Source filter to River view"
```

---

## Task 13: Source filter on Signals and Constellation views

**Files:**
- Modify: `src/components/app/landscape-view.tsx`
- Modify: `src/components/app/constellation-view.tsx`
- Modify: `src/components/app/app-shell.tsx`

**Context:** Same pattern as River — add `collections` prop and a source filter. For Signals (landscape), filter the signals whose observations match the source. For Constellation, filter nodes where the linked signal has matching observations. This is more complex — for an initial implementation, filter by passing a `filteredObservationIds: Set<string>` from AppShell based on the source selection, and each view uses it to hide irrelevant content.

**Simpler approach for v1:** Add the Source dropdown to each view. The dropdown controls a local `sourceFilter` state. Each view filters its `observations` prop the same way as River. Signals and constellation nodes that have no observations after filtering are hidden.

Follow the same pattern as Task 12 for each view.

**Build check after each view:**

```bash
npm run build
```

**Commit after all three:**

```bash
git add src/components/app/landscape-view.tsx src/components/app/constellation-view.tsx src/components/app/app-shell.tsx
git commit -m "feat(filter): add Source filter to Signals and Constellation views"
```

---

## Task 14: Final build, lint, smoke test

**Step 1: Full build + lint**

```bash
cd app && npm run build && npm run lint
```

Expected: 0 errors, 0 new warnings beyond pre-existing `<img>` ones.

**Step 2: Smoke test manually**

1. Start dev server: `npm run dev`
2. Sign in, go to a space, navigate to Collect tab
3. Create a collection → copy the link
4. Open the link in an incognito window → submit text + attach a photo
5. Back in dashboard: check River view — the submission should appear
6. Check Source filter — filter to that collection, submission visible; filter to "Exclude collections", submission hidden
7. Create a second collection with moderation on → submit via link → back in dashboard, observe pending state in Collect tab

**Step 3: Commit any fixes, then push**

```bash
git push
```

---

## Summary of files created/modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Add `collections` table, `collectionId` + `moderationStatus` on `observations` |
| `src/lib/db/queries.ts` | Add collection CRUD + moderation queries |
| `src/lib/types.ts` | Add `CollectionView`, update `ObservationView` |
| `src/lib/db/transforms.ts` | Add `toCollectionView`, update `toObservationView` |
| `src/lib/rate-limit.ts` | New: in-memory rate limiter |
| `src/app/api/c/[token]/presign/route.ts` | New: public presign endpoint |
| `src/app/api/c/[token]/submit/route.ts` | New: public submit endpoint |
| `src/app/c/[token]/page.tsx` | New: public submission page (server) |
| `src/app/c/[token]/collection-form.tsx` | New: submission form (client) |
| `src/app/(app)/actions.ts` | Add collection CRUD + moderation server actions |
| `src/app/(app)/dashboard/page.tsx` | Fetch + pass collections |
| `src/components/app/collect-view.tsx` | New: Collect tab component |
| `src/components/app/app-shell.tsx` | Add Collect tab to nav + wire props |
| `src/components/app/river-view.tsx` | Add Source filter |
| `src/components/app/landscape-view.tsx` | Add Source filter |
| `src/components/app/constellation-view.tsx` | Add Source filter |

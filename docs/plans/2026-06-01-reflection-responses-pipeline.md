# Reflection Responses → Pipeline Implementation Plan

**Goal:** Make a reflection *response* a first-class sensing input. When someone answers a reflection prompt, the response is treated as a considered observation: embedded + enriched, linked to the reflection's signal(s), and run through the full pipeline so it strengthens/evolves the originating signal **and** can seed a new signal if it diverges. Responses surface in the River tagged "via reflection".

**Decisions (agreed with user, 2026-06-01):**
1. **Unify** — a response becomes an `observation` with a new `reflectionId` link. Retire `reflection_responses` (migrate existing rows). Single source of truth.
2. **Show in River** — reflection-derived observations appear in the stream with a "via reflection" badge.
3. **Allow new-signal creation** — run the standard pipeline (cluster → evolve OR synthesise-new), *plus* guarantee a link to the prompting signal(s).

**Architecture:** Reuse `processObservation`. A new thin wrapper `processReflectionResponse` pre-links the response observation to the reflection's `signalIds`, runs the standard pipeline, then re-evolves those originating signals so attribution holds regardless of where clustering lands.

---

## Task R1: Schema — `reflectionId` on observations

**File:** `src/lib/db/schema.ts`

Add to the `observations` table (after `collectionId` / `moderationStatus`):

```ts
  reflectionId: uuid("reflection_id").references(() => reflections.id, {
    onDelete: "set null",
  }),
```

Note: `reflections` is declared *after* `observations` in the file. A `() => reflections.id` thunk reference is lazy, so forward-referencing is fine (same pattern Drizzle uses elsewhere). Verify build; if the type resolves awkwardly, move the column add but keep the thunk.

Then `npx drizzle-kit push` (adds one nullable column — non-destructive). Build check.

---

## Task R2: Types + transforms

**Files:** `src/lib/types.ts`, `src/lib/db/transforms.ts`

- `ObservationView`: add `reflectionId?: string | null`.
- `toObservationView`: map `reflectionId: row.reflectionId ?? null`.
- `toReflectionViewData`: change its `responseRows` parameter to accept observation-shaped rows. Map `text: row.contentText`, `authorName: row.authorName ?? "Anonymous"`, `time: formatRelativeTime(row.createdAt)`, grouped by `row.reflectionId`. (The `ReflectionResponseView` output shape is unchanged, so `reflection-view.tsx` needs no change.)

---

## Task R3: Queries — read responses from observations

**File:** `src/lib/db/queries.ts`

In `getReflectionsForSpace`, replace the `reflection_responses` fetch with observations carrying a `reflectionId` in the reflection set, excluding rejected:

```ts
const responseRows = await db
  .select()
  .from(observations)
  .where(
    and(
      inArray(observations.reflectionId, reflectionIds),
      ne(observations.moderationStatus, "rejected")
    )
  )
  .orderBy(desc(observations.createdAt));
```

Return `responseRows` as before (now observation rows). Confirm `inArray`, `and`, `ne`, `desc` are imported.

---

## Task R4: Submit action — create a linked observation

**File:** `src/app/(app)/actions.ts`

Rewrite `submitReflectionResponse`:
- Look up the reflection to get `spaceId` + `signalIds` (add `getReflectionById` query, or select inline).
- Insert an `observation`: `{ spaceId, authorId: userId, authorName, contentText: text, reflectionId, signalStrength: "single", moderationStatus: "approved" }`.
- `revalidatePath("/dashboard", "layout")`.
- `after(() => processReflectionResponse(observationId, spaceId, signalIds))`.

Keep Zod validation (`text` 1–5000). Drop the `reflectionResponses` insert.

---

## Task R5: Pipeline wrapper — `processReflectionResponse`

**File:** `src/lib/ai/pipeline.ts`

```ts
export async function processReflectionResponse(
  observationId: string,
  spaceId: string,
  signalIds: string[]
): Promise<void> {
  // 1. Pre-link to the prompting signal(s) so attribution is guaranteed
  //    even if clustering attaches the response elsewhere.
  if (signalIds.length > 0) {
    await db.insert(signalObservations)
      .values(signalIds.map((signalId) => ({ signalId, observationId })))
      .onConflictDoNothing();
  }
  // 2. Standard pipeline: embed → enrich → cluster → evolve OR synthesise-new.
  await processObservation(observationId, spaceId);
  // 3. Re-evolve the originating signal(s) so their counts/description/strength
  //    reflect the freshly linked response.
  for (const signalId of signalIds) {
    try { await evolveSignal(signalId, spaceId); }
    catch (e) { console.error(`[pipeline] reflect re-evolve failed for ${signalId}`, e); }
  }
}
```

Import `signalObservations` from schema. `evolveSignal` is already imported.

---

## Task R6: River — "via reflection" badge

**File:** `src/components/app/river-view.tsx`

In `ObservationCard`, when `obs.reflectionId` is set, render a small badge (mirroring the attachment chip style):

```tsx
{obs.reflectionId && (
  <span className="inline-flex items-center gap-1 rounded-[10px] bg-cool-2/12 px-2.5 py-0.5 text-[0.7rem] font-medium text-cool-2">
    ◑ via reflection
  </span>
)}
```

(No source-filter change in v1 — note as a possible follow-up.)

---

## Task R7: Migration of existing responses (one-off, optional)

**File:** `scripts/migrate-reflection-responses.ts` (or a documented SQL snippet)

Idempotent: for each `reflection_responses` row with no matching observation yet, insert an observation `{ author_id: user_id, author_name, space_id (from reflection), content_text: text, signal_strength: 'single', moderation_status: 'approved', reflection_id, created_at }`. Migrated rows are *not* re-run through the pipeline (they'll show in Reflect + River but won't be embedded/linked). Since current data is test data, this task is optional — confirm with user whether to run it or just clear test responses.

Leave the `reflection_responses` table defined in schema for now (don't drop in this PR — drop in a later cleanup once migration is confirmed).

---

## Task R8: Build, lint, smoke test, commit

- `npm run build && npm run lint` — 0 errors, no new warnings.
- Smoke: respond to an active reflection → response appears under the reflection (Reflect tab) AND in River with the "via reflection" badge → the reflection's signal shows an increased observation count / refreshed description in Signals + Constellation.
- Commit + push to master.

---

## Files touched

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Add `reflectionId` to observations |
| `src/lib/types.ts` | `reflectionId` on `ObservationView` |
| `src/lib/db/transforms.ts` | Map `reflectionId`; `toReflectionViewData` reads observation rows |
| `src/lib/db/queries.ts` | `getReflectionsForSpace` reads responses from observations; add `getReflectionById` |
| `src/app/(app)/actions.ts` | `submitReflectionResponse` creates linked observation + triggers pipeline |
| `src/lib/ai/pipeline.ts` | New `processReflectionResponse` wrapper |
| `src/components/app/river-view.tsx` | "via reflection" badge |
| `scripts/migrate-reflection-responses.ts` | Optional one-off migration |

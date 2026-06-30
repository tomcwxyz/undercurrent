# App Review — Improvements & New Features

_Created 2026-06-30. A living backlog from a full review of Swells covering
security/cost-safety, speed, quality/correctness, usability, and new features._

Each item has an **ID** (stable, for cross-reference), **priority**, **effort**
(S/M/L), and the **files** it touches. Check items off as they land.

Priority key: **P0** = exploitable / data-correctness, fix before real traffic ·
**P1** = high-impact speed/quality · **P2** = polish & nice-to-have ·
**Feature** = new capability.

---

## P0 — Cost-safety & security (fix first)

The dangerous combination: an unauthenticated Collection link can drain a space
owner's AI budget. Items SEC-1..SEC-5 should ship together.

- [ ] **SEC-1 · Enforce billing/limits on public collection submit** — _P0, M_
  `src/app/api/c/[token]/submit/route.ts:37-90`
  The public path never checks the space's subscription `observationLimit` and
  never calls `incrementObservationCount` (the authed path does —
  `src/app/(app)/actions.ts:85-97,127`). Every submission triggers paid
  Claude+OpenAI+Whisper processing. Resolve the space's owning subscription,
  enforce its limit, increment usage on approval, and add a hard per-collection
  ceiling independent of `maxResponses`.

- [ ] **SEC-2 · Move rate limiting to a shared store** — _P0, M_
  `src/lib/rate-limit.ts:6`; used in `submit/route.ts:33`, `c/[token]/presign/route.ts:27`
  In-memory `Map` resets per serverless instance/cold-start, so caps barely
  hold. Back with Upstash/Redis (or Postgres); fail-closed when unavailable.
  Derive client IP from the trusted platform header, not spoofable
  `x-forwarded-for` (`submit/route.ts:31`). Add a per-collection global limit.

- [ ] **SEC-3 · Enforce upload size at the signature** — _P0, M_
  `src/lib/r2.ts:45-58`; callers `upload/presign/route.ts:107`, `c/[token]/presign/route.ts:56`
  `ContentLength` is omitted from the presign, so R2 accepts any size; the 25 MB
  cap is decorative. Use a presigned POST policy with `content-length-range`.

- [ ] **SEC-4 · Bind submitted media keys to the collection prefix (IDOR)** — _P0, S-M_
  `src/app/api/c/[token]/submit/route.ts:71-82`
  `mediaRefs[].key`/`url` are stored verbatim — a submitter can reference another
  space's private R2 object. Reject any key not under `collections/{token}/...`;
  ideally have presign return a signed key→collection token that submit verifies.

- [ ] **SEC-5 · Validate content type server-side** — _P0, M_
  `c/[token]/presign/route.ts:12-18,46-54`; `upload/presign/route.ts:33-42`; `submit/route.ts:73-81`
  Type is client-asserted (public route uses loose `startsWith`); `mimeType`/
  `fileSize` stored unchecked. Validate magic bytes / recompute size from R2
  metadata; use an explicit allowlist on both routes.

- [ ] **SEC-6 · Verify space membership on authenticated upload presign** — _P0, S_
  `src/app/api/upload/presign/route.ts:62-104`
  Route checks auth + subscription but not `getMemberRole(userId, spaceId)`. Any
  subscribed user can write into another space's `spaces/{spaceId}/...` prefix.

- [ ] **SEC-7 · Stripe webhook idempotency** — _P1, M_
  `src/app/api/stripe/webhook/route.ts:47-155`
  Signature verification is correct, but handlers aren't idempotent — retries can
  re-run `incrementReferralDiscount`/`markReferralRewarded`. Dedupe on `event.id`;
  make referral reward conditional on not-already-rewarded.

- [ ] **SEC-8 · Cap pending submissions under moderation** — _P1, S_
  `src/app/api/c/[token]/submit/route.ts:56,85-90`
  `maxResponses` only increments on approval, so with moderation on an attacker
  can insert unlimited pending rows + media (DB/storage exhaustion). Count
  pending toward an abuse cap.

- [ ] **SEC-9 · Suppress repeat free trials** — _P2, M_
  `src/app/api/stripe/checkout/route.ts:34-35`; `src/lib/stripe.ts:81-99`
  A 30-day trial is granted whenever status isn't `trialing`; a cancel→resubscribe
  loop yields repeat trials. Track "trial used" per customer; align usage windows
  to the billing period rather than calendar month.

---

## P1 — Speed

- [ ] **PERF-1 · Paginate / lazy-load the dashboard** — _P1, L_
  `src/app/(app)/dashboard/[spaceId]/page.tsx:56-152`, consumed in `app-shell.tsx:90-112`
  The page fetches all observations/media/signals/sentiment/timeline up-front and
  serializes them into one client component. Paginate River & Timeline (cursor /
  "load more"); lazy-fetch sentiment/constellation/timeline data on tab activation.

- [ ] **PERF-2 · Stop selecting the embedding vector for display** — _P1, S · quick win_
  `src/lib/db/queries.ts:35-41` (`getObservationsForSpace`)
  `select()` returns all columns incl. the 1536-dim `aiEmbedding` (~6KB/row),
  pulled from Neon on every page load and never used by the client. Select only
  display columns.

- [ ] **PERF-3 · Virtualize the River list; clamp the stagger** — _P1, M_
  `src/components/app/river-view.tsx:253-304`
  Renders every observation with no windowing; `animationDelay: i*0.1s` makes the
  100th card wait 10s. Add a virtual list; clamp the stagger to the first ~10.

- [ ] **PERF-4 · Fix clustering query: bind vector once, use the index** — _P1, M_
  `src/lib/ai/tasks/cluster.ts:24-39,116-135`
  The query embeds the target vector as a correlated subquery 3× (prevents HNSW
  index use → seq scan), and `findUnattachedClusters` runs one vector query per
  unattached observation (O(n²), no `LIMIT`). Bind the vector as one parameter;
  `ORDER BY … LIMIT k`; verify with `EXPLAIN`.

- [ ] **PERF-5 · Constellation render hygiene** — _P1, M_
  `src/components/app/constellation-view.tsx:155-430,186`
  RAF loop + listeners are torn down/recreated on every filter change; a new `Map`
  is allocated 60×/sec inside `draw()`. Hoist `nodeById`; separate static setup
  from data-dependent compute; pause when backgrounded.

- [ ] **PERF-6 · Remove member-count N+1** — _P1, S · quick win_
  `src/app/(app)/dashboard/[spaceId]/page.tsx:106-114`
  `getSpaceMemberCount` is called per space in a loop. Fold into one grouped query.

- [ ] **PERF-7 · Parallelize media uploads** — _P2, S_
  `src/components/app/app-shell.tsx:883-919`, `src/app/c/[token]/collection-form.tsx:111-139`
  Uploads run serially in a `for` loop. Use `Promise.all` with bounded concurrency
  and show aggregate progress.

- [ ] **PERF-8 · Move HNSW index into migrations** — _P1, S_
  `src/lib/db/enable-pgvector.ts:19-23`
  Index is created by a manual script, not a migration — risk it's missing in prod.

- [ ] **PERF-9 · Parallelize per-item media AI; cap PDF/image size** — _P2, M_
  `src/lib/ai/pipeline.ts:41-45`, `tasks/describe-media.ts`, `extract-file-text.ts`, `transcribe-voice.ts`
  Multiple images/clips/files in one observation are processed serially, blocking
  embed. PDFs are base64'd whole into the prompt with no size cap. R2 fetches have
  no timeout. Bound concurrency, add size guards + fetch timeouts.

---

## P1 — Quality / correctness

- [ ] **QUAL-1 · Serialize per-space synthesis (no duplicate signals)** — _P1, M_
  `src/lib/ai/pipeline.ts:108-116`, `tasks/synthesise.ts:219-255`
  Concurrent unattached observations both run `synthesiseNewSignals`, scan the
  same set, and create overlapping signals. Wrap cluster+synthesise in a Postgres
  advisory lock (`pg_advisory_xact_lock(hashtext(spaceId))`) or use a queue.

- [ ] **QUAL-2 · Debounce signal evolution & reflection triggers** — _P1, M_
  `src/lib/ai/pipeline.ts:92-99`, `tasks/reflect.ts:52-72`
  `evolveSignal` makes a full Sonnet call on every observation added to a signal;
  `checkReflectionTriggers` fires after every evolve and can spam reflections +
  member notifications. Coalesce with a `dirty` flag and a per-signal
  `last_reflected_at` cooldown (check-and-set atomically).

- [ ] **QUAL-3 · Separate AI lifecycle flags; add re-embed sweeper** — _P1, S-M_
  `src/lib/ai/pipeline.ts:63-71,118,213-218`, `tasks/enrich.ts:91`
  `aiProcessedAt` is written in three places meaning three different things, and
  on embed failure the observation is marked processed and never retried (a
  transient OpenAI outage strands it). Split into `aiEmbeddedAt`/`aiEnrichedAt`/
  `aiProcessedAt`; don't mark processed on embed failure; add a cron to re-embed
  `aiEmbedding IS NULL` rows.

- [ ] **QUAL-4 · Add retries/timeouts/backoff to AI + R2 calls** — _P1, M_
  `tasks/embed.ts`, `enrich.ts`, `synthesise.ts`, `reflect.ts`, `attention.ts`, `transcribe-voice.ts`
  Bare single attempts, no explicit timeout, no 429 handling. Add `abortSignal`
  timeouts + bounded backoff with jitter.

- [ ] **QUAL-5 · Update model pins to current generation** — _P2, S_
  `src/lib/ai/config.ts:6-11`
  Synthesis/reflection/attention are pinned to legacy `claude-sonnet-4-5-20250929`.
  Move to current Sonnet (`claude-sonnet-4-6`); keep Haiku 4.5 for extraction.
  Verify `@ai-sdk/anthropic` supports the IDs.

- [ ] **QUAL-6 · Bound & stabilize greedy clustering** — _P2, M-L_
  `src/lib/ai/tasks/cluster.ts:89-149`, `config.ts:23`
  `findUnattachedClusters` neighbour query has no `LIMIT` and is order-dependent;
  a single seed can pull hundreds in. Add `LIMIT`, deterministic ordering; validate
  the 0.55 similarity threshold against real data.

- [ ] **QUAL-7 · Coalesce reflection-response re-evolution** — _P2, S_
  `src/lib/ai/pipeline.ts:155-161`
  `processReflectionResponse` re-evolves each prompting signal after the full
  pipeline already evolved it — multiplied Sonnet cost. Coalesce.

- [ ] **QUAL-8 · Extract shared observation-filter hook** — _P2, M_
  `river-view.tsx:55-87`, `landscape-view.tsx:45-81`, `timeline-view.tsx:62-98`
  Three near-identical filter/search memo pipelines + an `observationById` Map
  rebuilt in three views. Extract `useObservationFilters` + a shared map.

- [ ] **QUAL-9 · Fix Sentiment compare-mode selection bug** — _P2, S_
  `src/components/app/sentiment-view.tsx:193-200,219-222`
  Selection keyed by numeric index reads stale `selectedGrid` within a click, so
  clicking the same index across grids mis-toggles. Key by `{grid, index}`.

- [ ] **QUAL-10 · Billing route should report the space's subscription** — _P2, M_
  `src/app/api/space/[spaceId]/billing/route.ts:23`
  Returns `getSubscriptionForUser(caller)` not the space owner's subscription —
  misleads usage display when owner ≠ viewer.

- [ ] **QUAL-11 · De-duplicate image OCR** — _P2, S_
  `tasks/describe-media.ts:32`, `extract-file-text.ts:37,98`
  Both run vision text-extraction on the same image. Consolidate to one call.

- [ ] **QUAL-12 · Cap attention cron fan-out** — _P2, S_
  `src/app/api/cron/attention/route.ts:19-21`
  `Promise.allSettled` over all active spaces fires N simultaneous Sonnet calls.
  Add a concurrency cap.

---

## P2 — Usability

- [ ] **UX-1 · Optimistic observation insert** — _P1, M_
  `src/components/app/app-shell.tsx:925-938`, `src/app/(app)/actions.ts:130-132`
  New observations only appear after revalidation; AI fields populate silently
  later with no indication. Optimistically prepend a "processing…" card.

- [ ] **UX-2 · Real onboarding experience** — _P2, M_
  `src/app/(app)/onboarding/page.tsx`
  Synchronously seeds demo data and redirects with no UI; if seeding is slow/fails
  the user is stuck, and deleting all spaces silently re-seeds demo content. Add a
  proper first-run screen; make seeding resilient/idempotent.

- [ ] **UX-3 · Consistent focus trap / Escape on all overlays** — _P2, M_
  `collect-view.tsx:161-303`, `constellation-view.tsx:510-659`, header dropdowns in `app-shell.tsx`
  Only the observation modal uses `useFocusTrap`. Create-Collection modal has no
  Escape and no focus restore. Reuse `useFocusTrap`/`useEscapeKey` everywhere.

- [ ] **UX-4 · Honor `prefers-reduced-motion` fully** — _P2, S_
  `river-view.tsx:262-266`, `sentiment-view.tsx:476`, `landscape-view.tsx:208`
  River stagger and long `duration-1000` transitions ignore the setting.

- [ ] **UX-5 · Loading/disabled state on "Upgrade now"** — _P2, S_
  `src/components/app/app-shell.tsx:397-406`
  Bare `fetch` to the Stripe portal with no try/catch or disabled state —
  double-click spawns duplicate portal sessions.

- [ ] **UX-6 · Remove dead props / tidy AppShell** — _P2, S_
  `src/components/app/app-shell.tsx`
  `userEmail` destructured but unused; the 1163-line shell re-renders the whole
  tree on any menu toggle. Split header/menus out; memoize view wrappers.

---

## Features — new capabilities (rough value order)

- [ ] **FEAT-1 · Weekly digest (email / Slack)** — _Feature, M_
  Surface the attention analysis you already generate in the cron as a "what your
  team is sensing" weekly summary. Reuses existing paid work; drives re-engagement.
  Touches `cron/attention`, `resend`, a new digest job.

- [ ] **FEAT-2 · Ask-the-space (semantic Q&A / RAG)** — _Feature, M_
  "Ask a question" over the observations using the embeddings already stored.
  High wow-factor, low marginal infra (pgvector + one LLM call).

- [ ] **FEAT-3 · Export / reporting** — _Feature, M_
  PDF/CSV export of signals + sentiment for a date range. Facilitators need to
  report upward — a common purchase driver.

- [ ] **FEAT-4 · Collection QR codes + themed pages** — _Feature, S_
  QR on the collection page for events/workshops; widens the response funnel.

- [ ] **FEAT-5 · Real-time River updates** — _Feature, M_
  Lightweight polling or SSE so observations appear for others without a reload —
  makes shared/live sessions feel alive.

- [ ] **FEAT-6 · Scheduled / recurring reflections** — _Feature, M_
  Let admins schedule recurring prompts (daily standup, weekly retro) alongside the
  AI-triggered ones. Builds on the existing `reflections` + cron infrastructure.

---

## Suggested sequencing

1. **PR 1 — Cost-safety:** SEC-1..SEC-6 (+ quick wins PERF-2, PERF-6). Low-risk,
   high-value, exploitable today.
2. **PR 2 — Pipeline correctness:** QUAL-1, QUAL-2, QUAL-3 before traffic grows.
3. **PR 3 — Felt performance:** PERF-1, PERF-3, UX-1.
4. **Then:** remaining P1/P2 and features as capacity allows.

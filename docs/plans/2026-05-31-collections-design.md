# Collections — Design Document

**Date:** 2026-05-31  
**Status:** Approved  
**Feature:** Public shareable submission links (no signup required)

---

## Overview

A space owner creates a Collection — a named question with a shareable link. Anyone with the link can submit an observation (text + optional photo/voice/file) without an account. Submissions flow into the space's normal AI pipeline and appear in all existing views. Owners can open/close collections, set optional deadlines and response caps, and optionally require moderation before submissions become visible.

**Analogy:** Slido for quiet intake — not live/reactive, just low-friction multi-person collection.

---

## Data Model

### New table: `collections`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `spaceId` | uuid | FK → spaces (cascade delete) |
| `title` | text | The question shown to respondents |
| `description` | text nullable | Optional context/instructions |
| `token` | text unique | 12-char URL-safe random string |
| `isOpen` | boolean | Default true |
| `closeAt` | timestamp nullable | Optional auto-close deadline |
| `maxResponses` | integer nullable | Optional response cap |
| `responseCount` | integer | Approved submissions only |
| `moderationEnabled` | boolean | Default false |
| `createdAt` | timestamp | — |

### Schema changes to `observations`

| Column | Change |
|--------|--------|
| `authorId` | Made nullable — anonymous submissions have no user account |
| `collectionId` | New: uuid nullable FK → collections (null for regular observations) |
| `moderationStatus` | New: enum `approved \| pending \| rejected`, default `approved` |

Existing observations are unaffected — `collectionId` is null, `moderationStatus` defaults to `approved`.

---

## Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /c/[token]` | None | Public submission page |
| `POST /api/c/[token]/presign` | None (token validates) | Presigned R2 upload URL for collection media |
| `POST /api/c/[token]/submit` | None (token validates) | Create observation from collection submission |

All three validate the collection token on every request and return 403 if the collection is closed, expired, or capped.

---

## Public Submission Page (`/c/[token]`)

Minimal branded page — no app chrome, no nav, no account prompts.

**Open state:**
- Swells wordmark at top
- Question title in large Cormorant Garamond display type
- Optional description below in smaller text
- Optional name field ("Your name (optional)")
- Textarea for response
- Photo / Voice / File buttons (full multimodal, same as observation modal)
- Submit button

**After submit:** Quiet confirmation — "Thank you. Your observation has been added." — with a "Submit another" link that resets the form.

**Closed / expired / capped:** "This collection is closed." with the question title still visible.

**Not found / invalid token:** Standard 404.

**Design principles:** Mobile-first (often opened from QR code), dark Swells aesthetic, the question is the hero.

---

## Dashboard Integration

### New "Collect" tab in AppShell

Added to the view navigation alongside River, Constellation, Signals, etc.

**Collection list (default view):**
- Cards: title, response count, open/closed badge, created date
- Inline open/close toggle
- "Copy link" button → copies `swells.app/c/[token]` to clipboard
- "New collection" button

**Create/edit collection (modal):**
- Title (required)
- Description (optional)
- Close date (optional)
- Response cap (optional)
- Moderation toggle (default off)
- On save: token generated, shareable link shown immediately

**Collection detail view:**
- Filtered river-style list of submissions for that collection
- When moderation is enabled: pending submissions shown with Approve / Reject actions
- Approve → `moderationStatus: approved`, AI pipeline triggers
- Reject → `moderationStatus: rejected`, hidden from all views

**Permissions:** Only owners and facilitators can create/manage collections. Observers cannot.

---

## Source Filtering Across Views

A **Source** dropdown added to River, Constellation, Signals, Timeline, and Sentiment views:

| Option | Shows |
|--------|-------|
| All observations (default) | Everything with `moderationStatus: approved` |
| Exclude collections | Regular observations only (`collectionId IS NULL`) |
| Collections only | All collection submissions together |
| [Collection name] | Observations from one specific collection |

Filter persists per-view in local React state (not URL — keeps URLs clean).

`pending` and `rejected` observations are excluded from all views unconditionally.

---

## Moderation

Configured per collection. Default: off.

**Off (default):** Submission lands as `moderationStatus: approved`, pipeline runs immediately via `after()`.

**On:** Submission lands as `moderationStatus: pending`, pipeline does not run. Owner reviews in the collection detail view. On approve → status flips to `approved`, pipeline triggers. On reject → status stays `rejected`. Response count only increments for approved submissions.

---

## Security

**Rate limiting:** 10 submissions per IP per hour per collection on the submit and presign endpoints. Prevents spam at events without blocking genuine multi-device responses.

**Token design:** 12-char URL-safe random string. Not guessable, not sequential. Never reused after deletion.

**Media storage:** Collection media goes to R2 under `collections/[token]/[uuid]/[filename]` — separate prefix from `spaces/` for easy identification and cleanup.

**Auto-close:** Checked on submit — if `closeAt` is past or `responseCount >= maxResponses`, return 403. No background job needed.

---

## Out of Scope (Not Building Now)

- Email notifications to owner on new submissions
- QR code generation (copy-link is sufficient; QR can be generated externally)
- Public results page showing aggregate themes to respondents
- Nested/threaded responses

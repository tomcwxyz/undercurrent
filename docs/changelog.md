# Changelog

All notable changes to Swells will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).


## [2026-08-27]

### Added

- **Swells API v1** — scoped, per-user API keys for integrations and agents.
- **API access** in the account menu for creating, copying and revoking keys.
- Versioned endpoints for listing spaces, reading and creating observations,
  and reading signals.
- API keys are stored as SHA-256 hashes, can expire, are shown only once at
  creation, and continue to respect normal space roles and observation limits.
- Published API reference at `docs.swells.app`.

---

## [2026-06-01]

### Added

- **Pricing** — Individual £10/mo, Team £30/mo, Organisation £50/mo, each with a
  30-day free trial and no card required. Plans differ by team size and monthly
  observation volume, not features.
- **Fill a new space with sample data** — when creating a space you can opt in to
  populate it with example observations, signals, collections and reflections, so
  you can explore every view immediately. The sample content is marked as demo
  and can be cleared at any time.
- **Collections** — gather observations from anyone through a shareable link, no
  account required. Respondents can submit text, a photo, a voice recording or
  audio file, and an optional name. Each collection has its own question and can
  have a close date and a response cap.
- **Collect tab** — create and manage collections, copy their links, open or
  close them to submissions, see response counts, and review or delete them.
- **Moderation for collections** — optionally review submissions before they
  appear, with an approve/reject queue inside each collection.
- **Reflections now shape your signals** — a reflection you write is treated as
  a considered observation. It feeds back in to strengthen the signal that
  prompted it, and can even help surface a new one.
- **Source filter** across River, Signals, Constellation, and Timeline — focus
  on observations added directly, gathered through a collection (all or a
  specific one), or written as reflections.
- **Constellation map controls** — drag anywhere to pan the map, and selecting a
  signal now gently brings it into view so the detail panel never hides it.
- **Numbered observations in the Constellation** — the dots orbiting a signal
  are numbered to match the entries in the side panel; hover an entry to
  highlight its dot.

### Changed

- **Your monthly observation allowance is now per account**, shared across all
  your spaces, rather than counted separately for each space.
- **The Signals landscape now reflects real data** — the terrain shows your most
  common themes rising and falling over the last 30 days, instead of an
  illustrative graphic.
- **Reflection responses stay visible** — after you respond to a prompt, your
  response now remains with that prompt, and past prompts show their responses
  in full.
- **Source filter styling** now matches the rest of the app and is easy to read.

### Fixed

- Reflection responses no longer vanish the moment you submit them.
- The source filter dropdown is no longer hard to read against the dark theme.

### Removed

- **Sample/placeholder visuals** in the Sentiment and Signals views when a space
  has no data yet. Both now show a clear, honest empty state instead of
  fabricated charts, so you can always trust that what you see is real.

---

_This is the first published changelog. Earlier history is captured in the
project's commit log._

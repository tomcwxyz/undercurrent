# Swells roadmap

Swells helps people and organisations sense what is emerging before it becomes obvious. The product should keep the canonical sensing model independent from any one interface, then project that meaning appropriately onto web, small devices, tablets, ambient displays and agent surfaces.

## Now

### Surface-aware Swells

**Goal:** make Swells usable on devices that are not conventional desktop dashboards without fragmenting the data model.

Principles:

- Canonical Swells state remains observations, signals, reflections, sentiment and their evidence.
- A surface is a projection of that state, never a second source of truth.
- Device render state is ephemeral.
- Small surfaces show one primary thing at a time.
- Warm/cool temperature represents emotional energy and tone, not quality, importance or success.
- Provenance must survive projection even when a constrained surface cannot display it directly.
- Interactions that create durable Swells state must flow through the existing permissions, subscription and processing pipeline.

#### Rabbit R1 first slice

Build a dedicated Swells R1 experience rather than shrinking the web UI.

Core interaction family:

1. **Notice** — capture an observation with as little framing as possible.
2. **Temperature** — ambient, glanceable view of the existing “temperature of things”.
3. **Horizon** — move through a small set of active swells/signals.
4. **Swell** — inspect one signal, its direction and evidence count.
5. **Change** — surface a signal that is new or strengthening.
6. **Ask** — bounded conversation with a signal and its evidence.

Current implementation target:

- [x] Define a reusable surface profile and projection model.
- [x] Add an authenticated 480×640 R1 web surface backed by live Swells data.
- [x] Make Temperature a first-class R1 lens.
- [x] Add one-at-a-time Horizon and Swell views.
- [x] Add a lightweight Notice capture path through the canonical observation pipeline.
- [x] Add a first Change view from existing signal direction.
- [x] Add bounded Ask against a selected signal and its evidence.
- [x] Add the native Rabbit shell using the proven Attention native audio/TTS/haptics pattern.
- [x] Add resumable capture review where AI processing needs user judgement.
- [x] Add first explicit surface feedback store for Ask usefulness and signal-interpretation fit.
- [x] Add a first admin evaluation view for explicit R1 feedback.
- [x] Expand interaction telemetry for surface tuning without silently changing canonical meaning.

### Native Rabbit shell

Reuse lessons from Attention Agent rather than rediscovering Rabbit/WebView constraints:

- Native microphone recording; do not depend on WebView audio capture.
- Coordinate TTS lifecycle with microphone capture.
- Wheel/DPAD maps to one-item-at-a-time navigation.
- Haptic acknowledgement for capture and navigation.
- Immersive 480×640 presentation.
- Self-update channel with signed build metadata. **Implemented for alpha via a public GitHub prerelease, SHA-256 verification and Android package-signature enforcement.**
- Authentication returns to the Swells R1 surface rather than the standard web shell.

The native bridge should be general enough to become a Good Ship device-shell pattern rather than permanently duplicating Attention-specific code.

## Next

### Ask a swell — next depth

The first bounded Ask interaction is implemented on R1:

- exact selected signal;
- approved linked observations only;
- earliest + latest evidence retained in a bounded context;
- short Haiku-tier responses;
- explicit evidence references and confidence;
- voice question and native spoken answer;
- no conversational memory and no signal mutation.

Next depth:

- “What other swells connect to it?” using explicit signal connections rather than broad retrieval;
- open the cited observations on a richer surface;
- evaluate answer usefulness and evidence quality as part of the tuning store.

### Human judgement and tuning

The first durable feedback loop is implemented on R1: Ask answers can be marked **Useful / Missed it**, and an individual swell can be marked **Fits / Something’s off**. These judgements are stored with the user, space, signal and (for Ask) the question, answer and cited evidence IDs.

R1 Notice capture now also has a durable review step. A capture remains resumable while the AI pipeline is working, then shows the connection Swells made. The user can **Keep here** or **Keep separate**; keeping it separate removes the proposed signal attachment and reconciles the affected signal rather than merely recording negative feedback. Bounded R1 interaction events (surface open, lens view, navigation, capture and review) are stored separately from canonical sensing state and surfaced in the admin evaluation view.

Continue to record explicit feedback such as:

- belongs / does not belong;
- important / weak;
- this is two different things;
- I have changed my mind;
- the model's interpretation is useful / not useful.

Keep model proposals, evidence, user decisions and resulting state changes inspectable so Swells can be evaluated and tuned.

### Tablet projection

Use the same semantic surface model with more exploration depth:

- living horizon;
- connected swells;
- visual history;
- evidence browsing;
- bounded Ask;
- richer Temperature over time.

### E-paper projection

A deliberately ambient surface:

- current temperature;
- strongest or fastest-moving swell;
- one concise “what is forming” statement;
- low-frequency refresh;
- no requirement for direct interaction.

## Later

- Cross-product hand-off between Attention and Swells without duplicating canonical state.
- Surface-aware deep links from Attention’s Consider scenes into the matching Swells lens.
- Shared device-shell primitives across Good Ship products.
- Evaluation tooling that compares model interpretation, surface projection and human feedback over time.

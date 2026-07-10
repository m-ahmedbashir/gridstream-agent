# Model Flexibility & Privacy — Master Task Index

**Project Goal:** Stop hard-wiring the extraction pipeline to Groq. Let a user pick their provider/model, bring their own key, and — the part that actually closes a real gap — process images locally so PII masking can reach them too.

**Why this exists:** `task/` (the older folder in this repo) tracked the HITL + database work, which is done. This folder tracks the *next* initiative, kept separate so the two don't get mixed up.

**Overall Status:** IN PROGRESS — Phase 1 complete
**Last Updated:** 2026-07-10

---

## The gap this plan actually starts from

Right now, PII masking only works on text. A regex pipeline strips emails/phones/IBANs/card numbers out of any text before it reaches the model — but images and rasterized PDF pages go through **unmasked**, because you can't regex a JPEG. The current mitigation is a warning flag (`imagePiiDetected`) that tells a reviewer "this might have sensitive info in it," not a fix. **Phase 4 below is the actual fix** — everything before it is groundwork that also happens to be independently valuable.

---

## Phase Breakdown

| Phase | Focus | Status | Files |
|-------|-------|--------|-------|
| **Phase 1** | Provider-agnostic model registry | ✅ COMPLETE | `roadmap/phase1.md` |
| **Phase 2** | Model picker (Settings UI) | ⏳ PENDING | `roadmap/phase2.md` |
| **Phase 3** | BYOK (bring your own key) | ⏳ PENDING | `roadmap/phase3.md` |
| **Phase 4** | Local OCR — closes the image-PII gap | ⏳ PENDING | `roadmap/phase4.md` |
| **Phase 5** | `generateObject`/`streamObject` migration | ⏳ PENDING | `roadmap/phase5.md` |
| **Phase 6** | Local models (Ollama) — blocked, see notes | 🔒 BLOCKED | `roadmap/phase6.md` |

Phases 1→4 are meant to be built **in that order** — each one depends on the one before it. Phase 5 is independent and can happen anytime. Phase 6 is intentionally last and not yet scheduled.

---

## How each phase earns its place on a CV

This isn't feature work for its own sake — each phase was picked because it maps to something concrete you can say in an interview, not just a bullet point:

- **Phase 1 (registry):** "I designed a provider-agnostic abstraction so the pipeline isn't locked to one vendor" — the same architectural instinct behind BYOK products like stagewise's own.
- **Phase 2 (picker):** a full vertical slice — schema change, API, UI — using an established pattern (`extractionMode`) instead of inventing a new one from scratch.
- **Phase 3 (BYOK):** real security engineering. "I encrypted user-supplied API keys at rest with AES-GCM" is a sentence that survives a technical follow-up question, unlike a feature that just *stores a string*.
- **Phase 4 (local OCR):** the strongest story of the five — "I found a real gap in my own PII handling, and here's the architecture I built to close it" is exactly the kind of self-directed, gap-finding habit worth demonstrating, not just claiming.
- **Phase 5 (`generateObject`):** shows the SDK is being used *correctly*, not just functionally — validating structured output via the SDK's own schema mechanism instead of hand-rolled `JSON.parse`.

---

## Notes

- Each phase file follows the same format as the old `task/phase*.md` files: Status, Overview, Tasks Checklist, Summary, Notes, and a "Why this matters" section.
- Update the status table above as phases complete — same convention as `task/README.md`.
- One phase, one commit, where reasonably possible.

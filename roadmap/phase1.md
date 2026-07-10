# Phase 1: Provider-Agnostic Model Registry

**Status:** ⏳ PENDING
**Depends on:** nothing — this is the foundation phases 2–4 build on

---

## Overview

`extraction.service.ts` currently calls `createGroq()` directly and hard-codes `'meta-llama/llama-4-scout-17b-16e-instruct'`. This phase pulls that out into a small registry so any provider — Groq, OpenAI, Anthropic, or (eventually) a local model — can be plugged in through config instead of a code change.

The one thing that makes this more than a find-and-replace: **not every model supports vision.** Plenty of text-only models exist. The registry has to track that per model, or someone picks a text-only model and scanned invoices silently break with no explanation.

---

## Tasks Checklist

### ⏳ REMAINING

- [ ] Define a `ModelDescriptor` type: `{ provider, modelId, supportsVision: boolean }`
- [ ] Build a small registry (a plain config object is enough — no need for a database table yet) listing at least Groq's Llama 4 Scout (vision) and one text-only option, to prove the capability flag actually gets checked somewhere
- [ ] Add `@ai-sdk/openai` and `@ai-sdk/anthropic` as dependencies (already checked: compatible with the current `ai@6` / `@ai-sdk/groq@3` generation — no SDK version bump needed for this phase)
- [ ] Refactor `ExtractionService` to resolve its model from the registry instead of constructing `createGroq()` inline
- [ ] If a request would send an image to a model with `supportsVision: false`, fail with a clear error — not a silent wrong answer
- [ ] Update `extraction.service.spec.ts` to cover: registry resolution, and the vision-capability guard rejecting an image sent to a text-only model
- [ ] `pnpm run typecheck` and `pnpm test` green

---

## Summary

**Phase 1: Not started.**

### What "done" looks like:
- No `createGroq()` call left directly in `ExtractionService` — it goes through the registry
- Swapping the default model is a one-line config change, not a code change
- A test exists proving a text-only model + an image request fails loudly, not silently

### Next Phase:
→ **Phase 2: Model Picker (Settings UI)** (see `roadmap/phase2.md`) — needs this registry to exist first.

---

## Why this matters (for the CV / interviews)

The honest answer to "why build this" isn't "more options are nice" — it's that a extraction pipeline hard-wired to one vendor is a demo, not a product. This is the same instinct behind why serious AI infra (including BYOK products) treat the model as swappable infrastructure, not a fixed dependency. Say exactly that if asked.

## Notes

**Files this will touch:**
- `apps/backend/src/modules/extraction/extraction.service.ts`
- `apps/backend/src/modules/extraction/extraction.service.spec.ts`
- `apps/backend/package.json` (new provider dependencies)
- Likely a new `apps/backend/src/modules/extraction/model-registry.ts`

**Blockers/Issues:**
- None yet.

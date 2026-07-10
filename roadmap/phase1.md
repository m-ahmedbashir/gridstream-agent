# Phase 1: Provider-Agnostic Model Registry

**Status:** ✅ COMPLETE
**Completed:** 2026-07-10
**Depends on:** nothing — this is the foundation phases 2–4 build on

---

## Overview

`extraction.service.ts` currently calls `createGroq()` directly and hard-codes `'meta-llama/llama-4-scout-17b-16e-instruct'`. This phase pulls that out into a small registry so any provider — Groq, OpenAI, Anthropic, or (eventually) a local model — can be plugged in through config instead of a code change.

The one thing that makes this more than a find-and-replace: **not every model supports vision.** Plenty of text-only models exist. The registry has to track that per model, or someone picks a text-only model and scanned invoices silently break with no explanation.

---

## Tasks Checklist

### ✅ COMPLETED

- [x] Defined a `ModelDescriptor` type: `{ provider, modelId, supportsVision }` in `model-registry.ts`
- [x] Built the registry: `groq:llama-4-scout` (vision, default), `groq:llama-3.3-70b` (text-only), `openai:gpt-4o` (vision), `anthropic:claude-3-5-sonnet` (vision) — a text-only entry exists specifically so the capability guard has something real to reject
- [x] Added `@ai-sdk/openai` and `@ai-sdk/anthropic` — **correction to the plan above:** the initially-installed `^4.0.11` versions turned out to implement `LanguageModelV4`, incompatible with `ai@6`'s `LanguageModel` type (V2/V3) and with `@ai-sdk/groq@3.x`. `tsc` caught this immediately. Repinned to `@ai-sdk/openai@3.0.84` / `@ai-sdk/anthropic@3.0.96`, which match the same generation as `@ai-sdk/groq@3.0.35`. Lesson: package major-version numbers across `@ai-sdk/*` providers don't track each other — verify the actual type surface, don't assume from the version number.
- [x] Refactored `ExtractionService`: no `createGroq()` call left in the class; model resolves via `resolveModel(this.modelKey)`. `modelKey` is a constructor parameter (default `DEFAULT_MODEL_KEY`), marked `@Optional()` so NestJS's DI doesn't try to resolve a provider for a plain string-literal type — verified by actually booting the app (`pnpm run start`) and confirming `ExtractionModule dependencies initialized` with no resolution error, not just by reading the code.
- [x] Vision-capability guard added: an image/rasterized-PDF request against a `supportsVision: false` model now throws a clear `422` before ever calling the model.
- [x] `extraction.service.spec.ts` updated: 5 new tests — default-model resolution, a different `modelKey` resolving a different model, an OpenAI model resolving through the same code path, the vision guard rejecting an image on a text-only model, and confirming a text-only model still works fine for text requests.
- [x] `pnpm test` — 32/32 green. `pnpm run typecheck` — clean on both apps.
- [x] Real end-to-end smoke test: hit the running server with a live request. It reached Groq with a correctly-formed payload and failed only on `expired_api_key` — an environment credential issue, unrelated to this refactor, and itself confirmation the registry resolution works for real, not just against mocks.

---

## Summary

**Phase 1: Complete.**

### What "done" looks like:
- No `createGroq()` call left directly in `ExtractionService` — it goes through the registry ✅
- Swapping the default model is a one-line config change (`DEFAULT_MODEL_KEY`), not a code change ✅
- A test exists proving a text-only model + an image request fails loudly, not silently ✅

### Next Phase:
→ **Phase 2: Model Picker (Settings UI)** (see `roadmap/phase2.md`) — the registry now exists for it to build on.

---

## Why this matters (for the CV / interviews)

The honest answer to "why build this" isn't "more options are nice" — it's that a extraction pipeline hard-wired to one vendor is a demo, not a product. This is the same instinct behind why serious AI infra (including BYOK products) treat the model as swappable infrastructure, not a fixed dependency. Say exactly that if asked.

## Notes

**Files touched:**
- `apps/backend/src/modules/extraction/model-registry.ts` (new)
- `apps/backend/src/modules/extraction/extraction.service.ts`
- `apps/backend/src/modules/extraction/extraction.service.spec.ts`
- `apps/backend/package.json` / `pnpm-lock.yaml` (new provider dependencies, correctly pinned)

**Blockers/Issues:**
- None remaining. `GROQ_API_KEY` in `.env` is expired — rotate it before relying on a live extraction call for a demo, but this doesn't block any code here.

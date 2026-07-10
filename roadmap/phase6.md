# Phase 6: Local Model Support (Ollama)

**Status:** 🔒 BLOCKED — not scheduled
**Depends on:** Phase 1 (registry), and a decision on the item below

---

## Overview

This is deliberately the last phase and is **not currently scheduled** — it's documented here so the reason it's blocked doesn't get lost or re-discovered from scratch later.

The obvious path to local-model support is the community `ollama-ai-provider-v2` package. It requires **AI SDK v7**; this repo is currently on **v6**. That migration is not a version-number bump — confirmed breaking changes include:

- The multimodal `{ type: 'image', ... }` message format used throughout `extraction.service.ts` (including the Phase 4 OCR/vision path) is deprecated in favor of `{ type: 'file', ... }`.
- `needsApproval`-adjacent tool mechanics are reworked — this is uncomfortably close to the `deleteInvoice` HITL approval flow, which is the single most important piece of this project's story. That flow needs to be manually re-verified after any such migration, not just typechecked.
- `stepCountIs`, `system` (→ `instructions`), and `result.toUIMessageStreamResponse()` all change in the chat route.

## The decision this phase is actually blocked on

Do this migration **deliberately, on its own**, using `npx @ai-sdk/codemod v7` as a starting point — then manually re-verify the extraction pipeline and the delete-invoice approval flow end-to-end (not just `pnpm test` passing) — rather than as a side effect of chasing local-model support. That re-verification step is the reason this isn't a quick win.

## When to actually pick this up

When local-model support becomes a real, prioritized need — not before. Doing this migration "just in case" trades a real risk (breaking the HITL flow) for a speculative benefit.

---

## Why this matters (for the CV / interviews)

The interesting thing to say about this phase isn't the feature — it's the discipline of *not* doing it yet. "I checked, found the exact breaking changes, and made a deliberate call to defer it rather than bundle a risky SDK migration into an unrelated feature" is a stronger signal of judgment than shipping the migration would be on its own.

## Notes

**Blockers/Issues:**
- Blocked on: local-model support becoming an actual priority, not a nice-to-have.
- When unblocked: run the codemod, then manually re-test the extraction pipeline and the `deleteInvoice` approval flow before trusting it.

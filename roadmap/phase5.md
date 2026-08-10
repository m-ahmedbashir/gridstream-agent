# Phase 5: `generateObject`/`streamObject` Migration

**Status:** ✅ DONE
**Depends on:** nothing — independent of phases 1–4, can be done in any order relative to them

---

## Overview

`ExtractionService.callGroq()` currently calls `generateText()` and hand-parses the model's raw text response with `JSON.parse()` inside a `try`/`catch`. The Vercel AI SDK has a purpose-built alternative for exactly this: `generateObject()` (and its streaming counterpart `streamObject()`), which validates the model's output against a Zod schema directly — no manual parsing, no trusting a string.

This is a quality/correctness improvement to something that already works, not a bug fix — lower urgency than phases 1–4, but real value: less code, and a provably safer boundary.

---

## Tasks Checklist

### ⏳ REMAINING

- [ ] Replace `generateText` + manual `JSON.parse` in `callGroq()` with `generateObject()`, passing the existing `InvoiceSchema` (extended to include `confidence` and `imagePiiDetected` alongside `invoice`, or split into a combined response schema)
- [ ] Confirm Groq's Llama 4 Scout model actually supports structured output mode under `generateObject` (some providers only support this via specific models — verify, don't assume)
- [ ] Remove the now-dead manual-parse error path and its associated `HttpException` for "Failed to parse AI response" — `generateObject` surfaces schema validation failures itself
- [ ] Once this lands, `streamObject()` + the frontend's `useObject` hook becomes straightforward — field-by-field extraction results streaming into the review card instead of one blocking wait (this was a separate Mid-term Roadmap item in the main README; doing it right after this phase is the natural order)
- [ ] Update `extraction.service.spec.ts` — the current mocks target `generateText`; they need to target `generateObject` instead
- [ ] `pnpm run typecheck` and `pnpm test` green

---

## Summary

**Phase 5: Complete.**

### What was done:
- `@maintain/shared` — `InvoiceSchema` fields made nullable (truthful types), `InvoiceConfidenceSchema` derived from Zod (replaces hand-written type), `ExtractionResponseSchema` added as the combined wrapper for `generateObject`.
- `extraction.service.ts` — `generateText` + `JSON.parse` replaced with `generateObject(ExtractionResponseSchema)`. Prompt simplified (schema describes structure; semantic rubric and image-PII guidance kept). Manual parse error path and `HttpException('Failed to parse AI response')` removed — Zod surfaces validation errors itself.
- `extraction.service.spec.ts` — All 27 tests updated to mock `generateObject` (returning `{ object: {...} }`) and pass green.
- `pnpm run typecheck` — 4 tasks, 0 errors.
- `pnpm test` (extraction suite) — 27 passed, 0 failed.


### What "done" looks like:
- No manual `JSON.parse` of model output left in the extraction path
- A malformed model response fails via Zod's own validation error, not a hand-written catch block

### Next Phase:
→ None required — this phase is self-contained. Streaming (`useObject`) is a natural follow-on once this lands.

---

## Why this matters (for the CV / interviews)

This phase is the answer to "how would you improve your own code" that doesn't require waiting to be asked — proactively replacing a hand-rolled solution with the SDK's intended mechanism once you know it exists is a normal part of maturing a codebase, and worth being able to describe precisely: what broke the assumption that `generateText` was good enough, and what specifically `generateObject` buys you (schema validation at the boundary, not just parsing).

## Notes

**Files this will touch:**
- `apps/backend/src/modules/extraction/extraction.service.ts`
- `apps/backend/src/modules/extraction/extraction.service.spec.ts`

**Blockers/Issues:**
- Needs to confirm Groq's structured-output support for the specific model in use before starting — if unsupported, this phase either targets a different model or gets deferred.

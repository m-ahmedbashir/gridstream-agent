# Phase 2: Model Picker (Settings UI)

**Status:** ✅ COMPLETE
**Completed:** 2026-07-10
**Depends on:** Phase 1 (the registry has to exist before there's anything to pick from)

---

## Overview

Once Phase 1 exists, exposing it to the user is the cheap part. This mirrors the existing `extractionMode` setting (`MANUAL_REVIEW` / `AUTO_APPROVE`) exactly — same shape of feature, same places it touches.

---

## Tasks Checklist

### ✅ COMPLETED

- [x] Added a single `modelKey String @default("groq:llama-4-scout")` column to `User` — **deviation from the plan above**: the plan said `modelProvider` / `modelId` as two columns, but Phase 1's registry already encodes provider+model as one string key (`"groq:llama-4-scout"`), so one column matches how the registry actually works and how `extractionMode` is already stored (one string field, not split apart).
- [x] Migration: `pnpm prisma migrate dev --name add_model_preference` — applied to the live Neon database.
- [x] `UsersService.getSettings()` / `updateSettings()` extended: reads/writes `modelKey` alongside `extractionMode`. `updateSettings()` now takes a partial `{ extractionMode?, modelKey? }` object instead of a single required field, so changing one setting never silently resets the other. An unrecognised `modelKey` is rejected with a `400`, not silently stored.
- [x] `ExtractionService.processFile()` gained a third parameter — a per-request `modelKey` override — instead of only ever using the constructor-level default from Phase 1. An unrecognised override falls back to the instance default rather than throwing (handles a stale saved preference for a model that's since been removed from the registry).
- [x] `ExtractionController` now injects `UsersService` (required adding `UsersModule` to `ExtractionModule`'s imports, and adding `exports: [UsersService]` to `UsersModule`, which it didn't have before) and looks up the calling user's `modelKey` before calling `processFile()`. The frontend now sends `userId` on every upload (previously it sent none at all).
- [x] **Added an endpoint not in the original plan**: `GET /extraction/models`, returning the registry as a flat list — so the frontend's model picker reads from a single source of truth instead of hand-duplicating the registry as a hardcoded list.
- [x] Frontend: added the model picker to the **Settings page** (`settings-form.tsx`), not `upload-view.tsx` as the plan originally suggested — a model preference is an account-level default, and the existing Settings page (which already owns `extractionMode` via `useSettings()`) is the more coherent single home for it. `upload-view.tsx`'s inline extraction-mode dropdown still exists and was only touched to match the hook's new signature.
- [x] New `useModelOptions()` hook fetches `GET /extraction/models`.
- [x] Tests: `users.service.spec.ts` (new file — none existed before this phase) covers defaults, partial updates, and rejecting an invalid `modelKey`. `extraction.service.spec.ts` gained coverage for the per-request override, the fallback-on-unrecognised-key behavior, and the vision guard applying to an override just as it does to the instance default.
- [x] `pnpm test` — 41/41 green (9 new since Phase 1). Both `tsc --noEmit` checks clean.
- [x] **Real end-to-end verification, not just mocks**: booted the server and exercised the actual chain against the live database — set a real user's `modelKey` to the text-only model via `PUT /users/settings`, then uploaded a genuine PNG as that user, and confirmed the `422` vision-guard rejection named the exact model (`llama-3.3-70b-versatile`) that was actually read back from the database. That's proof the preference travels all the way from a `PUT` request through to the extraction pipeline's enforcement, not just that the code compiles.

---

## Summary

**Phase 2: Complete.**

### What "done" looks like:
- A user can change their model in Settings and the next extraction actually uses it ✅ (verified live, not assumed)
- Existing users are unaffected until they explicitly change the setting ✅ (default `modelKey` matches Phase 1's `DEFAULT_MODEL_KEY` exactly)

### Next Phase:
→ **Phase 3: BYOK** (see `roadmap/phase3.md`)

---

## Why this matters (for the CV / interviews)

This one's less about the feature and more about the execution: a full vertical slice (schema → API → UI) delivered by extending an established pattern instead of inventing a parallel one. That's a real signal of judgment — recognizing "this is the same shape as something that already exists" instead of building a second, slightly different settings system next to the first. It's also worth being able to explain the two deviations from the original plan above precisely (one column instead of two, Settings page instead of the upload page) — both were judgment calls made *while building*, not just following the plan literally, and being able to say why is more convincing than the decision itself.

## Notes

**Files touched:**
- `apps/backend/prisma/schema.prisma` + new migration (`add_model_preference`)
- `apps/backend/src/modules/users/users.service.ts`, `users.controller.ts`, `users.module.ts`, `users.service.spec.ts` (new)
- `apps/backend/src/modules/extraction/extraction.service.ts`, `extraction.controller.ts`, `extraction.module.ts`, `dto/upload-invoice.dto.ts`, `extraction.service.spec.ts`
- `apps/frontend/src/features/extraction-settings/hooks/useSettings.ts`, `hooks/useModelOptions.ts` (new), `components/settings-form.tsx`
- `apps/frontend/src/features/invoice-upload/use-extract-invoice.ts` (now sends `userId`)
- `apps/frontend/src/app/dashboard/upload/upload-view.tsx` (call-site signature update only)

**Blockers/Issues:**
- None. `phase2-test-user` is a throwaway test row left in the dev database from live verification — harmless, no cleanup required.

# Phase 2: Model Picker (Settings UI)

**Status:** ⏳ PENDING
**Depends on:** Phase 1 (the registry has to exist before there's anything to pick from)

---

## Overview

Once Phase 1 exists, exposing it to the user is the cheap part. This mirrors the existing `extractionMode` setting (`MANUAL_REVIEW` / `AUTO_APPROVE`) exactly — same shape of feature, same places it touches.

---

## Tasks Checklist

### ⏳ REMAINING

- [ ] Add `modelProvider` / `modelId` columns to the `User` Prisma model (default to today's Groq/Llama 4 Scout, so existing users see no behavior change)
- [ ] Migration: `pnpm prisma migrate dev --name add_model_preference`
- [ ] Extend `UsersService.getSettings()` / `updateSettings()` to read/write the new fields, same pattern as `extractionMode`
- [ ] `ExtractionService` reads the calling user's model preference (falling back to the registry default if unset) instead of always using the hard-coded default
- [ ] Frontend: extend the existing Settings dropdown pattern (`upload-view.tsx` already has one for `extractionMode`) with a provider/model selector
- [ ] Tests: settings read/write, and that `ExtractionService` actually honors a non-default preference

---

## Summary

**Phase 2: Not started.**

### What "done" looks like:
- A user can change their model in Settings and the next extraction actually uses it
- Existing users are unaffected until they explicitly change the setting

### Next Phase:
→ **Phase 3: BYOK** (see `roadmap/phase3.md`)

---

## Why this matters (for the CV / interviews)

This one's less about the feature and more about the execution: a full vertical slice (schema → API → UI) delivered by extending an established pattern instead of inventing a parallel one. That's a real signal of judgment — recognizing "this is the same shape as something that already exists" instead of building a second, slightly different settings system next to the first.

## Notes

**Files this will touch:**
- `apps/backend/prisma/schema.prisma` + new migration
- `apps/backend/src/modules/users/users.service.ts`
- `apps/backend/src/modules/extraction/extraction.service.ts`
- `apps/frontend/src/features/extraction-settings/`
- `apps/frontend/src/app/dashboard/upload/upload-view.tsx`

**Blockers/Issues:**
- Blocked on Phase 1 landing first.

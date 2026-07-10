# Phase 3: BYOK (Bring Your Own Key)

**Status:** ⏳ PENDING
**Depends on:** Phase 1 (registry) and Phase 2 (settings pattern to extend)

---

## Overview

A user supplies their own provider API key instead of using the app's shared one. This is the phase with a **non-negotiable requirement**: keys get encrypted at rest. A BYOK feature that stores keys in plaintext is worse than not having the feature at all — don't ship this half-done.

---

## Tasks Checklist

### ⏳ REMAINING

- [ ] Decide the encryption approach: AES-GCM with a server-side secret (e.g. from an env var, not committed) is the baseline — research whether Postgres-level encryption (pgcrypto) or app-level encryption is the better fit before writing code
- [ ] Add an encrypted `apiKey` column (plus provider) to the `User` model — never store it as a plain string
- [ ] Migration: `pnpm prisma migrate dev --name add_byok_key`
- [ ] Encrypt on write, decrypt only at the point of use (inside `ExtractionService`, right before the provider call) — never log the decrypted value
- [ ] Settings UI: a field to paste/rotate a key, masked after saving (never redisplay the plaintext)
- [ ] `ExtractionService` uses the user's key when present, falls back to the app's shared key otherwise
- [ ] Tests: encryption round-trips correctly, a key is never present in a log line or an API response, fallback to the shared key works when no user key is set

---

## Summary

**Phase 3: Not started.**

### What "done" looks like:
- A user's API key is never stored or logged in plaintext, anywhere
- Extraction works whether or not a user has supplied their own key

### Next Phase:
→ **Phase 4: Local OCR** (see `roadmap/phase4.md`) — this is the one that actually closes the image-PII gap.

---

## Why this matters (for the CV / interviews)

This is the phase to lead with if asked about security work specifically. "I added a settings toggle" is not a story. "I encrypted user-supplied API keys at rest and made sure the plaintext never touches a log line" is a story that survives a follow-up question about *how* — which is the actual test in an interview.

## Notes

**Files this will touch:**
- `apps/backend/prisma/schema.prisma` + new migration
- A new encryption utility (likely `apps/backend/src/common/crypto/`)
- `apps/backend/src/modules/users/users.service.ts`
- `apps/backend/src/modules/extraction/extraction.service.ts`
- `apps/frontend/src/features/extraction-settings/`

**Blockers/Issues:**
- Don't start this phase without deciding the encryption approach first — it's the one detail that can't be patched in later without a data migration.

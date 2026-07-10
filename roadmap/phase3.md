# Phase 3: BYOK (Bring Your Own Key)

**Status:** ✅ COMPLETE
**Completed:** 2026-07-10
**Depends on:** Phase 1 (registry) and Phase 2 (settings pattern to extend)

---

## Overview

A user supplies their own provider API key instead of using the app's shared one. This is the phase with a **non-negotiable requirement**: keys get encrypted at rest. A BYOK feature that stores keys in plaintext is worse than not having the feature at all — don't ship this half-done.

---

## Tasks Checklist

### ✅ COMPLETED

- [x] **Encryption approach decided**: AES-256-GCM via Node's built-in `crypto` module, not Postgres pgcrypto. Reasoning: GCM is authenticated encryption (confidentiality + tamper detection in one primitive — a modified ciphertext fails to decrypt rather than silently returning garbage), it's NIST/FIPS-approved, and it's what AWS KMS/Stripe/most BYOK products use under the hood. Keeping it app-level (not a Postgres extension) means the crypto logic is unit-testable in complete isolation, with no live DB needed. **Honest limitation, noted rather than hidden**: a true enterprise setup would layer in envelope encryption via a KMS (AWS KMS / Vault) so the master key never lives in a bare env var — that's real infrastructure this project doesn't have, and would be over-engineering at this scale. A securely-generated, rotatable env var is a legitimate choice for a project this size, just not the ceiling.
- [x] Added `encryptedApiKey String?` to `User` (nullable — absence means "use the app's shared key"). Migration: `add_byok_key`, applied to the live database.
- [x] Encryption logic split into two layers on purpose:
  - `common/crypto/byok-encryption.ts` — pure functions (`encryptSecret`/`decryptSecret`), the key always passed in explicitly. No NestJS, no env-var reading, no DI — fully unit-testable with a fixed test key.
  - `common/crypto/encryption.service.ts` — the thin `@Injectable()` wrapper that reads `BYOK_ENCRYPTION_KEY` from the environment once at construction and **fails fast at startup** if it's missing or the wrong length, rather than failing later the first time a user tries to save a key.
- [x] Encrypt on write, decrypt only at point of use: `UsersService.updateSettings()` encrypts before the Prisma call; a new `UsersService.getDecryptedApiKey()` — internal-only, never exposed over HTTP — decrypts immediately before `ExtractionController` hands the plaintext to `ExtractionService`.
- [x] `UsersService.getSettings()` (the public-facing read) never selects or returns `encryptedApiKey` — only a derived `hasApiKey: boolean`. Once saved, a key is write-only from the API's perspective.
- [x] Settings UI: a password-type input to save/replace a key, a "key saved ✓" state with Replace/Remove actions once one exists, no re-display of the value ever. Deliberately its **own separate save action**, not bundled into the main Save Settings button — so changing extraction mode or model can't accidentally touch a saved key.
- [x] `resolveModel()` (model-registry.ts) now accepts an optional `apiKeyOverride`, used instead of the provider's env-var key when present.
- [x] `ExtractionService.processFile()` gained a 4th parameter for the decrypted override, threaded through `callModel()` into `resolveModel()`.
- [x] **Defense in depth on logging**: any error thrown during a model call has the `apiKeyOverride` value scrubbed out of its message before it's logged or written to `ExtractionLog` — in case a provider error ever echoed a key back. `Logger.error()` now logs the scrubbed string, not the raw error object (which could otherwise print request details in full).
- [x] Tests: 11 dedicated tests for the crypto module (round-trip, unicode, empty string, **tamper detection on both ciphertext and auth tag**, wrong key rejected, malformed input rejected, key-length validation), plus coverage in `users.service.spec.ts` (encrypts before storage, never returns the key from either read or write endpoint, clearing via `apiKey: ''`, leaving untouched when omitted) and `extraction.service.spec.ts` (override reaches the actual SDK constructor call, falls back to the app default when absent, error-scrubbing verified).
- [x] `pnpm test` — 63/63 green (14 new since Phase 2, plus the crypto module's 11). Both `tsc --noEmit` checks clean.
- [x] **Real end-to-end verification against the live database, not just mocks**: saved a real key via `PUT /users/settings`, confirmed `GET /users/settings` never exposes it, then queried the actual Neon row directly and decrypted it with the real production key from `.env` — confirmed the stored value (a) does not contain the plaintext anywhere, (b) matches the `iv:authTag:ciphertext` format, and (c) decrypts back to the exact original string. That's proof of the complete real round-trip: API → encrypt → Postgres → Postgres → decrypt → original value.

---

## Summary

**Phase 3: Complete.**

### What "done" looks like:
- A user's API key is never stored or logged in plaintext, anywhere ✅ (verified against the real database)
- Extraction works whether or not a user has supplied their own key ✅ (falls back to the app's shared key)

### Next Phase:
→ **Phase 4: Local OCR** (see `roadmap/phase4.md`) — this is the one that actually closes the image-PII gap.

---

## Why this matters (for the CV / interviews)

This is the phase to lead with if asked about security work specifically. "I added a settings toggle" is not a story. "I encrypted user-supplied API keys with AES-256-GCM, split the pure crypto logic from the DI wrapper so it's independently testable, scrubbed the key out of error paths as defense in depth, and verified the actual database row rather than trusting the code" is a story that survives a follow-up question about *how* — which is the actual test in an interview. Also worth having ready: the honest answer about where this stops short of a true enterprise KMS setup, and why that's the right scope call at this project's size rather than a gap to hide.

## Notes

**Files touched:**
- `apps/backend/prisma/schema.prisma` + new migration (`add_byok_key`)
- `apps/backend/src/common/crypto/byok-encryption.ts`, `byok-encryption.spec.ts`, `encryption.service.ts` (all new)
- `apps/backend/src/modules/users/users.service.ts`, `users.module.ts`, `users.service.spec.ts`
- `apps/backend/src/modules/extraction/model-registry.ts`, `extraction.service.ts`, `extraction.controller.ts`, `extraction.service.spec.ts`
- `apps/backend/.env` / `.env.example` (new `BYOK_ENCRYPTION_KEY`)
- `apps/frontend/src/features/extraction-settings/hooks/useSettings.ts`, `components/settings-form.tsx`

**Blockers/Issues:**
- None. `phase3-test-user` has a real (fake) encrypted key left in the dev database from live verification — harmless, no cleanup required.
- Rotating `BYOK_ENCRYPTION_KEY` in the future makes any previously-saved user keys undecryptable — that's inherent to the design, not a bug, but worth remembering before ever changing it in a real deployment.

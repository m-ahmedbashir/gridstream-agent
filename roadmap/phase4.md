# Phase 4: Local OCR — Closes the Image-PII Gap

**Status:** ⏳ PENDING
**Depends on:** Phase 1 (registry — OCR becomes a selectable "processing mode" alongside vision models)

---

## Overview

**This is the phase that answers "what about PII on images."** Right now, an image or a rasterized PDF page goes to the vision model unmasked — pixels can't be regex-matched, so the current mitigation is a warning flag (`imagePiiDetected`), not a fix.

Local OCR (Tesseract.js) converts pixels to text *on the server, before anything is sent to any external model*. Once it's text, it goes through the exact same masking pipeline that already protects typed/pasted text. That's the actual fix — everything else in this plan is either groundwork for it or independently useful.

The honest tradeoff: OCR is generally less accurate than a modern vision model on messy, handwritten, or angled scans. This should be offered as a **choice** ("local OCR — more private" vs. "vision model — better on messy scans"), not a silent replacement.

---

## Tasks Checklist

### ⏳ REMAINING

- [ ] Add `tesseract.js` as a dependency
- [ ] New extraction path: image/rasterized-PDF buffer → Tesseract OCR → raw text → **existing `ComplianceService.mask()`** → existing text-based extraction flow (no new masking logic needed — that's the whole point)
- [ ] Add a per-request or per-user "processing mode" choice: `vision` (current default) vs `local-ocr` (new)
- [ ] Compare OCR output quality against a handful of real invoice samples (clean digital scan, photographed receipt, handwritten note) — document the accuracy gap honestly rather than assuming
- [ ] Confidence scoring: OCR-derived text still needs a confidence signal — likely a flat lower ceiling on the six-anchor scale, or Tesseract's own per-word confidence mapped onto it (needs a decision, not just an assumption)
- [ ] Tests: OCR path masks a PII string in an image the same way the text path already does; mode selection actually switches the path taken
- [ ] Update the README's Known Limitations / Features list once this ships — the "PII masking doesn't cover image content" gap moves from limitation to fixed, same as the PDF rasterization fix earlier in this project's history

---

## Summary

**Phase 4: Not started.**

### What "done" looks like:
- A user who picks "local OCR" gets images processed with the same PII masking guarantees text already has
- The tradeoff (privacy vs. accuracy on messy scans) is documented, not hidden

### Next Phase:
→ **Phase 5: `generateObject`/`streamObject` migration** (independent — can happen anytime, see `roadmap/phase5.md`)

---

## Why this matters (for the CV / interviews)

This is the strongest story in the whole plan: *"I documented a real gap in my own PII handling, then built the fix, instead of leaving the warning flag as the permanent answer."* That's a fundamentally different claim than "I added OCR support" — it's evidence of the same audit-and-fix habit already visible elsewhere in this project (the PDF rasterization fallback, the stale test suite, the license mismatch). One habit, multiple examples, is a pattern an interviewer will notice.

## Notes

**Files this will touch:**
- `apps/backend/package.json` (new dependency)
- `apps/backend/src/modules/extraction/extraction.service.ts`
- Likely a new `apps/backend/src/modules/extraction/ocr.service.ts`
- `apps/frontend/src/features/extraction-settings/` (processing-mode choice)
- `README.md` (move the image-PII item from Known Limitations to Features once shipped)

**Blockers/Issues:**
- None yet — the accuracy-comparison task should happen before committing to a UX (e.g. before deciding whether OCR is a full alternative or just a fallback for specific file types).

# Phase 3: Frontend Settings UI - Task Tracking

**Status:** READY TO START  
**Start Date:** 2026-04-24  
**Focus:** Allow user to choose extraction mode

---

## Overview

Phase 3 adds the settings UI where users can choose:
- **Auto-Approve**: Extract → Show result → One-click save
- **Manual-Review**: Extract → Show editable form → User edits → Save

---

## Tasks Checklist

### 📋 TO DO

- [ ] Create Settings Feature Structure
  - Create: `apps/frontend/src/features/extraction-settings/`
  - Create: `apps/frontend/src/features/extraction-settings/components/settings-form.tsx`
  - Create: `apps/frontend/src/features/extraction-settings/hooks/useSettings.ts`

- [ ] Create Settings Form Component
  - Two radio buttons: Auto-Approve or Manual-Review
  - Save button to persist to backend
  - Show current mode

- [ ] Create Settings Page Route
  - Create: `apps/frontend/src/app/dashboard/extraction-settings/page.tsx`
  - Display settings form
  - Link from main dashboard

- [ ] Create API Hook (useSettings)
  - `GET /users/settings` - Fetch current mode
  - `PUT /users/settings` - Save mode preference
  - Store userId in localStorage or from Clerk

---

## Implementation Notes

**Simple approach:**
- Use `localStorage` to store userId (portfolio MVP, not production)
- Radio buttons with shadcn/ui components (already available)
- Handle mode in context or localStorage
- Pass mode to Upload component

---

## Success Criteria

- ✓ User can navigate to settings page
- ✓ Can select extraction mode (Auto-Approve or Manual-Review)
- ✓ Mode persists to backend
- ✓ Mode is retrievable on app load

---

## Files to Create

| File | Purpose |
|------|---------|
| `extraction-settings/components/settings-form.tsx` | Settings form with radio buttons |
| `extraction-settings/hooks/useSettings.ts` | API calls & state |
| `app/dashboard/extraction-settings/page.tsx` | Settings page route |

---

## Next Phase

After Phase 3, the frontend will have the settings UI. Then:
- Phase 4: Build the HITL review component (editable form for manual mode)
- Phase 5: Wire everything together end-to-end

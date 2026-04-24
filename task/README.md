# HITL + Database Integration - Master Task Index

**Project Goal:** Implement Human-In-The-Loop workflow with database persistence and user settings for invoice extraction.

**Overall Status:** STARTING (Phase 1 in progress)  
**Last Updated:** 2026-04-22

---

## Phase Breakdown

| Phase | Focus | Status | Files |
|-------|-------|--------|-------|
| **Phase 1** | Database Setup (Prisma + Schema) | ✅ COMPLETE | `task/phase1.md` |
| **Phase 2** | Backend Modules (Invoices + Users) | 🔄 IN PROGRESS | `task/phase2.md` |
| **Phase 3** | Frontend Settings Feature | ⏳ PENDING | `task/phase3.md` |
| **Phase 4** | Frontend HITL Review Component | ⏳ PENDING | `task/phase4.md` |
| **Phase 5** | Integration + Testing | ⏳ PENDING | `task/phase5.md` |

---

## Quick Start

**View current phase tasks:**
```
Open: task/phase1.md
```

**After Phase 1 completes:**
```
Open: task/phase2.md
```

---

## Key Milestones

1. ✅ Plan approved (goal.md created)
2. ⏳ Phase 1: Database ready
3. ⏳ Phase 2: Backend APIs working
4. ⏳ Phase 3: Settings UI built
5. ⏳ Phase 4: Review form built
6. ⏳ Phase 5: E2E testing complete

---

## Important Files

**Core Implementation Files:**
- `apps/backend/prisma/schema.prisma` - Database schema
- `apps/backend/src/modules/invoices/` - Invoice CRUD
- `apps/backend/src/modules/users/` - User settings
- `apps/frontend/src/features/extraction-settings/` - Settings UI
- `apps/frontend/src/features/extraction-review/` - Review component

**Reference Documents:**
- `goal.md` - Project vision & GDPR requirements
- `task/phase*.md` - Phase-specific tracking

---

## How to Navigate

1. **Before starting a phase:** Open the corresponding `phase*.md` file
2. **During implementation:** Check off completed tasks in the phase file
3. **When stuck:** Review the "Blockers/Issues" section in the phase file
4. **After completion:** Move to next phase file

---

## Git Workflow

Each phase should ideally be **one commit** when completed:

```bash
git add .
git commit -m "feat: Phase X - [description of what was added]"
```

Example:
```bash
git commit -m "feat: Phase 1 - Add Prisma schema and database setup"
```

---

## Notes

- ⚠️ Database URL is `file:./dev.db` (SQLite, local development only)
- ⚠️ For production, migrate to PostgreSQL by changing `datasource` in schema.prisma
- ℹ️ All phases follow the architecture from `goal.md`
- ℹ️ Frontend and backend can be built in parallel after Phase 1 completes

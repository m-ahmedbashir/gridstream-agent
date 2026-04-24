# Phase 2: Backend Modules (Simplified) - Task Tracking

**Status:** READY TO START  
**Start Date:** 2026-04-24  
**Focus:** Portfolio - Minimal viable flow

---

## Overview

Phase 2 builds **only what's needed** for the HITL workflow:
- Save invoices to database (single endpoint)
- Get/update user extraction mode preference
- Minimal auth (Clerk integration)

This is intentionally simple to show the workflow clearly.

---

## Tasks Checklist

### 📋 TO DO

- [ ] Create Invoices Module (MINIMAL)
  - Create: `apps/backend/src/modules/invoices/invoices.module.ts`
  - Create: `apps/backend/src/modules/invoices/invoices.service.ts`
  - Create: `apps/backend/src/modules/invoices/invoices.controller.ts`
  - **Single Endpoint:**
    - `POST /invoices` - Save extracted invoice to database
      - Input: `{ invoiceData: Invoice }`
      - Output: saved invoice with ID + timestamps
      - No auth needed for MVP (portfolio)

- [ ] Create Users Module (MINIMAL)
  - Create: `apps/backend/src/modules/users/users.module.ts`
  - Create: `apps/backend/src/modules/users/users.service.ts`
  - Create: `apps/backend/src/modules/users/users.controller.ts`
  - **Two Endpoints:**
    - `GET /users/settings` - Get extraction mode (default: MANUAL_REVIEW)
    - `PUT /users/settings` - Update extraction mode

- [ ] Update App Module
  - Import: InvoicesModule
  - Import: UsersModule

---

## Implementation Notes

**Keep it simple:**
- No auth guards needed for portfolio MVP
- No pagination, filters, or complex queries
- No error handling beyond basics
- Single POST endpoint for invoices
- Two simple GET/PUT endpoints for settings

**Database operations:**
- Use PrismaService (already injected)
- Save invoice with user identifier (store in localStorage on frontend)
- Default extraction mode to MANUAL_REVIEW

---

## API Endpoints (3 Total)

```
POST /invoices/save
  Body: { invoiceData: Invoice, userId: string }
  Response: { id, invoiceData, createdAt, updatedAt }

GET /users/settings
  Response: { extractionMode: "AUTO_APPROVE" | "MANUAL_REVIEW" }

PUT /users/settings
  Body: { extractionMode: "AUTO_APPROVE" | "MANUAL_REVIEW" }
  Response: { extractionMode, updatedAt }
```

---

## Success Criteria

- ✓ Frontend can POST invoice → saves to database
- ✓ Frontend can GET/PUT user settings → mode preference saved
- ✓ Build succeeds
- ✓ Shows the HITL flow working end-to-end
- ✓ Clean, readable code for portfolio

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/backend/src/modules/invoices/invoices.module.ts` | Module |
| `apps/backend/src/modules/invoices/invoices.service.ts` | Service (DB logic) |
| `apps/backend/src/modules/invoices/invoices.controller.ts` | Controller (1 endpoint) |
| `apps/backend/src/modules/users/users.module.ts` | Module |
| `apps/backend/src/modules/users/users.service.ts` | Service |
| `apps/backend/src/modules/users/users.controller.ts` | Controller (2 endpoints) |

---

## Blockers/Issues

- None yet


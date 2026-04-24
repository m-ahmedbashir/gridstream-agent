# Phase 6: Gmail Automation + HIL Queue

**Status:** PLANNING
**Goal:** Automatically capture invoice emails from Gmail, extract attachments, and route them through the existing HIL workflow

---

## The Core Problem

Invoices don't only arrive through the upload UI. They come as email attachments.
The user wants:
1. Gmail monitored for invoice emails (by label, sender, or keyword)
2. Attachments auto-extracted using the existing Groq pipeline
3. HIL applied: auto-approve saves immediately, manual-review queues for UI approval
4. Optionally save processed emails/attachments to Google Drive (organized by folder)

---

## HIL for Email (The Key Design Decision)

With file upload, the user is present — they upload, they see the result immediately.

With email, the user is **not present** when the email arrives. HIL must work asynchronously:

```
Email arrives
      ↓
Backend polls Gmail (every 5 min) or receives Pub/Sub push
      ↓
Attachment extracted via Groq AI
      ↓
         ┌─── AUTO_APPROVE ──→ Save to DB directly → done
         └─── MANUAL_REVIEW ──→ Store in EmailQueue (status: PENDING)
                                        ↓
                               User opens "Email Inbox" page
                                        ↓
                              Sees pending items with editable fields
                                        ↓
                              Approve (save to DB) or Reject (discard)
```

The `EmailQueue` is the HIL holding area for email-sourced invoices.

---

## Architecture

### New Database Models

```prisma
model GmailToken {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken  String   // encrypted
  refreshToken String   // encrypted
  expiresAt    DateTime
  historyId    String?  // Gmail history ID for incremental sync
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model EmailQueue {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Email metadata
  gmailMessageId  String   // Gmail message ID (dedup key)
  senderEmail     String
  subject         String
  receivedAt      DateTime

  // Extracted invoice data (editable before save)
  extractedData   Json     // The Invoice object from Groq

  // Attachment reference
  attachmentName  String
  mimeType        String

  // HIL status
  status          String   @default("PENDING") // PENDING | APPROVED | REJECTED
  rejectionReason String?

  // Link to final saved invoice (after approval)
  invoiceId       String?  @unique

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, status])
  @@unique([userId, gmailMessageId]) // prevent duplicate processing
}
```

---

## Phase 6 Tasks

### 6.1 Gmail OAuth Setup
- Google Cloud project → enable Gmail API
- OAuth 2.0 credentials (web app, redirect URI: `http://localhost:3001/gmail/oauth/callback`)
- Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in backend `.env`
- Add `googleapis` package to backend

**Files:**
- `apps/backend/src/modules/gmail/gmail-oauth.service.ts` — generate auth URL, exchange code for tokens, refresh tokens
- `apps/backend/src/modules/gmail/gmail.controller.ts` — GET `/gmail/connect`, GET `/gmail/oauth/callback`
- `apps/backend/src/modules/gmail/gmail.module.ts`

### 6.2 Database Updates
- Add `GmailToken` and `EmailQueue` models to `schema.prisma`
- Add `gmailToken` and `emailQueue` relations to `User`
- Run `npx prisma migrate dev --name add-gmail-email-queue`

### 6.3 Gmail Polling Service
- NestJS `@Cron` job that runs every 5 minutes
- For each user who has a GmailToken:
  - Use Gmail `history.list` with saved `historyId` for incremental sync (only new messages since last check)
  - Filter messages by label (e.g. label:invoice) or query (e.g. `has:attachment subject:invoice`)
  - Download attachments (PDF, PNG, JPG only)
  - Send to existing extraction service (reuse `ExtractionService`)
  - Branch on user's `extractionMode`:
    - `AUTO_APPROVE` → save to Invoice table directly
    - `MANUAL_REVIEW` → save to EmailQueue with status PENDING

**Files:**
- `apps/backend/src/modules/gmail/gmail-sync.service.ts` — polling + extraction routing
- `apps/backend/src/modules/gmail/gmail-filter.config.ts` — configurable filter rules

### 6.4 Email Queue API Endpoints

```
GET  /email-queue              → List all PENDING items for current user
GET  /email-queue/:id          → Get single queue item with extracted data
PUT  /email-queue/:id/approve  → Edit extracted data + approve → saves to Invoice table
PUT  /email-queue/:id/reject   → Reject with optional reason → status = REJECTED
DELETE /email-queue/:id        → Hard delete queue item
```

**Files:**
- `apps/backend/src/modules/email-queue/email-queue.module.ts`
- `apps/backend/src/modules/email-queue/email-queue.service.ts`
- `apps/backend/src/modules/email-queue/email-queue.controller.ts`

### 6.5 Gmail Filter Settings (User-Configurable)
Users control which emails get captured:

```
GET  /gmail/filters            → Get user's filter rules
PUT  /gmail/filters            → Update filter rules
POST /gmail/disconnect         → Revoke token + delete GmailToken
GET  /gmail/status             → Check if connected + last sync time
```

Filter options stored as JSON on GmailToken:
```json
{
  "query": "has:attachment subject:invoice",
  "allowedSenders": ["billing@vendor.com"],
  "requiredLabel": "Invoices",
  "attachmentTypes": ["pdf", "png", "jpg"]
}
```

### 6.6 Frontend: Gmail Connect Page

**File:** `apps/frontend/src/app/dashboard/gmail/page.tsx`

- Show "Connect Gmail" button → redirect to backend OAuth URL
- After OAuth callback, show connected status + last sync time
- Form to configure filter rules (query string, allowed senders, required label)
- "Disconnect Gmail" button

### 6.7 Frontend: Email Inbox Queue Page

**File:** `apps/frontend/src/app/dashboard/email-queue/page.tsx`

- List of PENDING email queue items
- Each item shows: sender, subject, received date, attachment name
- Click to expand → shows ExtractionResultCard (same editable component from upload flow)
- Approve button → PUT /email-queue/:id/approve with edited data
- Reject button → PUT /email-queue/:id/reject
- Badge count on sidebar nav link showing pending count

**Files:**
- `apps/frontend/src/features/email-queue/components/queue-item-card.tsx`
- `apps/frontend/src/features/email-queue/hooks/useEmailQueue.ts`

### 6.8 Google Drive Save (Optional)
After approve, optionally save to Drive:
- User picks a Drive folder via Drive Picker API
- Backend uploads the original attachment file to that folder
- Store Drive file ID on the Invoice record

---

## Approach to Keeping HIL

The `ExtractionResultCard` component you already built works for both flows:

| Upload Flow | Email Flow |
|-------------|------------|
| User uploads → result shown immediately | Email arrives → goes to PENDING queue |
| User edits in card → saves | User opens queue → edits same card → approves |
| One at a time, real-time | Async, batch queue, user reviews when ready |

The **same** edit/save component handles both. The only difference is the save action:
- Upload → `POST /invoices/save`
- Email queue approve → `PUT /email-queue/:id/approve`

---

## Files Summary

### Backend
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add GmailToken + EmailQueue models |
| `modules/gmail/gmail-oauth.service.ts` | OAuth token management |
| `modules/gmail/gmail-sync.service.ts` | Polling + extraction routing |
| `modules/gmail/gmail.controller.ts` | OAuth callback + filter endpoints |
| `modules/email-queue/email-queue.service.ts` | Queue CRUD + approve/reject |
| `modules/email-queue/email-queue.controller.ts` | REST endpoints |

### Frontend
| File | Purpose |
|------|---------|
| `app/dashboard/gmail/page.tsx` | Gmail connect + filter config |
| `app/dashboard/email-queue/page.tsx` | Inbox queue with HIL review |
| `features/email-queue/components/queue-item-card.tsx` | Pending item card (reuses ExtractionResultCard) |
| `features/email-queue/hooks/useEmailQueue.ts` | API calls for queue |

### Packages to Add
- `googleapis` (backend) — Gmail API client
- `@google-cloud/pubsub` (optional, for push instead of polling)

---

## Environment Variables to Add

```env
# Backend
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/gmail/oauth/callback
GMAIL_POLL_INTERVAL_MINUTES=5
```

---

## Success Criteria

- ✓ User connects Gmail via OAuth from the dashboard
- ✓ Backend automatically polls Gmail every 5 minutes
- ✓ Matching emails have attachments extracted by Groq AI
- ✓ AUTO_APPROVE emails saved to DB without user action
- ✓ MANUAL_REVIEW emails appear in Email Inbox queue as PENDING
- ✓ User can edit extracted fields and approve/reject from queue page
- ✓ Approved emails saved to Invoice table (same DB as upload flow)
- ✓ Duplicate emails never processed twice (gmailMessageId dedup)

---

## What's Shared with Existing Code

- `ExtractionService` — same Groq AI extraction, no changes needed
- `ExtractionResultCard` — same editable component, reused in queue page
- `useSettings` hook — same extraction mode check
- `Invoice` DB model — email-approved invoices land in same table as upload-approved

---

## Next Phase

After Phase 6:
- Phase 7: Drive/S3 file storage for processed attachments
- Phase 8: Notification system (in-app badge, email digest of processed invoices)

# Project Goal — Unstructured-to-Ops Action Agent

## What This Project Is

An AI-powered **data entry automation tool** for operations teams. The core problem it solves: businesses receive messy real-world inputs (invoice photos, WhatsApp screenshots, emails, scanned PDFs) and someone has to manually type that data into a CRM or database. This agent eliminates that bottleneck entirely.

---

## The Application Flow

```
User uploads image / pastes text
        ↓
Backend receives file (NestJS)
        ↓
ComplianceService masks PII (emails, cards, IBANs, phone numbers)
        ↓
Groq AI (llama-4-scout vision) reads image + text
        ↓
generateObject() extracts data → validated against InvoiceSchema (Zod)
        ↓
Structured Invoice object returned to frontend
        ↓
Human Review Dashboard (HITL) — operator sees original + extracted side by side
        ↓
Operator clicks Approve or Edit
        ↓
Approved data saved to database
```

---

## What Is Already Built

| Component | Tech | Status |
|-----------|------|--------|
| AI extraction | Groq llama-4-scout (free tier) | ✅ Done |
| File upload UI | Next.js + shadcn/ui | ✅ Done |
| PII masking | ComplianceService | ✅ Done |
| Database | Prisma + PostgreSQL (Neon) | ✅ Done |
| Auth | Clerk | ✅ Done |

## What's Being Built (Portfolio MVP)

| Component | Purpose | Status |
|-----------|---------|--------|
| Invoices API | Save extracted data to DB | 🔄 In Progress |
| Users API | Store user preferences (auto-approve vs manual) | 🔄 In Progress |
| Settings UI | Let user choose workflow mode | ⏳ Next |
| Review Form | Edit extracted data before saving | ⏳ Next |

---

## GDPR Compliance — Goal & What It Means For This App

**Note:** For portfolio MVP, GDPR is **out of scope**. The architecture is designed to support it later if needed.

Core principles already implemented:
- ✅ PII masking before external AI calls
- ✅ Human-in-the-loop before any data persistence
- ✅ Database stores only structured data (no raw inputs)

Future additions (not in MVP):
- Right to erasure endpoint
- Audit logging
- Data retention policies

### What GDPR Requires (Relevant to This App)

| Requirement | What It Means Here |
|---|---|
| **Data Minimisation** | Only extract the invoice fields you actually need — already enforced by InvoiceSchema |
| **PII Masking Before AI** | Never send raw PII to external AI — already done by ComplianceService |
| **Consent / Lawful Basis** | User must have a legal reason to process the invoice data (e.g. contract, legitimate interest) |
| **Right to Erasure** | If a record was extracted and stored, the user must be able to delete it |
| **Data Retention Limits** | Extracted records cannot be stored forever — need retention policy + auto-delete |
| **Audit Trail** | Must log who processed what, when, and what decision was made (approve/edit/reject) |
| **Data Breach Notification** | Must be able to detect and report a breach within 72 hours |
| **Processor Agreement** | Groq, Clerk, Vercel are sub-processors — need DPAs in place |

### What Needs To Be Built (Portfolio MVP Only)

1. **Invoices API** - Single endpoint to save extracted invoices
2. **Users API** - Two endpoints to get/set extraction mode preference
3. **Settings UI** - Let user choose: Auto-Approve or Manual-Review
4. **Review Form** - Editable form to modify extracted data before saving

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui, Clerk auth |
| Backend | NestJS, Vercel AI SDK |
| AI Model | Groq llama-4-scout-17b-16e-instruct (free tier) |
| Schema Validation | Zod (shared `@maintain/shared` package) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Portfolio MVP Scope

**What we're building:**
- Clean end-to-end HITL workflow ✅
- Two workflow modes with user preference ✅
- Editable form for manual review ✅
- Database persistence ✅
- Readable, portfolio-quality code ✅

**What we're NOT building (out of scope):**
- Complex CRUD operations
- Full GDPR compliance
- Advanced error handling
- Production deployment
- API documentation

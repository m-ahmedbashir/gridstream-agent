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

| Area | Detail | Status |
|---|---|---|
| File upload UI | Drag-and-drop, supports images + PDF + text | Done |
| AI extraction | Groq llama-4-scout-17b (free tier, no card) via Vercel AI SDK | Done |
| PII masking | Emails, credit cards, IBANs, VAT IDs, phone numbers masked before AI call | Done |
| Type-safe output | Zod `InvoiceSchema` shared across frontend + backend | Done |
| HITL dashboard | Split-screen review UI (shadcn/ui) | In progress |
| Auth | Clerk (keyless dev mode) | Done |
| Monorepo | pnpm + Turborepo, `apps/frontend` (Next.js), `apps/backend` (NestJS) | Done |

---

## GDPR Compliance — Goal & What It Means For This App

This is the **next major milestone**. The app already handles PII, which makes GDPR relevant. Here is what GDPR compliance means in this context and what needs to be built:

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

### What Needs To Be Built

1. **Audit Log** — every extraction event logged: who uploaded, when, PII detected (yes/no), human decision (approved/edited/rejected), timestamp
2. **Retention Policy** — extracted records flagged with a `expiresAt` date, auto-deleted after N days
3. **Right to Erasure endpoint** — `DELETE /records/:id` that hard-deletes the record and its audit trail
4. **Consent Banner / Data Notice** — frontend notice explaining what data is processed and why
5. **Data Processing Register** — internal doc listing all data flows (upload → AI → DB → human)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui, Clerk auth |
| Backend | NestJS, Vercel AI SDK |
| AI Model | Groq llama-4-scout-17b-16e-instruct (free tier) |
| Schema Validation | Zod (shared `@opp/shared` package) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Key Decisions Made

- **Switched from Google Gemini to Groq** — Groq free tier requires no credit card, Gemini required billing setup. Model: `meta-llama/llama-4-scout-17b-16e-instruct`
- **PaddleOCR dropped** — Groq's vision model reads images natively, a separate OCR microservice is unnecessary overhead
- **HITL is non-negotiable** — no data hits the database without a human approving it first (this is also the GDPR "human in the loop" requirement for automated processing)
- **PII masked before AI** — ComplianceService runs before any external API call, so raw personal data never leaves the system unredacted

---

## What Is Not Built Yet

- Database (no ORM, no tables yet — extraction results returned to frontend but not persisted)
- Right to erasure / audit log (GDPR requirement)
- Confidence scoring (auto-approve high-confidence, flag low-confidence)
- CRM integrations (Salesforce, HubSpot)
- Expanded schemas beyond invoices (employee forms, maintenance reports)

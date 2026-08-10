# Project Goal — maintain-agent

## What This Project Is

An **AI-powered industrial maintenance planner** for manufacturing. The core problem it solves: factories manually review maintenance reports and plan retrofits in spreadsheets, which is slow, error-prone, and impossible to scale. This agent automates that bottleneck while keeping a human in the loop.

---

## The Application Flow

```
Technician uploads a German maintenance report (PDF / image / text)
                    ↓
Backend receives file (NestJS)
                    ↓
ComplianceService masks PII (emails, cards, IBANs, phone numbers)
                    ↓
AI reads the report via the provider-agnostic model registry
                    ↓
generateObject() extracts data → validated against MachineProfileSchema (Zod)
                    ↓
Structured MachineProfile returned to frontend
                    ↓
Matching service queries best-practice measures for the machine type
                    ↓
Planning service generates an ROI-backed ProjectPlan with German executive summary
                    ↓
Human Review Dashboard (HITL) — plant manager reviews plan
                    ↓
Manager clicks Approve / Reject
                    ↓
Approved plan saved to database
```

---

## What Is Already Built

| Component | Tech | Status |
|-----------|------|--------|
| AI extraction | Provider-agnostic registry (Groq, OpenAI, Anthropic) | ✅ Done |
| File upload UI | Next.js + shadcn/ui | ✅ Done |
| PII masking | ComplianceService | ✅ Done |
| Database | Prisma + PostgreSQL | ✅ Done |
| Auth | Clerk | ✅ Done |
| Maintenance schemas | MachineProfile, Measure, ProjectPlan | ✅ Done |
| Measure matching | Filter by machine type + runtime | ✅ Done |
| Plan generation | GPT-4o reasoning + Zod validation | ✅ Done |

---

## What's Being Built (Portfolio MVP)

| Component | Purpose | Status |
|-----------|---------|--------|
| Maintenance extraction API | Extract MachineProfile from reports | ✅ Done |
| Measure database seed | Curated German industrial measures | ✅ Done |
| Plan approval API | Approve/reject generated plans | ✅ Done |
| Maintenance dashboard | Upload, measures, plan, history | ✅ Done |
| Settings UI | Plan approval mode + model preference | ✅ Done |

---

## GDPR Compliance — Goal & What It Means For This App

**Note:** For portfolio MVP, full GDPR compliance is **out of scope**. The architecture is designed to support it later if needed.

Core principles already implemented:
- ✅ PII masking before external AI calls
- ✅ Human-in-the-loop before any data persistence
- ✅ Database stores only structured data (no raw inputs)

Future additions (not in MVP):
- Right to erasure endpoint
- Audit logging
- Data retention policies

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui, Clerk auth |
| Backend | NestJS, Vercel AI SDK v6, Prisma, PostgreSQL |
| AI Models | Groq, OpenAI, Anthropic via model registry |
| Schema Validation | Zod (shared `@maintain/shared` package) |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Portfolio MVP Scope

**What we're building:**
- Clean end-to-end HITL workflow ✅
- Maintenance plan auto-approval / manual review ✅
- ROI-backed project plans with German summaries ✅
- Database persistence ✅
- Readable, portfolio-quality code ✅

**What we're NOT building (out of scope):**
- Full ERP integration
- Full GDPR compliance
- Advanced error handling
- Production deployment
- API documentation

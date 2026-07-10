# Unstructured-to-Ops Action Agent

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg)
![pnpm](https://img.shields.io/badge/pnpm-%3E%3D%2010.0.0-orange.svg)
![TypeScript](https://img.shields.io/badge/typescript-latest-blue.svg)

## Overview

**Unstructured-to-Ops Action Agent** is a "Buffer Agent" that bridges unstructured, messy real-world documents and structured operational data. Instead of a conversational chatbot, it actively closes the manual-data-entry gap: extract, validate, and stage invoice data for database ingestion behind a **Human-in-the-Loop (HITL)** governance layer — nothing consequential happens without an explicit human approval step.

Whether the input is a scanned invoice photo, a plain-text export, or a pasted CSV, the agent processes it with **Groq (Llama 4 Scout)** through the **Vercel AI SDK**, validates every field against a **Zod** schema shared across the whole stack, and surfaces a per-field confidence score so a reviewer knows exactly what to double-check instead of re-reading everything blindly.

The repo is a `pnpm` + Turborepo monorepo: a **Next.js** frontend (Clerk auth, a chat assistant with agentic tool-approval) and a **NestJS** backend (Prisma/PostgreSQL, the extraction pipeline, PII compliance masking).

---

## 🚀 Features

### 🟢 Current Features

- **Multimodal extraction.** Text, CSV, JSON, PDF, and images (PNG/JPEG/WebP) are all accepted. Images go straight to Groq's vision-capable model with no local OCR step; PDFs have their text layer pulled out server-side via `pdf-parse` before masking.
- **PII masking before anything leaves the server.** An ordered regex pipeline (IBAN → card → email → VAT → phone) strips sensitive tokens out of any text content *before* it's sent to the model. Order is deliberate: looser patterns run last so they can't partially consume a more specific match.
- **Confidence as six fixed anchors, not a fabricated float.** The extraction prompt forces exactly `1.0 / 0.8 / 0.6 / 0.4 / 0.2 / 0.0`, each with a written rubric, so a score means the same thing every time — and the UI's badge colour thresholds map onto those same six values with no room for mismatch.
- **Two independent HITL mechanisms:**
  - A per-user `extractionMode` setting (`MANUAL_REVIEW` / `AUTO_APPROVE`, defaulting to the safe option) gates whether extracted invoices need a review click before saving.
  - The chat assistant's `deleteInvoice` tool sits in an `approval-requested` state until a human clicks Approve — the destructive action cannot execute otherwise, and success/failure is wired back into the tool's state either way, not left hanging.
- **One Zod schema, shared everywhere.** `InvoiceSchema` lives once in `packages/shared`, uses `.strict()` so hallucinated extra fields are rejected, and both apps import the same `z.infer`'d type — a schema change is a compile error in both apps at once.
- **Defense-in-depth uploads.** Files are buffered in memory only (never written to disk), and MIME type/size are validated independently at three layers (Multer, the NestJS pipe, and an in-service allowlist) before any processing starts.
- **Real observability.** Every extraction attempt — success *and* failure — writes an `ExtractionLog` row. The `/extraction/stats` endpoint runs five Prisma aggregate queries concurrently via `Promise.all` and reports success rate, PII-detection rate, and average latency by source type.
- **A virtualized, stream-aware chat UI.** The message list renders through `react-virtuoso` instead of one DOM node per message, and autoscroll behaviour adapts to state (`'auto'` while streaming, `'smooth'` on submit, off once the user has scrolled up to read history).
- **22 passing unit tests** across the extraction and compliance services, including dedicated coverage for the PDF-with-text-layer, PDF-with-no-text-layer, and PDF-plus-pasted-text cases.

### 🟠 Known Limitations

Documented here deliberately rather than discovered later — this list is a snapshot from an active codebase, not a finished product:

- **A scanned/image-only PDF (no text layer) is rejected outright**, with a clear `422` asking the user to upload it as an image instead — there's no automatic PDF-to-image fallback yet. See Roadmap.
- **PII masking doesn't cover image content.** The regex pipeline only runs on text. A printed IBAN or email visible in a scanned invoice photo is sent to Groq unmasked, because pixels can't be regex-matched — masking currently only protects text that's typed or pasted alongside a file.
- **The chat's invoice-preview card partly regex-scrapes the assistant's free-text reply** rather than reading fully structured tool output — a pragmatic shortcut that's fragile if the model rephrases itself.

*(Previously listed here and since fixed: PDFs silently sending no content to the model; a red test suite with stale `generateObject`/`@ai-sdk/google` mocks and a missing `PrismaService` in the constructor; the `geminiResponse` naming leftover from an earlier Gemini-based implementation.)*

### 🔵 Roadmap

**Near-term:**
- A PDF-to-image fallback (render the first page and route it through the existing vision path) for scanned PDFs that currently get rejected with a 422.
- Image-level PII handling — likely a vision pre-pass that flags whether sensitive text is visible in the frame, surfaced to the user as a warning rather than silently sent through.
- Replace the chat's regex-scraped invoice preview with structured tool output.

**Mid-term (more of the Vercel AI SDK, used more deliberately):**
- **`generateObject`/`streamObject` in place of `generateText` + manual `JSON.parse`.** Right now the model's raw text response is parsed and cast by hand inside a `try`/`catch`; the SDK's schema-driven structured output would let Zod validate the response directly instead of trusting a string.
- **`useObject` on the frontend** to stream extraction progress field-by-field into the review card instead of waiting on one blocking response — meaningfully better perceived latency on larger documents.
- **Multi-step agentic tool loops** (`stopWhen`/`maxSteps`) in the chat assistant, so it can chain something like "find this invoice → summarize it → propose the delete" as one guided sequence instead of one tool call per turn.
- **Embeddings (`embed`/`embedMany`)** over stored invoices for genuine semantic search in chat ("show me invoices like this one") rather than exact-field matching.
- **A provider-agnostic model registry.** The extraction service is hard-wired to Groq; abstracting model selection behind a small config layer would make it trivial to swap in Anthropic/OpenAI/a local model per environment — the same bring-your-own-model flexibility this agent already benefits from as a *user* of Groq.

**Stretch (broader product-engineering scope):**
- Queue-based batch processing (BullMQ) for bulk uploads instead of one synchronous request per file.
- Rate limiting on the API itself (NestJS Throttler), plus explicit retry/backoff around Groq's 429s rather than a single caught exception.
- OpenTelemetry tracing around the extraction pipeline, so latency and failures are visible per-span, not just per-log-line.
- CI running the test suite on every push — would have caught the stale mocks above automatically.
- Fine-grained permissions on top of Clerk auth (PBAC — who can approve vs. who can only view), rather than a single per-user extraction-mode toggle.
- CSV/export reporting and a webhook emitter for downstream systems, so approved invoices can push out to something other than this app's own database.
- A Docker/devcontainer setup for one-command onboarding.

---

## 🏗 Architecture

```text
opp-agent/
├── apps/
│   ├── frontend/       # Next.js app — dashboard, chat assistant, extraction review UI
│   └── backend/        # NestJS API
│       └── src/modules/
│           ├── extraction/    # Upload handling + the Groq extraction pipeline
│           ├── compliance/    # PII masking
│           ├── invoices/      # CRUD for saved invoices
│           └── users/         # Per-user extraction-mode (HITL) settings
├── packages/
│   └── shared/         # @opp/shared — the Zod InvoiceSchema, single source of truth
└── shared/              # General monorepo configuration
```

---

## 🛠 Tech Stack

- **AI:** Vercel AI SDK 6, Groq (`llama-4-scout-17b-16e-instruct`)
- **Validation:** Zod, `nestjs-zod`
- **Document parsing:** `pdf-parse` (PDF text-layer extraction)
- **Frontend:** Next.js, `@ai-sdk/react` (`useChat`), Tailwind CSS, shadcn/ui, `react-virtuoso`
- **Backend:** NestJS, Prisma, PostgreSQL
- **Auth:** Clerk
- **Workspaces/Tooling:** pnpm, Turborepo

---

## ⚙️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/installation) (v10+)
- A PostgreSQL database (e.g. a free [Neon](https://neon.tech) or [Railway](https://railway.app) instance)

### Installation

```bash
git clone https://github.com/m-ahmedbashir/opp-agent.git
cd opp-agent
pnpm install
```

### Environment Variables

**Backend (`apps/backend/.env`):**
```bash
cd apps/backend
cp .env.example .env
```
Set `GROQ_API_KEY` (free, no card required, from [console.groq.com](https://console.groq.com)) and `DATABASE_URL` (your PostgreSQL connection string).

**Frontend (`apps/frontend/.env`):**
```bash
cd apps/frontend
cp .env.example .env
```
Leave the Clerk keys empty to use Clerk's keyless dev mode, or populate `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` from your Clerk dashboard.

### Database

```bash
cd apps/backend
pnpm prisma migrate dev
```

### Running Locally

```bash
pnpm dev              # both apps via Turborepo
# or individually:
pnpm dev:frontend
pnpm dev:backend
```

### Running Tests

```bash
cd apps/backend
pnpm test
```
22 tests, all passing.

---

## 🧑‍💻 The Magic Inside the Code

**Extraction — masked text (and/or a raw image) in, a Zod-validated structure out:**

```typescript
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// PII is masked before this point — maskedText never contains the raw input
const { text } = await generateText({
  model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: extractionPrompt }, // asks for invoice fields + a 6-anchor confidence score per field
      ...(maskedText ? [{ type: 'text', text: maskedText }] : []),
      ...(imageBuffer ? [{ type: 'image', image: imageBuffer, mimeType }] : []),
    ],
  }],
});

const { invoice, confidence } = JSON.parse(text); // validated against InvoiceSchema (Zod, .strict()) downstream
```

**Human-in-the-loop — an agent can propose a destructive action, but can't execute one without a click:**

```typescript
const { messages, addToolApprovalResponse, addToolOutput } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});

// When a `deleteInvoice` tool call reaches `approval-requested`, the UI renders
// a confirmation card (vendor, amount, invoice number) instead of executing anything.
// Only a literal button click calls DELETE and reports the result back:
async function onApprove(toolCallId: string, invoiceId: string) {
  const res = await fetch(`/invoices/${invoiceId}`, { method: 'DELETE' });
  await addToolApprovalResponse({ id: toolCallId, approved: true });
  await addToolOutput({ toolCallId, tool: 'deleteInvoice', output: { success: res.ok } });
}
```

---

## 🚀 Deployment

- **Frontend (Vercel):** CI from `main`. Build: `pnpm build --filter=frontend`
- **Backend (Railway):** Build: `pnpm build --filter=backend`

---

## 📞 Support and Contributions

Questions or bugs — open an Issue in the repository.

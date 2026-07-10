# Unstructured-to-Ops Action Agent

[![CI](https://github.com/m-ahmedbashir/opp-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/m-ahmedbashir/opp-agent/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg)
![pnpm](https://img.shields.io/badge/pnpm-%3E%3D%2010.0.0-orange.svg)
![TypeScript](https://img.shields.io/badge/typescript-latest-blue.svg)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## Contents

- [Overview](#overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#️-getting-started)
- [The Magic Inside the Code](#-the-magic-inside-the-code)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [Acknowledgments](#-acknowledgments)
- [License](#-license)
- [About the Author](#-about-the-author)

## Overview

**Unstructured-to-Ops Action Agent** is a "Buffer Agent" that bridges unstructured, messy real-world documents and structured operational data. Instead of a conversational chatbot, it actively closes the manual-data-entry gap: extract, validate, and stage invoice data for database ingestion behind a **Human-in-the-Loop (HITL)** governance layer — nothing consequential happens without an explicit human approval step.

Whether the input is a scanned invoice photo, a plain-text export, or a pasted CSV, the agent processes it with **Groq (Llama 4 Scout)** through the **Vercel AI SDK**, validates every field against a **Zod** schema shared across the whole stack, and surfaces a per-field confidence score so a reviewer knows exactly what to double-check instead of re-reading everything blindly.

The repo is a `pnpm` + Turborepo monorepo: a **Next.js** frontend (Clerk auth, a chat assistant with agentic tool-approval) and a **NestJS** backend (Prisma/PostgreSQL, the extraction pipeline, PII compliance masking). Every push and PR runs a real CI pipeline (typecheck + test across all workspaces) — the badge above reflects the actual current state of `main`, not an aspiration.

---

## 🚀 Features

### 🟢 Current Features

- **Multimodal extraction, including multi-page scanned PDFs.** Text, CSV, JSON, PDF, and images (PNG/JPEG/WebP) are all accepted. Images go straight to Groq's vision-capable model with no local OCR step. PDFs try a text-layer extraction first (`pdf-parse`); if a PDF has no real text — a scanned/image-only document — up to its first 5 pages are rendered to PNGs server-side (`pdf-parse`'s bundled `@napi-rs/canvas` rasterizer) and sent as separate image blocks through the same vision path as a direct image upload, instead of failing or only seeing page 1.
- **PII masking before anything leaves the server, with a flag for what it can't reach.** An ordered regex pipeline (IBAN → card → email → VAT → phone) strips sensitive tokens out of any text content *before* it's sent to the model. Text masking can't redact pixels, so for images and rasterized PDF pages the extraction prompt separately asks the model to report whether it can see raw PII (email/phone/IBAN/card) printed anywhere in the frame; if so, `imagePiiDetected` is set, logged, and surfaced as a review warning in the UI — the model's claim is only trusted when an image was actually sent, never taken at face value otherwise.
- **Confidence as six fixed anchors, not a fabricated float.** The extraction prompt forces exactly `1.0 / 0.8 / 0.6 / 0.4 / 0.2 / 0.0`, each with a written rubric, so a score means the same thing every time — and the UI's badge colour thresholds map onto those same six values with no room for mismatch.
- **Three independent HITL mechanisms:**
  - A per-user `extractionMode` setting (`MANUAL_REVIEW` / `AUTO_APPROVE`, defaulting to the safe option) gates whether extracted invoices need a review click before saving.
  - The chat assistant's `deleteInvoice` tool sits in an `approval-requested` state until a human clicks Approve — the destructive action cannot execute otherwise, and success/failure is wired back into the tool's state either way, not left hanging. Its Zod schema fully declares `invoiceNumber`/`vendorName`/`totalAmount`/`currency`/`id` as typed fields, so the frontend reads the confirmation card straight from the tool's structured input — no scraping the assistant's prose to backfill missing fields.
  - The `imagePiiDetected` review warning above.
- **One Zod schema, shared everywhere.** `InvoiceSchema` lives once in `packages/shared`, uses `.strict()` so hallucinated extra fields are rejected, and both apps import the same `z.infer`'d type — a schema change is a compile error in both apps at once.
- **Defense-in-depth uploads.** Files are buffered in memory only (never written to disk), and MIME type/size are validated independently at three layers (Multer, the NestJS pipe, and an in-service allowlist) before any processing starts.
- **Real observability.** Every extraction attempt — success *and* failure — writes an `ExtractionLog` row. The `/extraction/stats` endpoint runs Prisma aggregate queries concurrently via `Promise.all` and reports success rate, text-PII rate, image-PII rate, and average latency by source type.
- **A virtualized, stream-aware chat UI.** The message list renders through `react-virtuoso` instead of one DOM node per message, and autoscroll behaviour adapts to state (`'auto'` while streaming, `'smooth'` on submit, off once the user has scrolled up to read history).
- **A provider-agnostic model registry.** Extraction no longer hard-codes Groq — a small registry (`model-registry.ts`) maps a key to a provider (Groq, OpenAI, or Anthropic today) and tracks per-model capability, so a text-only model can't silently be sent an image it can't read. Swapping the default model is a one-line config change, not a code change. Verified by actually booting the app and confirming NestJS resolves the new dependency correctly, not just by reading the code.
- **A per-user model preference, actually enforced.** A model picker in Settings (`GET /extraction/models` reads the registry directly, so the UI never hand-duplicates it) saves a `modelKey` per user, same pattern as the existing `extractionMode` setting. Every upload now carries a `userId`; the extraction pipeline looks up that user's saved model before processing. Verified live against the real database, not just mocks — set a real user to a text-only model and confirmed the vision guard rejected an image upload citing that exact model.
- **BYOK — bring your own provider key, encrypted at rest.** A user can save their own Groq/OpenAI/Anthropic key in Settings instead of using the app's shared one. AES-256-GCM (authenticated encryption — a tampered ciphertext fails to decrypt rather than silently returning garbage), with the pure crypto logic split from the NestJS service so it's unit-testable with no database or env var needed. The public settings endpoint never returns the key or its ciphertext — only a `hasApiKey` boolean; decryption happens once, server-side, immediately before the provider call. Verified against the real database: saved a key through the real API, then independently decrypted the actual stored row with the production key and confirmed it matches — not just a mocked round-trip.
- **63 passing unit tests** across extraction, compliance, user-settings, and encryption, including multi-page rasterization, rasterization-failure, image-PII-flag, model-registry/vision-guard, per-user model-preference, and BYOK encryption/tamper-detection coverage.


### 🔵 Roadmap

**Near-term (good first issue — see [CONTRIBUTING.md](CONTRIBUTING.md) for details):**
- Fix frontend linting: `next lint` no longer exists as of Next.js 16, and the legacy `.eslintrc.json` also fails under the installed ESLint version (`TypeError: Converting circular structure to JSON` from `next/core-web-vitals`). Needs a real flat-config migration — `pnpm run lint` isn't wired into CI yet because of this.

**Mid-term (more of the Vercel AI SDK, used more deliberately):**
- **`generateObject`/`streamObject` in place of `generateText` + manual `JSON.parse`.** Right now the model's raw text response is parsed and cast by hand inside a `try`/`catch`; the SDK's schema-driven structured output would let Zod validate the response directly instead of trusting a string.
- **`useObject` on the frontend** to stream extraction progress field-by-field into the review card instead of waiting on one blocking response — meaningfully better perceived latency on larger documents.
- **Multi-step agentic tool loops** (`stopWhen`/`maxSteps`) in the chat assistant, so it can chain something like "find this invoice → summarize it → propose the delete" as one guided sequence instead of one tool call per turn.
- **Embeddings (`embed`/`embedMany`)** over stored invoices for genuine semantic search in chat ("show me invoices like this one") rather than exact-field matching.
- **Local OCR (Tesseract.js) as an alternative extraction path.** More than a nice-to-have: images and rasterized PDF pages currently go to the vision model *unmasked*, because pixels can't be regex-matched (that's what the `imagePiiDetected` warning above is standing in for). OCR converts pixels to text *before anything leaves the server*, which means it can run through the exact same masking pipeline text already does — offered as a "more private, but weaker on messy/handwritten scans" alternative to the vision-model path.
- **Local model support (Ollama) is a separate question from the above.** The obvious community provider (`ollama-ai-provider-v2`) requires AI SDK v7; this repo is on v6. The v6→v7 migration touches the multimodal image-message format and the tool-approval mechanics behind the `deleteInvoice` HITL flow — real breaking changes, not just a version bump — so this needs its own deliberate migration (with the `@ai-sdk/codemod` tool, then full re-verification of the extraction and approval flows) rather than happening as a side effect of chasing local-model support.


**Stretch (broader scope):**
- Queue-based batch processing (BullMQ) for bulk uploads instead of one synchronous request per file.
- Rate limiting on the API itself (NestJS Throttler), plus explicit retry/backoff around Groq's 429s rather than a single caught exception.
- OpenTelemetry tracing around the extraction pipeline, so latency and failures are visible per-span, not just per-log-line.
- Fine-grained permissions on top of Clerk auth (PBAC — who can approve vs. who can only view), rather than a single per-user extraction-mode toggle.
- CSV/export reporting and a webhook emitter for downstream systems, so approved invoices can push out to something other than this app's own database.
- A Docker/devcontainer setup for one-command onboarding.

---

## 🏗 Architecture

```text
opp-agent/
├── .github/
│   ├── workflows/ci.yml        # typecheck + test on every push/PR
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
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
├── turbo.json           # build/test/typecheck pipeline across all workspaces
├── LICENSE
├── CONTRIBUTING.md
└── CODE_OF_CONDUCT.md
```

---

## 🛠 Tech Stack

- **AI:** Vercel AI SDK 6 via a provider-agnostic model registry — Groq (`llama-4-scout-17b-16e-instruct`, default), with OpenAI and Anthropic wired in and ready to select
- **Validation:** Zod, `nestjs-zod`
- **Document parsing:** `pdf-parse` (PDF text-layer extraction + `@napi-rs/canvas` rasterization fallback)
- **Frontend:** Next.js, `@ai-sdk/react` (`useChat`), Tailwind CSS, shadcn/ui, `react-virtuoso`
- **Backend:** NestJS, Prisma, PostgreSQL
- **Auth:** Clerk
- **Workspaces/Tooling:** pnpm, Turborepo, GitHub Actions

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
(The Prisma client is also regenerated automatically on every `pnpm install` via a `postinstall` hook — you don't need to run `prisma generate` by hand.)

### Running Locally

```bash
pnpm dev              # both apps via Turborepo
# or individually:
pnpm dev:frontend
pnpm dev:backend
```

### Running Tests & Typecheck

```bash
pnpm test         # 63 tests, all passing — same command CI runs
pnpm run typecheck  # tsc --noEmit across every workspace
```

---

## 🧑‍💻 The Magic Inside the Code

**Extraction — masked text (and/or a raw image) in, a Zod-validated structure out, resolved through a provider-agnostic registry:**

```typescript
import { generateText } from 'ai';
import { resolveModel, MODEL_REGISTRY, DEFAULT_MODEL_KEY } from './model-registry';

// Swapping the model is a config change (a different registry key), not a code change.
// The registry also tracks vision support per model — sending an image to a
// text-only model fails loudly before the request is even made.
const modelDescriptor = MODEL_REGISTRY[modelKey];
if (imageBuffer && !modelDescriptor.supportsVision) {
  throw new Error(`${modelDescriptor.modelId} doesn't support image input`);
}

// PII is masked before this point — maskedText never contains the raw input
const { text } = await generateText({
  model: resolveModel(modelKey ?? DEFAULT_MODEL_KEY),
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

- **Frontend (Vercel):** Build: `pnpm build --filter=frontend`
- **Backend (Railway):** Build: `pnpm build --filter=backend`

(This is separate from the [CI workflow](.github/workflows/ci.yml) above, which typechecks and tests every push/PR — it doesn't deploy anything.)

---

## 🤝 Contributing

Issues and PRs are genuinely welcome, not just a formality. Before opening one:

- Read [CONTRIBUTING.md](CONTRIBUTING.md) — it covers setup, the pre-PR checklist (`pnpm run typecheck` + `pnpm test`, the same commands CI runs), and a short list of concrete good-first-issues pulled straight from this README's own Roadmap.
- This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
- Bug reports and feature requests have templates under `.github/ISSUE_TEMPLATE/`; PRs get a checklist template automatically.

## 🙏 Acknowledgments

The frontend started from [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) by [Kiranism](https://github.com/Kiranism) (dashboard shell, shadcn/ui setup, auth scaffolding) — since substantially extended with the extraction pipeline, chat assistant, and review UI described above.

## 📄 License

[ISC](LICENSE) — see the [LICENSE](LICENSE) file for the full text.

## 👤 About the Author

Built by **Ahmed Bashir** — a full-stack engineer working across TypeScript, React, and Node.js, currently based in Bielefeld, Germany, and studying Intelligent Interactive Systems (AI/NLP focus) at Bielefeld University.

This repo is the most complete example of how I think about shipping AI-agent features: type safety at the boundary, a human in the loop on anything destructive, and a habit of finding and fixing my own gaps — the PDF rasterization fallback, the CI pipeline, and the license/tooling cleanup in this README were all things I audited into existence, not things that were asked for line by line.

- GitHub: [github.com/m-ahmedbashir](https://github.com/m-ahmedbashir)
- LinkedIn: [linkedin.com/in/ahmed-bashir-2118651aa](https://www.linkedin.com/in/ahmed-bashir-2118651aa/)

Questions, feedback, or a role you think this'd be a good fit for — open an issue, or reach out directly.

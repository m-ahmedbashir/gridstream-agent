# Unstructured-to-Ops Action Agent

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg)
![pnpm](https://img.shields.io/badge/pnpm-%3E%3D%2010.0.0-orange.svg)
![TypeScript](https://img.shields.io/badge/typescript-latest-blue.svg)

## Overview

**Unstructured-to-Ops Action Agent** is a production-ready, multimodal "Buffer Agent" that bridges the gap between unstructured, messy real-world data and structured database systems. Instead of being just another conversational chatbot, this agent actively solves the massive bottleneck of manual data entry by extracting, validating, and preparing data for CRM or database ingestion with a **Human-In-The-Loop (HITL)** governance layer.

Whether the input is a WhatsApp screenshot of an invoice, a rambling email, or a handwritten to-do list, this agent processes the "business reality" and guarantees 100% type-safe data extraction using **Gemini 3 Flash**, the **Vercel AI SDK**, and **Zod**.

This repository is structured as a monorepo containing a **Next.js frontend** and a **NestJS backend**, managed with `pnpm` and Turborepo.

---

## 🚀 Features (Current & Upcoming)

### 🟢 Current Features
- **Multimodal Data Extraction:** Ingest messy formats like images, screenshots, and text emails simultaneously.
- **Vercel AI SDK Integration:** Utilizes `generateObject` with Gemini 3 Flash to systematically extract high-volume data quickly and affordably.
- **100% Type-Safe Validation:** Employs **Zod** schemas (e.g., `InvoiceSchema`) to serve as strict guardrails, ensuring that AI-extracted data perfectly matches the required database structure, eliminating hallucination risks.
- **Human-In-The-Loop (HITL) Review Dashboard:** A split-screen UI (built with Tailwind & shadcn/ui) displaying the original messy source alongside the extracted, structured data.
- **Deferred Database Transactions:** Uses the Vercel AI SDK's `needsApproval` flag to pause execution, requiring a human operator to click "Approve" or "Edit" on a Review Card before any data hits the primary database.
- **Strict Separation of Concerns:** Monorepo architecture sharing validation schemas across the full stack to ensure API contract integrity.

### 🟡 Upcoming Features
- **Expanded Schema Abstractions:** Supporting more generic business data types beyond invoices (e.g., employee onboarding forms, maintenance reports).
- **Automated Retries & Confidence Scoring:** Automatically flagging low-confidence extractions for human review while auto-approving high-confidence results.
- **Direct CRM Integrations:** Out-of-the-box actions to push approved data directly to Salesforce, HubSpot, or custom external APIs.

---

## 🏗 Architecture

The project is structured as a `pnpm` workspace:

```text
opp-agent/
├── apps/
│   ├── frontend/       # Next.js web application (HITL UI, Review Cards, shadcn/ui)
│   └── backend/        # NestJS API application (Vercel AI SDK Tool execution)
├── packages/           # Shared libraries
│   └── shared/         # Shared TypeScript definitions, Zod schemas
└── shared/             # General monorepo configurations
```

---

## 🛠 Tech Stack

- **Core AI:** Vercel AI SDK 6, Google Gemini 3 Flash
- **Frontend:** [Next.js](https://nextjs.org/) (React), Tailwind CSS, shadcn/ui
- **Backend:** [NestJS](https://nestjs.com/)
- **Workspaces/Tooling:** [pnpm](https://pnpm.io/)
- **Validation:** Zod schemas
- **Deployment:** Vercel (Frontend) & Railway (Backend)

---

## ⚙️ Getting Started

Follow these steps to set up the project locally for development.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/installation) (v10+ recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/m-ahmedbashir/opp-agent.git
   cd opp-agent
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

### Environment Variables

Before running the application, you need to set up the necessary environment variables. Example parameter files (`.env.example`) have been provided in both application directories.

**Frontend (`apps/frontend/.env`):**
Navigate to the `apps/frontend` directory and copy the example file:
```bash
cd apps/frontend
cp .env.example .env
```
*(Leave Clerk keys empty to use Clerk's keyless dev mode, or populate them from your Clerk Dashboard.)*

**Backend (`apps/backend/.env`):**
Navigate to the `apps/backend` directory and copy the example file:
```bash
cd apps/backend
cp .env.example .env
```
*(You will need to add your `GOOGLE_GENERATIVE_AI_API_KEY` to this file for the AI extraction to work.)*

### Running Locally

- **Start both applications setup in Turborepo:**
  ```bash
  pnpm dev
  ```

- **Start apps individually:**
  ```bash
  pnpm dev:frontend
  pnpm dev:backend
  ```

---

## 🧑‍💻 The Magic inside the Code

The core intelligence workflow operates around the Vercel AI SDK's structure to enforce types. Here's demonstrating the "Action Agent" capability:

```typescript
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Zod Schema guaranteeing output structure
const InvoiceSchema = z.object({
  vendor: z.string(),
  totalAmount: z.number(),
  // ... nested attributes
});

// Using Gemini + Vercel AI SDK
export async function processInvoice(imageAsBase64: string) {
  const { object } = await generateObject({
    model: google('gemini-1.5-flash'), // Fast multimodal extraction
    schema: InvoiceSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract data into structured format.' },
          { type: 'image', image: imageAsBase64 },
        ],
      },
    ],
  });
  return object; 
}
```

Coupled with the HitL mechanism on the backend:
```typescript
const processDataTool = tool({
  description: 'Saves extracted data to the database',
  parameters: InvoiceSchema,
  needsApproval: true, // Requires human approval from the dashboard
  execute: async (data) => {
    await db.insert(data);
    return { status: 'success' };
  },
});
```

---

## 🚀 Deployment

- **Frontend (Vercel):** Continuous Integration directly from the `main` branch. 
  - *Build Command:* `pnpm build --filter=frontend`
- **Backend (Railway):** Automated API hosting. 
  - *Build Command:* `pnpm build --filter=backend`

---

## 📞 Support and Contributions

For questions or to report a bug, please create an Issue within the repository!

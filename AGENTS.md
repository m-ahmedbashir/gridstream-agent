# Ops Agent - Instructions

## Setup
- Install: `pnpm install`
- Run Dev: `pnpm dev` (Runs both NestJS and Next.js via Turbo)

## Core Conventions
- Validation: Every tool call must be validated against `InvoiceSchema` in `@opp/shared`.
- HITL UI: The frontend components for human review are in `apps/frontend/components/review`.

## Deployment
- Backend: Deploys to Railway via `pnpm build --filter=backend`.
- Frontend: Deploys to Vercel via `pnpm build --filter=frontend`.
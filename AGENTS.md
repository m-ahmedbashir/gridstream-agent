# Ops Agent - Instructions

## Setup
- Install: `pnpm install`
- Run Dev: `pnpm dev` (Runs both NestJS and Next.js via Turbo)

## Core Conventions
- Validation: Every tool call must be validated against shared Zod schemas in `@maintain/shared`.
- HITL UI: The frontend components for human review are in `apps/web/components/review`.

## Deployment
- Backend: Deploys to Railway via `pnpm build --filter=@maintain/backend`.
- Frontend: Deploys to Vercel via `pnpm build --filter=@maintain/frontend`.
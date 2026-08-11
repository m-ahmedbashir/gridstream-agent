# AGENTS.md

Instructions for any AI coding agent working in this repository. Read before touching code. If this conflicts with what you observe in the repo, the repo wins — update this file, don't silently ignore it.

Standing rules — apply to every future file. For what's actually built and verified right now, and which pivot stage the codebase is in, see [REFACTOR_PROGRESS.md](./REFACTOR_PROGRESS.md); don't assume something exists just because a rule here describes how it _should_ behave once the pivot lands.

## What this is

`gridstream-agent` (mid-pivot from `maintain-agent`) — pnpm + Turborepo monorepo. NestJS API (`apps/api`) + Next.js dashboard (`apps/web`), sharing Zod domain schemas via `packages/shared` (renaming to `packages/ai-config`/`@repo/ai-config` in Stage 2, see REFACTOR_PROGRESS.md). Prisma + PostgreSQL is the only persistence layer — no Drizzle, no Redis/BullMQ yet (Stage 4 introduces the queue).

Being refactored, stage by stage, from an industrial-maintenance report planner into an event-driven IoT telemetry / Virtual Power Plant diagnostic pipeline (solar, battery storage, heat pumps, EV wallboxes). Until that pivot completes, most business logic below still describes the *maintenance* domain (`MachineProfile`/`Measure`/`ProjectPlan`) — check REFACTOR_PROGRESS.md's stage table before assuming a VPP concept (`DeviceAsset`, `TelemetryLog`, `FaultDiagnostic`) exists yet.

## Ground rule: don't scaffold ahead of the current stage

The pivot plan is explicitly staged (Stage 1 audit → Stage 2 renaming → Stage 3 schema → Stage 4 ingestion/queue → Stage 5 AI agent → Stage 6 dashboard → Stage 7 docs/cleanup), and each stage must typecheck/build clean before the next starts.

- Don't build a later stage's plumbing "while you're in there" — e.g. don't add BullMQ (Stage 4) while still doing Stage 2 renames, don't invent `DeviceAsset` (Stage 3) before the Prisma migration for it exists.
- Check REFACTOR_PROGRESS.md's status table before adding a new module — if a stage is marked not started, its target files don't exist yet; don't half-build them early.
- Verify what you built actually runs (`pnpm typecheck`, and for backend/frontend changes, boot the relevant app) before moving on.

## Structure

```
apps/api/                  NestJS backend (deployed to Railway)
  src/modules/<feature>/     one module per feature: *.controller.ts, *.module.ts, *.service.ts
  src/common/                 cross-cutting: prisma client, BYOK crypto
  prisma/schema.prisma        single source of truth for DB shape; prisma/migrations/ is append-only

apps/web/                  Next.js 16 App Router frontend (deployed to Vercel)
  src/app/                    routes (App Router, incl. parallel routes under dashboard/overview)
  src/features/<feature>/     feature-scoped components + TanStack Query hooks (use-*.ts)
  src/components/ui/          shadcn/ui primitives — extend, don't hand-edit
  __CLEANUP__/                 leftover starter-template feature-flag stripper, unrelated to this app's domain; candidate for deletion in Stage 7

packages/shared/            Zod domain schemas + types, imported by both apps as `@maintain/shared`
  src/schemas/                 e.g. maintenance.schema.ts (current), will gain VPP schemas in Stage 3
```

Rules from this layout:

- `packages/shared` never imports from `apps/api` or `apps/web` — it's plain Zod/TS, must stay usable from either app or a script.
- A domain type is defined once, in `packages/shared`, and inferred everywhere else via `z.infer<typeof Schema>` — never hand-write a duplicate interface in `apps/api` or `apps/web`.
- Prisma's `schema.prisma` is the only place table shapes are defined; a service reads/writes through `PrismaService`, never raw SQL, unless a migration genuinely needs it.

## Type safety

- Never hand-write a type duplicating a Prisma model or a `packages/shared` Zod schema — derive it (`z.infer<typeof X>`, or Prisma's generated `Prisma.XGetPayload<...>` for a query result shape).
- New request/response schemas go in `packages/shared/src/schemas/`, not inline in a controller — both apps need them, and inline duplicates drift.

## AI SDK usage (Vercel AI SDK)

- Model access goes through the provider-agnostic registry (`apps/api/src/modules/extraction/model-registry.ts`) — a keyed map of provider/model/vision-capability, resolved via `resolveModel(key, apiKeyOverride?)`. Add a new model by adding a registry entry, never by hardcoding a provider SDK call in a service.
- **Current pattern (pre-Stage-5): `generateText()` + hand-rolled JSON extraction/repair, validated against a Zod schema after the fact** (see `MaintenanceExtractionService.callModel()`, `PlanningService.generatePlan()`). This is a known deviation from the target pattern below — don't copy it into new code without checking whether Stage 5 has landed yet.
- **Target pattern (Stage 5 onward): `generateObject()`/`tool()` bound directly to a Zod schema** — no manual JSON parsing, no hallucination-prone free-text financial figures. All financial estimates and hardware-threshold evaluations must be computed deterministically in TypeScript, never asked of the model; the model's role is strictly qualitative diagnostics + tool-execution loops.
- BYOK: a user's own provider API key, AES-256-GCM encrypted at rest (`apps/api/src/common/crypto/`), decrypted only at call time and never logged — see `UsersService.getDecryptedApiKey`.

## Auth

Clerk, on the frontend (`apps/web`) only — no backend session/RBAC system, no Postgres RLS. The backend trusts a `userId`/`clerkId` passed from the frontend and upserts a `User` row on first sight (see `MaintenanceController.listMachines`'s `prisma.user.upsert` pattern) rather than validating a session itself. If backend-side auth verification is ever added, it doesn't exist yet — don't assume a guard or middleware is already enforcing it.

## Environment & running things

- Package manager is **pnpm** (`pnpm@10.30.3`) — don't use npm/yarn.
- `pnpm dev` (root) runs both apps in parallel via Turborepo. `pnpm --filter @maintain/backend dev` / `pnpm --filter @maintain/frontend dev` run one at a time. (Package *names* are still `@maintain/backend`/`@maintain/frontend` — only the `apps/api`/`apps/web` directory paths were renamed so far; renaming the package names themselves is a separate, not-yet-made decision, see REFACTOR_PROGRESS.md.)
- Backend env: `apps/api/.env` (copy from `apps/api/.env.example`) — needs at minimum `DATABASE_URL` and one model provider key (`OPENROUTER_API_KEY` is the free default).
- Frontend env: `apps/web/.env` (copy from `apps/web/env.example.txt`) — Clerk keys optional in dev (keyless mode).
- `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint` (root) all fan out via Turborepo to every package — run these, not a per-package script, when verifying a cross-cutting change.

## Deployment

- Backend: Railway, via `pnpm build --filter=@maintain/backend`.
- Frontend: Vercel, via `pnpm build --filter=@maintain/frontend`.
- If Railway/Vercel dashboard "root directory" settings still point at the pre-rename `apps/backend`/`apps/frontend` paths, that's a manual dashboard fix outside this repo — not something a migration here can reach.

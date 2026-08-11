# AGENTS.md

Instructions for any AI coding agent working in this repository. Read before touching code. If this conflicts with what you observe in the repo, the repo wins — update this file, don't silently ignore it.

## What this is

`gridstream-agent` — pnpm + Turborepo monorepo. NestJS API (`apps/api`) + Next.js 16 dashboard (`apps/web`), sharing Zod domain schemas via `packages/shared` (`@maintain/shared`). Prisma + PostgreSQL is the only persistence layer.

The domain currently implemented is industrial maintenance-report planning: a technician uploads a report, the AI SDK extracts a structured `MachineProfile`, a matching service proposes `Measure`s, and a planning service produces an ROI-backed `ProjectPlan` that a human approves/rejects (HITL). See `goal.md` and `README.md` for the full product framing.

## Architecture & SOLID principles

- **Delivery layer** (`apps/api/src/modules/*/*.controller.ts`, `apps/web/src/app/**`) — receive the request, validate shape, call a service, shape the response. No business logic in a controller or a page component.
- **Domain/business logic** (`apps/api/src/modules/*/*.service.ts`) — the actual rules (extraction, matching, financial math). Framework-agnostic where possible; a service takes plain data in, returns plain data out.
- **Infrastructure** (`apps/api/src/common/prisma/`, `apps/api/src/common/crypto/`, `packages/shared`) — DB client, encryption, and the Zod schemas both apps depend on.

SOLID at the file level, as you write, not as a retrofit:

- **SRP** — a controller routes, a service holds business logic, a `*.service.spec.ts` tests it. `MaintenanceController` (`apps/api/src/modules/maintenance/maintenance.controller.ts`) delegates every real decision to `MaintenanceExtractionService`/`MatchingService`/`PlanningService` — it never computes anything itself. Two reasons to change in one file means split it.
- **OCP** — a new feature is a new module (`*.controller.ts` + `*.module.ts` + `*.service.ts`), not an edit inside an unrelated one. Registering the new module in `app.module.ts`'s `imports` array is the accepted one-line exception.
- **LSP** — the model-provider abstraction (`apps/api/src/modules/extraction/model-registry.ts`) is the reference: `resolveModel(key, apiKeyOverride?)` returns a `LanguageModel` regardless of whether the key resolves to Groq, OpenAI, Anthropic, or OpenRouter — callers never branch on provider. Don't bake a single-provider assumption into a service that's meant to work with any registry entry.
- **ISP** — request DTOs are precise per-endpoint, never one shared blob. `maintenance.controller.ts` defines `ExtractMaintenanceDto`, `CreateMachineDto`, and `GeneratePlanDto` as separate small classes rather than one `MaintenanceRequestDto` with mostly-unused optional fields — follow that shape for new endpoints.
- **DIP** — NestJS constructor injection throughout; a service depends on `PrismaService`/other injected services, never `new`s up its own collaborator. Accepted exception: `model-registry.ts`'s `resolveModel`/`getModelDescriptor` are plain exported functions, not injectable services — fine, since they're pure (registry lookup) or read only `process.env` at call time, with no state and no side effect worth mocking in tests.

**Resilience convention — optional external calls must never throw.** Any call to a third-party API that's *decorative* (i.e. the app has a well-defined fallback if it's unavailable) returns `null`/`[]` on any failure and logs a warning instead of propagating — never let it break the request it's enriching. `CarbonIntensityService.getLatest()` (returns `null` if the token is missing, the request fails, or the shape is wrong) and `ThingSpeakDemoFeedService.fetchRecent()` (returns `[]` on any failure) are the two reference implementations; follow this shape for any new "nice-to-have" data source. This is different from a *required* external call (e.g. the model provider call in `MaintenanceExtractionService.callModel()`), which does propagate its error — because there's no meaningful fallback for "the extraction failed."

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
  __CLEANUP__/                 leftover starter-template feature-flag stripper, unrelated to this app's domain

packages/shared/            Zod domain schemas + types, imported by both apps as `@maintain/shared`
  src/schemas/                 maintenance.schema.ts, document-response.schema.ts
```

Rules from this layout:

- `packages/shared` never imports from `apps/api` or `apps/web` — it's plain Zod/TS, must stay usable from either app or a script.
- A domain type is defined once, in `packages/shared`, and inferred everywhere else via `z.infer<typeof Schema>` — never hand-write a duplicate interface in `apps/api` or `apps/web`.
- Prisma's `schema.prisma` is the only place table shapes are defined; a service reads/writes through `PrismaService`, never raw SQL, unless a migration genuinely needs it.

## Type safety & single source of truth for schemas

A shape gets defined **once**, in `packages/shared`, and both apps import that same definition — never redeclared per-consumer. Concretely:

- **Define once:** a new request or response shape is a Zod schema added to `packages/shared/src/schemas/`, exported from `packages/shared/src/index.ts`. Not inline in a controller, not inline in a frontend hook.
- **Backend reuses it for everything:** the same schema validates the incoming request, binds the AI SDK call (`generateObject`/`buildResponseSchema`), and — via `z.infer<typeof Schema>` — becomes the service's parameter/return type. One definition, three jobs, never three separate hand-written types that can drift apart.
- **Frontend reuses the identical import:** a TanStack Query hook's return type is `z.infer<typeof Schema>` imported from `@maintain/shared`, not a hand-typed `interface` that happens to look the same today. If the shape also needs client-side form validation, pass the same schema straight to `zodResolver()` (already a dependency) instead of writing a parallel Yup/manual-validation version.
- **Known violation to not repeat:** `apps/web/src/features/maintenance/use-extract-maintenance.ts:6-21` hand-declares a local `MaintenanceExtractionResult` interface that duplicates the shape `MaintenanceExtractionService` already returns from the backend (`apps/api/src/modules/maintenance/maintenance-extraction.service.ts`). It should be one Zod schema in `packages/shared`, imported on both sides. Don't copy this pattern into new code; fix it in place if you're touching that file anyway.
- Never hand-write a type duplicating a Prisma model either — derive it (`Prisma.XGetPayload<...>` for a query-result shape).

## AI SDK usage (Vercel AI SDK)

- Model access goes through the provider-agnostic registry (`apps/api/src/modules/extraction/model-registry.ts`) — a keyed map of provider/model/vision-capability, resolved via `resolveModel(key, apiKeyOverride?)`. Add a new model by adding a registry entry, never by hardcoding a provider SDK call in a service.
- Current extraction/planning code uses `generateText()` plus hand-rolled JSON extraction/repair (`extractJson`, `repairModelResponse` in `MaintenanceExtractionService`), validated against a Zod schema after the fact. For new AI-calling code, prefer `generateObject()`/`tool()` bound directly to a Zod schema instead — no manual JSON parsing, and it removes an entire class of malformed-response bugs the repair logic exists to patch around.
- All financial estimates and numeric thresholds must be computed deterministically in TypeScript (see `PlanningService.generatePlan` — investment/savings/payback are summed from `Measure` rows, the model only ever writes the prose executive summary around numbers it's given, never numbers of its own). Never let the model produce a number that gets persisted or shown as fact.
- BYOK: a user's own provider API key, AES-256-GCM encrypted at rest (`apps/api/src/common/crypto/`), decrypted only at call time and never logged — see `UsersService.getDecryptedApiKey`.

## Auth

Clerk, on the frontend (`apps/web`) only — no backend session/RBAC system, no Postgres RLS. The backend trusts a `userId`/`clerkId` passed from the frontend and upserts a `User` row on first sight (see `MaintenanceController.listMachines`'s `prisma.user.upsert` pattern) rather than validating a session itself. Don't assume a guard or middleware is enforcing auth on the backend — none exists yet.

## Environment & running things

- Package manager is **pnpm** (`pnpm@10.30.3`) — don't use npm/yarn.
- `pnpm dev` (root) runs both apps in parallel via Turborepo. `pnpm --filter @maintain/backend dev` / `pnpm --filter @maintain/frontend dev` run one at a time.
- Backend env: `apps/api/.env` (copy from `apps/api/.env.example`) — needs at minimum `DATABASE_URL` and one model provider key (`OPENROUTER_API_KEY` is the free default).
- Frontend env: `apps/web/.env` (copy from `apps/web/env.example.txt`) — Clerk keys optional in dev (keyless mode).
- `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint` (root) all fan out via Turborepo to every package — run these, not a per-package script, when verifying a cross-cutting change.

## Deployment

- Backend: Railway, via `pnpm build --filter=@maintain/backend`.
- Frontend: Vercel, via `pnpm build --filter=@maintain/frontend`.

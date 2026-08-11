# AGENTS.md

Instructions for any AI coding agent working in this repository. Read before touching code. If this conflicts with what you observe in the repo, the repo wins — update this file, don't silently ignore it.

## What this is

`gridstream-agent` — pnpm + Turborepo monorepo. NestJS API (`apps/api`) + Next.js 16 dashboard (`apps/web`), sharing Zod schemas via `packages/shared` (`@maintain/shared`). PostgreSQL is the persistence layer.

Domain: an event-driven IoT telemetry / Virtual Power Plant (VPP) diagnostic pipeline for green-tech energy assets (solar, battery, heat pumps, EV wallboxes). See `REFACTOR_PROGRESS.md` for what's built so far and what's next.

What's already load-bearing: the provider-agnostic AI model registry (`apps/api/src/modules/extraction/model-registry.ts`), Clerk-linked user settings incl. BYOK (`apps/api/src/modules/users/`), BYOK encryption (`apps/api/src/common/crypto/`).

## Architecture & SOLID principles

- **Delivery layer** (`apps/api/src/modules/*/*.controller.ts`, `apps/web/src/app/**`) — receive the request, validate shape, call a service, shape the response. No business logic in a controller or a page component.
- **Domain/business logic** (`apps/api/src/modules/*/*.service.ts`) — the actual rules. Framework-agnostic where possible; a service takes plain data in, returns plain data out.
- **Infrastructure** (`apps/api/src/common/`, `packages/shared`) — DB client, encryption, and the Zod schemas both apps depend on.

SOLID at the file level, as you write, not as a retrofit:

- **SRP** — a controller routes, a service holds business logic, a `*.service.spec.ts` tests it. `UsersController` (`apps/api/src/modules/users/users.controller.ts`) delegates every real decision to `UsersService` — it never computes anything itself. Two reasons to change in one file means split it.
- **OCP** — a new feature is a new module (`*.controller.ts` + `*.module.ts` + `*.service.ts`), not an edit inside an unrelated one. Registering the new module in `app.module.ts`'s `imports` array is the accepted one-line exception.
- **LSP** — the model-provider abstraction (`apps/api/src/modules/extraction/model-registry.ts`) is the reference: `resolveModel(key, apiKeyOverride?)` returns a `LanguageModel` regardless of whether the key resolves to Groq, OpenAI, Anthropic, or OpenRouter — callers never branch on provider. Don't bake a single-provider assumption into a service meant to work with any registry entry.
- **ISP** — request DTOs are precise per-endpoint, never one shared blob. A small, endpoint-specific interface, not one bloated request type with mostly-unused optional fields.
- **DIP** — NestJS constructor injection throughout; a service depends on injected services, never `new`s up its own collaborator. Accepted exception: `model-registry.ts`'s `resolveModel`/`getModelDescriptor` are plain exported functions, not injectable services — fine, since they're pure or read only `process.env` at call time, with no state worth mocking.

**Resilience convention — optional external calls must never throw.** A call to a third-party API that's *decorative* (the app has a well-defined fallback if it's unavailable) returns `null`/`[]` on failure and logs a warning, never propagates. A *required* call (e.g. the model provider call behind `resolveModel()`) does propagate its error — there's no meaningful fallback for "the call failed."

## Adding a new feature — minimal footprint

- Extending an existing module needs zero new files — add a method to the existing service + a route to the existing controller.
- A genuinely new domain concern gets exactly three files: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts` (plus a `.spec.ts` alongside the service). Nothing else by default — no repository class wrapping the DB client (the client already is the repository), no interface file duplicating the service's own public signatures, no DTO file separate from the controller when the DTO is only used by that one controller (small DTOs stay inline as classes at the top of the controller file).
- Split further only when a real second reason to change appears (SRP) — not preemptively.

## Type safety & single source of truth for schemas

A shape gets defined **once**, in `packages/shared`, and both apps import that same definition — never redeclared per-consumer.

- **Define once:** a new request or response shape is a Zod schema added to `packages/shared/src/schemas/`, exported from `packages/shared/src/index.ts`. Not inline in a controller, not inline in a frontend hook.
- **Backend reuses it for everything:** the same schema validates the incoming request, binds the AI SDK call (`generateObject`), and — via `z.infer<typeof Schema>` — becomes the service's parameter/return type. One definition, three jobs.
- **Frontend reuses the identical import:** a TanStack Query hook's return type is `z.infer<typeof Schema>` imported from `@maintain/shared`, not a hand-typed `interface` that happens to look the same today. If the shape also needs client-side form validation, pass the same schema straight to `zodResolver()` instead of writing a parallel validation version.
- Never hand-write a type duplicating a DB row shape either — derive it from the schema/ORM, don't redeclare it.

## AI SDK usage (Vercel AI SDK)

- Model access goes through the provider-agnostic registry (`apps/api/src/modules/extraction/model-registry.ts`) — a keyed map of provider/model/vision-capability, resolved via `resolveModel(key, apiKeyOverride?)`. Add a new model by adding a registry entry, never by hardcoding a provider SDK call in a service.
- Use `generateObject()`/`tool()` bound directly to a Zod schema — never `generateText()` plus hand-rolled JSON parsing. No manual JSON parsing, no malformed-response repair logic.
- All financial/numeric estimates that get persisted or shown as fact must be computed deterministically in TypeScript, never left to the model — the model writes prose around numbers it's given, not numbers of its own.
- BYOK: a user's own provider API key, AES-256-GCM encrypted at rest (`apps/api/src/common/crypto/`), decrypted only at call time and never logged — see `UsersService.getDecryptedApiKey`.

## Auth

Clerk, on the frontend (`apps/web`) only — no backend session/RBAC system, no Postgres RLS. The backend trusts a `userId`/`clerkId` passed from the frontend and upserts a `User` row on first sight rather than validating a session itself. Don't assume a guard or middleware is enforcing auth on the backend — none exists yet.

## Environment & running things

- Package manager is **pnpm** (`pnpm@10.30.3`) — don't use npm/yarn.
- `pnpm dev` (root) runs both apps in parallel via Turborepo. `pnpm --filter @maintain/backend dev` / `pnpm --filter @maintain/frontend dev` run one at a time.
- Backend env: `apps/api/.env` (copy from `apps/api/.env.example`) — needs at minimum `DATABASE_URL` and one model provider key (`OPENROUTER_API_KEY` is the free default).
- Frontend env: `apps/web/.env` (copy from `apps/web/env.example.txt`) — Clerk keys optional in dev (keyless mode).
- `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint` (root) all fan out via Turborepo to every package — run these, not a per-package script, when verifying a cross-cutting change.

## Deployment

- Backend: Railway, via `pnpm build --filter=@maintain/backend`.
- Frontend: Vercel, via `pnpm build --filter=@maintain/frontend`.

# AGENTS.md

Instructions for any AI coding agent working in this repository. Read before touching code. If this conflicts with what you observe in the repo, the repo wins — update this file, don't silently ignore it.

## What this is

`gridstream-agent` — pnpm + Turborepo monorepo. NestJS API (`apps/api`) + Next.js 16 dashboard (`apps/web`), sharing Zod schemas via `packages/shared` (`@gridstream/shared`) and AI model config via `packages/ai-config` (`@gridstream/ai-config`). PostgreSQL is the persistence layer, accessed via Drizzle ORM (`drizzle-orm` + `pg`). Redis + BullMQ back the telemetry-ingestion queue.

Domain: an event-driven IoT telemetry / Virtual Power Plant (VPP) diagnostic pipeline for green-tech energy assets (solar, battery, heat pumps, EV wallboxes). See `REFACTOR_PROGRESS.md` for build history and what's next — this file only states current rules, not status.

## Architecture & SOLID principles

- **Delivery layer** (`apps/api/src/modules/*/*.controller.ts`, `apps/web/src/app/**`) — receive the request, validate shape, call a service, shape the response. No business logic in a controller or a page component.
- **Domain/business logic** (`apps/api/src/modules/*/*.service.ts`) — the actual rules. Framework-agnostic where possible; a service takes plain data in, returns plain data out.
- **Infrastructure** (`apps/api/src/common/`, `packages/shared`) — DB client, encryption, and the Zod schemas both apps depend on.

SOLID at the file level, as you write, not as a retrofit:

- **SRP** — a controller routes, a service holds business logic, a `*.service.spec.ts` tests it. `UsersController` (`apps/api/src/modules/users/users.controller.ts`) delegates every real decision to `UsersService` — it never computes anything itself. Two reasons to change in one file means split it.
- **OCP** — a new feature is a new module (`*.controller.ts` + `*.module.ts` + `*.service.ts`), not an edit inside an unrelated one. Registering the new module in `app.module.ts`'s `imports` array is the accepted one-line exception.
- **LSP** — the model-provider abstraction (`packages/ai-config/src/model-registry.ts`) is the reference: `resolveModel(key, apiKeyOverride?)` returns a `LanguageModel` regardless of whether the key resolves to Groq, OpenAI, Anthropic, or OpenRouter — callers never branch on provider. Don't bake a single-provider assumption into a service meant to work with any registry entry.
- **ISP** — request DTOs are precise per-endpoint, never one shared blob. A small, endpoint-specific interface, not one bloated request type with mostly-unused optional fields.
- **DIP** — NestJS constructor injection throughout; a service depends on injected services, never `new`s up its own collaborator. Accepted exception: `model-registry.ts`'s `resolveModel`/`getModelDescriptor` are plain exported functions, not injectable services — fine, since they're pure or read only `process.env` at call time, with no state worth mocking.

**Resilience convention — optional external calls must never throw.** A call to a third-party API that's *decorative* (the app has a well-defined fallback if it's unavailable) returns `null`/`[]` on failure and logs a warning, never propagates. A *required* call (e.g. the model provider call behind `resolveModel()`) does propagate its error — there's no meaningful fallback for "the call failed."

## Structure

```
apps/api/                  NestJS backend (deployed to Railway)
  src/modules/<feature>/     one module per feature: *.controller.ts, *.module.ts, *.service.ts, tools/ (for an AI-calling feature — see "Building an AI feature")
  src/modules/telemetry-ingestion/  no controller — a producer/consumer pair, not an HTTP feature.
                                      telemetry-simulator.service.ts (producer, gated by TELEMETRY_SIMULATOR_ENABLED)
                                      + telemetry-queue.consumer.ts (BullMQ @Processor) + pure logic split into
                                      its own testable file per concern (telemetry-reading-generator.ts,
                                      telemetry-thresholds.ts) + ai-diagnostic-trigger.service.ts, which delegates
                                      to DiagnosticsModule (below)
  src/modules/diagnostics/          no controller either — triggered via DI from telemetry-ingestion, not HTTP.
                                      diagnostics.service.ts (generateText + tools + Output.object() for the
                                      final structured answer, see "Building an AI feature") + tools/get-
                                      historical-baseline.tool.ts (real DB aggregate query) + tools/get-
                                      hardware-manual.tool.ts (a clearly-documented stub knowledge base — no
                                      real manufacturer data behind it, same honesty as the telemetry simulator)
  src/common/db/              db.service.ts — pg Pool + Drizzle instance, bound to the table defs in packages/shared; never define a table here
  src/common/crypto/          BYOK AES-256-GCM encryption
  scripts/                    one-off scripts run via ts-node, outside the Nest DI graph (e.g. seed-devices.ts)
  drizzle.config.ts           drizzle-kit config — schema path points at packages/shared/src/db/schema.ts
  drizzle/                    generated SQL migrations — append-only, never hand-edit a committed one

apps/web/                  Next.js 16 App Router frontend (deployed to Vercel)
  src/app/                    routes (App Router, incl. parallel routes under dashboard/overview)
  src/app/api/chat/route.ts   the only AI-calling code in this app — a Route Handler (runs server-side in
                                Node, never the browser), resolves its model through @gridstream/ai-config
                                like any server-side AI call in either app
  src/features/<feature>/     feature-scoped components + TanStack Query hooks (use-*.ts)
  src/components/ui/          shadcn/ui primitives — extend, don't hand-edit
  __CLEANUP__/                 leftover starter-template feature-flag stripper, unrelated to this app's domain

packages/shared/            imported by both apps as `@gridstream/shared`
  src/db/schema.ts             THE single source of truth: Drizzle table defs + Zod schemas derived from
                                them via drizzle-zod (createSelectSchema/createInsertSchema) + inferred
                                types. apps/api imports the tables to bind its Drizzle instance; apps/web
                                imports only the derived Zod schemas/types, never the raw tables.
  src/schemas/                 hand-written Zod schemas for shapes that aren't 1:1 with a DB row (request/
                                response bodies, AI structured-output schemas) — land here as needed

packages/ai-config/         imported by both apps as `@gridstream/ai-config` — server-side callers only
  src/model-registry.ts        THE single source of truth for which models exist: MODEL_REGISTRY,
                                DEFAULT_MODEL_KEY, resolveModel(key, apiKeyOverride?). The only place a
                                provider SDK (@ai-sdk/groq/openai/anthropic) is imported, ever, in either
                                app. Deliberately a separate package from packages/shared, not folded into
                                it: packages/shared gets bundled into apps/web's browser build the moment a
                                component imports a derived type from it, and resolveModel() does server-
                                only things (dynamic import of provider SDKs, reads secret env vars) that
                                must never end up in client JS — see the rule below.
```

Rules from this layout:

- `packages/shared` never imports from `apps/api` or `apps/web` — it's plain Zod/TS/drizzle-orm's *schema-builder* (no `pg` driver, no DB connection), must stay usable from either app or a script, including a browser bundle.
- A domain type is defined once, in `packages/shared`, and inferred everywhere else via `z.infer<typeof Schema>` — never hand-write a duplicate interface.
- `packages/shared/src/db/schema.ts` is the only place table shapes are defined. Its Zod schemas are *derived* from the tables via drizzle-zod — never hand-written separately alongside them. `apps/api`'s `DbService` imports the table objects directly from `@gridstream/shared`; it never redefines a table locally. A service reads/writes through `DbService`'s Drizzle instance, never raw SQL, unless a migration genuinely needs it.
- Any `$defaultFn`/runtime code inside a table definition must work in both Node and a browser bundle (e.g. the global `crypto.randomUUID()`, not `import { randomUUID } from 'crypto'`) — this file is bundled into `apps/web` the moment it imports a derived type from it.
- `packages/ai-config` is imported only from server-side code — a NestJS service, a Next.js Route Handler — never from a client component or a hook. Unlike `packages/shared`, it isn't meant to be browser-safe: `resolveModel()` reads secret provider env vars and dynamically imports server-only provider SDKs.

## Adding a new feature — minimal footprint

- Extending an existing module needs zero new files — add a method to the existing service + a route to the existing controller.
- A genuinely new domain concern gets exactly three files: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts` (plus a `.spec.ts` alongside the service). Nothing else by default — no repository class wrapping the DB client (the client already is the repository), no interface file duplicating the service's own public signatures, no DTO file separate from the controller when the DTO is only used by that one controller (small DTOs stay inline as classes at the top of the controller file).
- Split further only when a real second reason to change appears (SRP) — not preemptively.

## Type safety & single source of truth for schemas

A shape gets defined **once**, in `packages/shared`, and both apps import that same definition — never redeclared per-consumer.

- **Database rows:** `packages/shared/src/db/schema.ts` defines the Drizzle table; its Zod schema is *derived* from that table via `drizzle-zod`'s `createSelectSchema()`/`createInsertSchema()` — never hand-written separately. One definition (the table) cascades to the migration, the derived Zod schema, and every `z.infer<>` type both apps use. Adding a column means editing the table once — the Zod schema and every inferred type update automatically.
- **Everything else** (a request/response shape that isn't 1:1 with a table row — an AI structured-output schema, a composite API response): a hand-written Zod schema added to `packages/shared/src/schemas/`, exported from `packages/shared/src/index.ts`. Not inline in a controller, not inline in a frontend hook.
- **Backend reuses it for everything:** the same schema validates the incoming request, binds the AI SDK call (`generateObject`), and — via `z.infer<typeof Schema>` — becomes the service's parameter/return type. One definition, three jobs.
- **Frontend reuses the identical import:** a TanStack Query hook's return type is `z.infer<typeof Schema>` imported from `@gridstream/shared`, not a hand-typed `interface` that happens to look the same today. If the shape also needs client-side form validation, pass the same schema straight to `zodResolver()` instead of writing a parallel validation version.
- Never hand-write a type duplicating a DB row shape — import the derived type (`DeviceAsset`, `NewFaultDiagnostic`, etc.) from `@gridstream/shared` instead.

## Building an AI feature (Vercel AI SDK)

**Model access is centralized, permanently, across both apps.** `packages/ai-config/src/model-registry.ts` is the *only* place a provider SDK (`@ai-sdk/groq`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) gets imported — imported as `@gridstream/ai-config` by any server-side code in either `apps/api` or `apps/web` (a NestJS service, a Next.js Route Handler; never client-side code, since it reads secret env vars and imports server-only packages). A feature resolves a model via `resolveModel(key, apiKeyOverride?)` — never imports a provider SDK itself, never hardcodes a model id or a provider's `baseURL`/client setup inline. Add a new model by adding a registry entry, not by writing a second provider client somewhere else — `apps/web`'s chat route and `apps/api`'s diagnostic agent both resolve through the exact same registry entry today, which is what this rule is for.

**Start with the simplest structure that solves the problem — add orchestration only when the task actually needs it.** Most features here are a single augmented call: a prompt, the relevant tools, and a Zod schema for the output. Reach for a multi-step agent loop only when the model genuinely has to decide *which* tools to call and in *what order* for an open-ended problem — not by default, and not because it looks more sophisticated. An unnecessary agent loop is just more surface area for the same job a single call would do.

**Folder shape for a new AI-calling feature module** (`apps/api/src/modules/<feature>/`) — reference implementation: `apps/api/src/modules/diagnostics/`:
```
<feature>.module.ts
<feature>.controller.ts        — HTTP surface, if the feature has one. diagnostics/ has none: it's
                                  triggered internally (telemetry-ingestion's AiDiagnosticTriggerService
                                  calls it via DI), not by a direct request — controller is optional,
                                  not a fixed part of the shape.
<feature>.service.ts           — orchestration: builds the prompt, calls generateObject()/generateText()+tool(),
                                  returns the validated result
<feature>.service.spec.ts      — mock the AI SDK call itself (jest.mock('ai'), keep tool()/stepCountIs/
                                  Output.object real, inert passthroughs), not just its inputs — see
                                  diagnostics.service.spec.ts
tools/
  <tool-name>.tool.ts           — one file per tool: a pure function + its own Zod input schema
  <tool-name>.tool.spec.ts      — tools are pure functions, trivially unit-testable without touching the LLM
```
The structured-output schema (what the model must return) and any request/response DTOs live in `packages/shared`, per the single-source-of-truth rule above — imported by both the service (to bind `generateObject`) and the frontend (to type whatever reads the result). Where the shape is a subset of an existing table (e.g. a diagnosis proposal is most of `FaultDiagnostic` minus the fields the service fills in deterministically), derive it with `.pick()` off the table's derived schema rather than writing a parallel one — see `diagnostics.service.ts`'s `diagnosisProposalSchema`.

**Rules that don't bend regardless of structure:**
- **No tool calls needed → `generateObject()`.** Single-shot structured extraction, bound directly to a Zod schema.
- **Tool calls needed → `generateText()` with `tools`, never `generateObject()`.** `generateObject()` has no tool-calling loop at all — it's single-shot only. If the model needs to investigate before answering (query a baseline, look something up), that's `generateText()` with `tools` and a bounded `stopWhen: stepCountIs(n)`.
- **A tool-calling loop that must end in a structured decision → pass `output: Output.object({ schema })` to `generateText()`, read `result.output`.** This is the SDK's native mechanism for "investigate freely via `tools`, then bind the final answer to a schema" — the model stops calling tools when it's ready, and the SDK validates that final response against `schema` instead of returning plain text. Accessing `result.output` throws `NoOutputGeneratedError` if the model never converges within `stopWhen`'s step limit — catch that specifically for a clear error, don't let it surface as an opaque failure. See `diagnostics.service.ts`. Never regex-extract a fenced JSON block from a `generateText()` response and hand-repair likely-malformed output — `Output.object()`'s validated result never needs parsing or repair, regardless of which function you're calling.
- Tools are the interface the model acts through — treat each one like a small public API: one clear job, an unambiguous name, a minimal, precisely-typed input schema. A vague or overloaded tool produces vague or wrong tool calls. If the calling service already knows a value definitively (e.g. which device this diagnosis is for), close over it when constructing the tool rather than asking the model to supply it — see `createGetHistoricalBaselineTool(dbService, deviceId)`.
- All financial/numeric estimates and pass/fail safety thresholds that get persisted or shown as fact must be computed deterministically in TypeScript, never left to the model — the model writes prose around numbers it's given, not numbers of its own.
- Any model output that would trigger a real-world consequence (a dispatch, an approval, an irreversible write) is a human-in-the-loop checkpoint — persist it in a pending/awaiting-approval state and require an explicit human action before anything downstream acts on it. Never auto-execute off a raw model response. The status field is always set deterministically by the service (`'PENDING_APPROVAL'`), never taken from the model's output — see `diagnosisProposalSchema`'s `.pick()` explicitly excluding `status`.
- An autonomous, non-request-triggered AI call (a queue consumer, a cron job — anything not acting on behalf of a specific logged-in user) resolves the model via `DEFAULT_MODEL_KEY` with no BYOK override — there's no per-user key to use when nobody made the request.
- A failed AI call triggered from a queue job is typically a decorative-call failure (per the resilience convention above), not a required one — swallow it at the trigger boundary rather than letting the whole job fail and retry, *especially* if the job also does a non-idempotent write (a duplicate DB insert on retry is worse than a missing diagnosis) — see `AiDiagnosticTriggerService`.
- BYOK: a user's own provider API key, AES-256-GCM encrypted at rest (`apps/api/src/common/crypto/`), decrypted only at call time and never logged — see `UsersService.getDecryptedApiKey`.
- Any free-text/DB-backed field that gets interpolated into a prompt (a device's `location`, a user's saved name — anything not authored by this codebase) is untrusted data, not an instruction: wrap it in a clearly delimited block (e.g. `<device_data>...</device_data>`) and tell the model explicitly to treat its contents as data, never as commands — see `diagnostics.service.ts`'s `<device_data>` block.
- Model-authored free text that gets persisted and will eventually be shown to a human (e.g. `FaultDiagnostic.summary`/`recommendedAction`) is untrusted output, same as any other string a service didn't author itself: strip HTML-tag-like content before persisting it (see `diagnostics.service.ts`'s `stripHtmlLikeContent`), and when a UI renders it, render as plain text — never via `dangerouslySetInnerHTML` or an unsanitized markdown-to-HTML path.

## Auth

Clerk, on the frontend (`apps/web`) only — no backend session/RBAC system, no Postgres RLS. The backend trusts a `userId`/`clerkId` passed from the frontend and upserts a `User` row on first sight rather than validating a session itself. Don't assume a guard or middleware is enforcing auth on the backend — none exists yet.

## Environment & running things

- Package manager is **pnpm** (`pnpm@10.30.3`) — don't use npm/yarn.
- `pnpm dev` (root) runs both apps in parallel via Turborepo. `pnpm --filter @gridstream/api dev` / `pnpm --filter @gridstream/web dev` run one at a time.
- Backend env: `apps/api/.env` (copy from `apps/api/.env.example`) — needs at minimum `DATABASE_URL` and one model provider key (`OPENROUTER_API_KEY` is the free default).
- Frontend env: `apps/web/.env` (copy from `apps/web/env.example.txt`) — Clerk keys optional in dev (keyless mode).
- `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint` (root) all fan out via Turborepo to every package — run these, not a per-package script, when verifying a cross-cutting change.

## Deployment

- Backend: Railway, via `pnpm build --filter=@gridstream/api`.
- Frontend: Vercel, via `pnpm build --filter=@gridstream/web`.

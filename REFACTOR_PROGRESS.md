# Refactor Progress — maintain-agent → gridstream-agent

Tracks execution of the staged pivot from an industrial-maintenance planner to an
event-driven IoT telemetry / VPP diagnostic pipeline. One stage at a time; each
stage must compile/typecheck clean before the next begins.

## Status

| Stage | Description | Status |
|---|---|---|
| 1 | Codebase audit & mapping | ✅ Done |
| 2 | Monorepo workspace & package renaming | ✅ Done |
| 3 | Database & domain schema refactor (DeviceAsset/TelemetryLog/FaultDiagnostic) | ✅ Done, merged (PR #1) |
| 4 | NestJS ingestion, Redis/BullMQ queue, telemetry simulator | ✅ Done, merged (PR #2) |
| 5 | Vercel AI SDK diagnostic agent (generateText + tool calling) | ✅ Done, merged (PR #3) |
| 6 | Next.js VPP dashboard & HITL UI | ✅ Done |
| 7 | Documentation, cleanup, final CI verification | ✅ Done |

---

## Stage 1 — Audit & Mapping (this commit)

### Monorepo shape
- pnpm workspace: `apps/*`, `packages/*` + Turborepo (`turbo.json`: build/test/typecheck/lint/dev pipelines).
- Root package name: `maintain-agent`. Workspace packages: `@maintain/backend`, `@maintain/frontend`, `@maintain/shared`.
- `packageManager: pnpm@10.30.3`.

### Domain schemas — live in `packages/shared/src/`
- `schemas/maintenance.schema.ts` — `MachineProfileSchema`, `MeasureSchema`, `ProjectPlanSchema`, `MachineProfileConfidenceSchema`, `ProjectPlanConfidenceSchema`, plus `MachineType` / `Criticality` / `MeasureCategory` / `PlanStatus` / `MeasurePriority` enums.
- `schemas/document-response.schema.ts` — `buildResponseSchema(dataSchema, confidenceSchema)`, a generic wrapper `{ data, confidence, imagePiiDetected }` used for every `generateText`-then-validate call.
- Re-exported from `src/index.ts`.

### Database (`apps/backend/prisma/schema.prisma`, 11 migrations applied)
- `User` (Clerk-linked, model/BYOK/processing-mode prefs)
- `ExtractionLog` (pipeline telemetry: PII flags, OCR usage, confidence, timing)
- `MachineProfile` (the domain entity — will become `DeviceAsset`)
- `MachineReading` (metric/value/unit time series — will become `TelemetryLog`)
- `Measure` (best-practice catalog — retired, no VPP equivalent needed)
- `Plan` (ROI project plan — will become `FaultDiagnostic`)

### Backend modules (`apps/backend/src/modules/`)
| Module | Role | Fate |
|---|---|---|
| `compliance` | PII masking (emails/cards/IBANs/phones) before AI calls | Keep as-is |
| `extraction` | Provider-agnostic model registry (Groq/OpenAI/Anthropic/OpenRouter) + Tesseract OCR | Keep registry, drop OCR (no scanned reports in VPP flow) |
| `maintenance` | Core pipeline: `MaintenanceExtractionService`, `MatchingService`, `PlanningService`, `MaintenanceController` | Replaced by `ai-agent` (diagnostics) module in Stage 5 |
| `telemetry` | **Already exists.** Re-baselines a public ThingSpeak weather feed into fake per-machine temperature readings (`TelemetryService`, `ThingSpeakDemoFeedService`) | Superseded by the new `TelemetrySimulatorService` + BullMQ pipeline in Stage 4 |
| `carbon` | Electricity Maps grid carbon intensity, currently decorative context for plan prose | **Keep and elevate** — grid carbon intensity is directly on-theme for a VPP, not just decorative |
| `users` | Clerk-linked settings/BYOK | Keep as-is |

### AI SDK usage — important deviation from the target pattern
- `MaintenanceExtractionService.callModel()` and `PlanningService.generatePlan()` both use `generateText()` + hand-rolled JSON extraction (`extractJson`, `repairModelResponse`) validated *after the fact* against Zod schemas.
- **Not** using `generateObject()` or `tool()` anywhere today. Stage 5's "zero financial hallucination via generateObject + Zod" is a genuine pattern change, not a rename — budget real effort here, not a find-replace.
- Model registry (`extraction/model-registry.ts`) is solid and reusable as-is: keyed provider map, vision-capability flags, BYOK key override, timeout/retry handling.

### Frontend (`apps/frontend/src/`)
- Next.js 16 app router, Clerk auth, shadcn/ui, TanStack Query, Recharts already a dependency.
- Maintenance UI: `src/features/maintenance/*` (upload, measures, plan, plan-history, live-monitoring views) + routes under `src/app/dashboard/maintenance/*`.
- `src/app/api/chat/route.ts` — a Next.js-side streaming chat route (OpenRouter direct, not through the NestJS backend) with a maintain-agent-flavored system prompt and a prompt-injection refusal list. Needs a content/copy update in Stage 6/7, logic can stay.
- **Finding:** the `use-*.ts` hooks under `features/maintenance/` hardcode `http://localhost:3001` instead of reading an env var — worth fixing when those files are touched anyway, not blocking.
- `apps/frontend/__CLEANUP__/` is a leftover starter-template feature-flag stripper (clerk/kanban/sentry toggles), unrelated to this domain. Candidate for deletion in Stage 7, not touched now.

### Reusable without change
`ComplianceService`, BYOK AES-256-GCM encryption (`common/crypto/`), `PrismaModule`/`PrismaService`, Clerk auth wiring, model registry provider abstraction, `CarbonIntensityService`.

### Genuinely new infrastructure (not a refactor of existing code)
- Redis/BullMQ does not exist anywhere in the repo today — Stage 4's queue is net-new, including the `@nestjs/bullmq` dependency itself.

---

## Stage 2 — Monorepo Workspace & Package Renaming — ✅ Done

Completed incrementally across several turns rather than one pass; recorded here as
a single resolved entry.

- `package.json` (root): `maintain-agent` → `gridstream-agent`. ✅
- `apps/backend` → `apps/api`, `apps/frontend` → `apps/web` (pulled into Stage 1, see below). ✅
- `@maintain/backend` → `@gridstream/api`, `@maintain/frontend` → `@gridstream/web`,
  `@maintain/shared` → `@gridstream/shared`. ✅ (see the dated "Package renames" entry
  further down for the full file list and verification.)
- **Deliberate deviation from the original plan:** the plan called for renaming
  `packages/shared/` → `packages/ai-config/` (`@repo/ai-config`). Decision: don't —
  `packages/shared` stays as the general shared-code package (`@gridstream/shared`).
  A separate `packages/ai-config` may get created later *if* something concrete
  needs that split (e.g. AI-provider config/prompts/tool schemas that genuinely
  don't belong alongside general shared Zod types) — not speculatively now, per
  this repo's own "don't scaffold ahead of a real need" convention.
- Verified with `pnpm install && pnpm typecheck` at each step.

## Ahead of schedule — done during Stage 1 (at explicit request)

Two folder-level renames were pulled forward into Stage 1 rather than waiting for
Stage 2, since they don't touch package names/imports and were low-risk:

- `apps/backend/` → `apps/api/` (git history preserved via `git mv`).
- `apps/frontend/` → `apps/web/` (git history preserved via `git mv`).
- Updated path references in `AGENTS.md`, `CONTRIBUTING.md`, `README.md`.
- `packages/shared/dist/` and `packages/shared/tsconfig.tsbuildinfo` were tracked in
  git despite already being listed in `.gitignore` — untracked with `git rm --cached`
  (files remain on disk, just no longer versioned; future `tsc` output won't get
  re-added).
- `pnpm install` re-run to update lockfile importer paths (`pnpm-lock.yaml` keys
  workspace packages by relative path, so the rename alone would have left it stale).
- Verified: `pnpm typecheck` passes clean across all 3 packages post-rename.

**Not changed:** package `name` fields (`@maintain/backend`, `@maintain/frontend`,
`@maintain/shared`) are untouched — only directory paths moved. `pnpm --filter
@maintain/backend ...` commands in root `package.json` and `AGENTS.md` still work
as-is since pnpm filters resolve by package name, not path.

**Manual follow-up needed (outside this repo):** if Railway/Vercel dashboards have
a "root directory" setting pointing at `apps/backend` or `apps/frontend`, those need
updating by hand — that config lives in the platform dashboards, not in-repo.

---

## 2026-08-12 — Strict-minimalism cleanup of the old maintenance domain

Pulled forward, ahead of Stage 3-6, at explicit request: delete every module/feature
that exists only to serve the old maintenance-report-planning domain and isn't
load-bearing for the documented future stages (event-driven IoT telemetry / VPP
diagnostic pipeline). This is a deletion-only pass — no new VPP code was written,
and `apps/api/prisma/schema.prisma` / `prisma/migrations/` were deliberately left
untouched (that pivot is a separate, more deliberate future task — see Stage 3).

### Removed

**Backend (`apps/api/src/`)**
- `modules/maintenance/` (entire dir) — `MaintenanceController`, `MaintenanceExtractionService`,
  `MatchingService`, `PlanningService`, `seed-measures.ts`, all specs. Reason: this *is* the old
  domain; Stage 5's `ai-agent`/diagnostic module replaces it outright, nothing here is reusable
  scaffolding (the hand-rolled `generateText()` + JSON-repair pattern is explicitly the thing
  Stage 5 replaces with `generateObject()`/`tool()`).
- `modules/telemetry/` (entire dir) — `TelemetryController`, `TelemetryService`,
  `ThingSpeakDemoFeedService`. Reason: re-baselines a public weather feed into fake per-machine
  temperatures; fully superseded by the real `TelemetrySimulatorService` + BullMQ pipeline in
  Stage 4, not reusable as-is.
- `modules/compliance/` (entire dir) — `ComplianceService`, German-text PII masking
  (emails/IBANs/phones). Reason: nothing in the documented future stages processes free-text
  documents; no future stage references it.
- `modules/carbon/` (entire dir) — `CarbonIntensityService`, Electricity Maps lookup. Reason: not
  referenced by any documented future stage. Trivially resurrectable from git history
  (`git show <pre-cleanup-commit>:apps/api/src/modules/carbon/...`) if a later stage wants
  grid-carbon context for real.
- `modules/extraction/ocr.service.ts` + `apps/api/eng.traineddata` — Tesseract OCR, specific to
  scanned maintenance reports; no consumer left once `maintenance/` is gone.
- `tesseract.js` and `pdf-parse` removed from `apps/api/package.json` — confirmed via grep no
  remaining import anywhere in `apps/api/src` after the above deletions.
- `apps/api/test/fixtures/documents/*.txt` — confirmed unreferenced (the compliance/OCR specs that
  used them are gone too).

**Frontend (`apps/web/src/`)**
- `features/maintenance/` and `app/dashboard/maintenance/` (history/live/measures/plan routes).
- `features/extraction-settings/` and `app/dashboard/extraction-settings/`.
- `src/config/nav-config.ts` — removed the "Maintenance" and "Settings" (extraction-settings) nav
  entries; left Overview/AI Assistant and the commented-out placeholders alone.

**`packages/shared`**
- `src/schemas/maintenance.schema.ts` and `src/schemas/document-response.schema.ts` deleted;
  `src/index.ts` no longer re-exports them (confirmed via grep that no file outside the deleted
  ones imported from `@maintain/shared`).

### Kept, and why

- `modules/extraction/model-registry.ts` + `extraction.controller.ts` (`GET /extraction/models`) —
  the provider-agnostic Groq/OpenAI/Anthropic/OpenRouter registry Stage 5's diagnostic agent binds
  its model calls through directly. `extraction.module.ts` needed no change: it never had
  `OcrService` registered as a provider (only `maintenance.module.ts` wired it in), so removing
  `ocr.service.ts` required no module-wiring edit.
- `modules/users/` (whole module, untouched) — Clerk-linked settings incl. `modelKey` and BYOK
  `encryptedApiKey`; the future diagnostic agent still needs a model choice + optional BYOK key,
  and `planApprovalMode` is the same auto-approve/manual-review concept the future HITL
  "Active Alerts" queue reuses for `FaultDiagnostic`.
- `common/crypto/` — BYOK AES-256-GCM encryption backing `users` module's `encryptedApiKey`.
- `common/prisma/` — needed regardless of what the schema ends up containing.
- `app.module.ts` now imports only `ConfigModule`, `PrismaModule`, `UsersModule`, `ExtractionModule`.

### Judgment calls not explicitly covered by the task brief

- `apps/api/prisma/seed.ts` imported `seedMeasures` from the now-deleted
  `modules/maintenance/seed-measures.ts`. Reduced it to a wired-but-no-op `main()` (kept as the
  `prisma.seed` entry point for whatever the VPP domain needs to seed later) rather than deleting
  the script outright, since `package.json`'s `prisma.seed` config still points at it.
- `apps/api/test/app.e2e-spec.ts` only ever tested `/` (`Hello World!`) — no `/maintenance` or
  telemetry route tests existed to remove; left as-is.
- `apps/api/src/modules/extraction/model-registry.ts`'s `ProcessingMode` type (`'vision' |
  'local-ocr'`) and its doc comment mentioning Tesseract were left untouched, per the task's
  explicit instruction to keep `model-registry.ts` and the `users` module "as-is" — `'local-ocr'`
  is now a selectable-but-inert value (no consumer left performs local OCR), but nothing
  references the deleted `OcrService` directly, so it doesn't break the build. Flagged here rather
  than silently cleaned up, since trimming it wasn't in the brief and touches a file marked keep-as-is.
- `apps/web/src/app/api/chat/route.ts`'s maintenance-themed system prompt and
  `app/dashboard/chat/chat-view.tsx`'s maintenance-flavored sample-prompt copy, plus one generic
  "regular maintenance" sentence in `app/privacy-policy/page.tsx`, were all left untouched — none
  are broken references (no imports of deleted code), just copy; explicitly out of scope per the
  task brief (chat feature itself stays intact, content pass deferred).
- `AGENTS.md` had an unrelated staged edit already in the index when this task started (a "Type
  safety & single source of truth" section rewrite, not authored by this cleanup) that itself
  introduced a reference to a file this cleanup deletes
  (`features/maintenance/use-extract-maintenance.ts`). Left that section's structure/intent as
  found and only fixed the now-dangling file reference, since rewriting someone else's already-staged
  prose further wasn't part of this task.
- `packages/shared/src/schemas/` is now an empty directory (git doesn't track empty dirs, so this
  doesn't show up in `git status`) — left in place rather than removed, since `AGENTS.md` and this
  file both point at it as where the Stage 3 VPP schemas will land.

### Still pending (unchanged by this cleanup)

`apps/api/prisma/schema.prisma` and `prisma/migrations/` still describe the old
`MachineProfile`/`MachineReading`/`Measure`/`Plan` domain — the `DeviceAsset`/`TelemetryLog`/
`FaultDiagnostic` pivot is Stage 3, a separate and more deliberate task, deferred as instructed.

---

## 2026-08-12 — Prisma → Drizzle ORM swap

Explicit decision, ahead of Stage 3: the persistence layer moves from Prisma to
Drizzle ORM before the domain schema pivot happens, so Stage 3 writes the
`DeviceAsset`/`TelemetryLog`/`FaultDiagnostic` schema directly in Drizzle rather than
in Prisma-then-migrate-again. Scoped tightly because the maintenance-domain cleanup
above already shrank Prisma's actual footprint to six files total (`app.module.ts`,
`main.ts`, `common/prisma/*`, `users.module.ts`, `users.service.ts`) plus their specs.

### What changed

- Deleted `apps/api/prisma/` entirely — `schema.prisma`, all migrations, `seed.ts`.
  The old schema still had now-orphaned `ExtractionLog`/`MachineProfile`/
  `MachineReading`/`Measure`/`Plan` models (nothing in the app referenced them after
  the earlier cleanup) — none of those were ported forward; only `User`, the one
  model actually still in use, moved to Drizzle.
- `apps/api/src/common/prisma/` → `apps/api/src/common/db/`: `schema.ts` (the
  Drizzle table def), `db.service.ts` (`DbService`, a `pg.Pool` + Drizzle instance
  with the same `OnModuleInit`/`OnModuleDestroy` lifecycle `PrismaService` had),
  `db.module.ts` (`DbModule`, same shape as the old `PrismaModule`).
- `users.service.ts` rewritten from Prisma's `findUnique`/`upsert` calls to Drizzle's
  `select().from().where().limit()` / `insert().values().onConflictDoUpdate().returning()`.
  One deliberate behavior addition: `updateSettings`'s `set` object now always
  includes `updatedAt: new Date()` explicitly — Drizzle's `onConflictDoUpdate`
  needs a non-empty `set`, and this doubles as the same "touched now" semantics
  Prisma's `@updatedAt` gave for free.
- `app.module.ts`, `main.ts`, `users.module.ts` updated to import `DbService`/
  `DbModule` instead of `PrismaService`/`PrismaModule`. `main.ts`'s startup DB
  health-check changed from `prisma.$queryRaw\`SELECT 1\`` to
  `dbService.db.execute(sql\`SELECT 1\`)`.
- `users.service.spec.ts` rewritten with a hand-built mock of Drizzle's fluent
  query builder (chainable `select/from/where/limit` and
  `insert/values/onConflictDoUpdate/returning`) instead of a Prisma-shaped mock.
  All 25 assertions carried forward with equivalent coverage.
- `apps/api/package.json`: removed `@prisma/client`, `prisma`, the `postinstall:
  prisma generate` script, and the `prisma.seed`/`db:seed` config. Added
  `drizzle-orm`, `pg`, `@types/pg` (dep), `drizzle-kit` (devDep), and
  `db:generate`/`db:migrate` scripts (`drizzle-kit generate` / `drizzle-kit
  migrate`). Root `package.json`'s `db:seed` script (now dangling) replaced with
  `db:generate`/`db:migrate` passthroughs.
- Added `apps/api/drizzle.config.ts` (schema path, migration output dir
  `./drizzle`, reads `DATABASE_URL`).
- Generated the initial migration offline (`drizzle-kit generate` needs no live DB
  connection, only the schema file) — `apps/api/drizzle/0000_ambiguous_makkari.sql`,
  a single `CREATE TABLE "users" (...)`. **Not applied to any database** — no
  `DATABASE_URL` credentials exist in this environment. Run `pnpm db:migrate`
  (root) once a real `DATABASE_URL` is configured to actually create the table.
- `apps/api/.env.example`: dropped the `ELECTRICITY_MAPS_TOKEN` entry (dead config
  left over from the deleted `carbon` module — missed in the earlier cleanup pass)
  and updated the `DATABASE_URL` comment to mention Drizzle/drizzle-kit instead of
  being silent on which layer reads it.

### Deliberate behavior changes from the Prisma-era schema

- **Table/column naming: PascalCase/camelCase → snake_case.** Prisma's default
  (no `@@map`) produced a quoted `"User"` table with camelCase columns
  (`"clerkId"`, `"planApprovalMode"`, ...). The new Drizzle schema uses
  conventional Postgres snake_case (`users`, `clerk_id`, `plan_approval_mode`, ...)
  — avoids quoted-identifier friction and matches typical Drizzle/Postgres
  convention. **This means the new migration does not line up with any
  pre-existing `"User"` table from a live Prisma-era database** — there's no
  data-migration path here, since no live `DATABASE_URL` was available to check
  whether one exists. If a real deployed database with existing `User` rows
  exists, that data needs to be handled by hand (rename+lowercase the old table,
  or export/reimport) before running the new migration against it.
- **`id` default: Prisma's `cuid()` → `crypto.randomUUID()`.** No native cuid
  generator in Drizzle without an extra dependency; nothing in the app validates
  the id format specifically (`userId`/`clerkId` are treated as opaque strings
  throughout), so this is a safe, low-risk substitution for a table with no
  existing rows to reconcile.

### Verification

- `pnpm install` — clean.
- `drizzle-kit generate` — produced the expected single-table migration, matching
  the seven-column `User` model schema.prisma had (`id`, `clerkId`,
  `planApprovalMode`, `modelKey`, `encryptedApiKey`, `processingMode`,
  `createdAt`, `updatedAt`).
- `pnpm typecheck` — 4/4 tasks pass across all 3 packages.
- `pnpm test` — 3 suites, 25 tests pass (`byok-encryption.spec.ts`,
  `app.controller.spec.ts`, `users.service.spec.ts` — the last one rewritten for
  the Drizzle mock, same coverage as the Prisma-era version).

### Still pending

- Applying the generated migration (`apps/api/drizzle/0000_*.sql` — filename
  changed in the follow-up entry below) to a real database — needs a
  `DATABASE_URL` this environment doesn't have.
- Stage 3's domain pivot (`DeviceAsset`/`TelemetryLog`/`FaultDiagnostic`) now
  happens directly against the Drizzle schema in `apps/api/src/common/db/schema.ts`
  — no second ORM migration needed first.

---

## 2026-08-12 — Correction: the "extraction" module wasn't fully load-bearing

Prompted by a direct question ("why did you keep the extraction module?") that
turned out to have a real answer buried in it. The earlier cleanup kept
`modules/extraction/` wholesale on the reasoning that the model registry inside
it was reusable infra. That was half right — closer inspection found it was a
mix of one genuinely load-bearing piece and two more leftovers from the old
document/OCR domain that should have gone in the first cleanup pass.

### What was actually true

- `MODEL_REGISTRY`/`resolveModel`/`DEFAULT_MODEL_KEY` — **genuinely used**,
  `UsersService` depends on these directly to validate and default a user's
  model preference. Not dead code; deleting it would have broken something real.
- `extraction.controller.ts` (`GET /extraction/models`) — **dead**. Its own doc
  comment said it existed for "the Settings page and the upload screen's model
  picker" — both were deleted in the first cleanup pass. Zero consumers left,
  confirmed by grep across both apps.
- `ProcessingMode` (`'vision' | 'local-ocr'`), `PROCESSING_MODES`,
  `DEFAULT_PROCESSING_MODE`, `isProcessingMode` — **dead weight**, missed the
  first time because they were bundled inside the same file as the (genuinely
  needed) model registry. Entirely about "how do we read scanned PDF/image
  documents" — meaningless without OCR, which the first cleanup already
  removed. `UsersService` was still storing `processingMode` as a setting with
  no purpose left.

### What changed

- `apps/api/src/modules/extraction/model-registry.ts` → `apps/api/src/common/ai/model-registry.ts`
  (`git mv`, history preserved) — relocated to `common/` alongside `db/` and
  `crypto/` because it's cross-cutting infra with no controller of its own, not
  a "feature module." Trimmed the stale "extraction pipeline" doc-comment
  wording (that pipeline no longer exists) and removed the `ProcessingMode`
  block entirely.
- Deleted `extraction.controller.ts` and `extraction.module.ts` (dead), and the
  now-empty `modules/extraction/` directory. Removed `ExtractionModule` from
  `app.module.ts`.
- Removed `processingMode` from `common/db/schema.ts` (column dropped),
  `users.service.ts` (`SettingsUpdate`, `getSettings`, `updateSettings`), and
  `users.service.spec.ts` (fixtures/assertions). `users.service.ts`'s import of
  the registry updated to the new `common/ai/` path.
- Regenerated the Drizzle migration from scratch (the previous one was never
  applied to any database, so no data/history to preserve) — now 7 columns
  instead of 8. New file: `apps/api/drizzle/0000_dark_major_mapleleaf.sql`.
- `AGENTS.md`: fixed the three now-stale `modules/extraction/model-registry.ts`
  path references to `common/ai/model-registry.ts`; replaced the "AI SDK usage"
  section with a fuller "Building an AI feature" section documenting the
  intended folder shape for a future AI-calling module (`tools/` subfolder,
  one pure function + Zod schema per tool) and the underlying principles
  (start with the simplest structure that solves the problem; tools as a
  precise interface, not a grab-bag; deterministic math never left to the
  model; human-in-the-loop before any consequential action) — this is written
  as a convention for when Stage 4/5 actually get built, not scaffolding built
  ahead of time. No new folders were created — the convention lives in docs
  until a real feature needs it.

### Verification

- `pnpm typecheck` — 4/4 tasks pass.
- `pnpm test` — 3 suites, 25 tests pass (`users.service.spec.ts` updated for
  the dropped `processingMode` field, same remaining coverage).

---

## 2026-08-12 — Vercel AI SDK v6→v7, Node 20→22, and a real DbService bug found along the way

`ai` was pinned at `^6.0.116` (latest available: `6.0.250`) and every
`@ai-sdk/*` provider package was similarly far behind even its own major
version. Bumped straight to the current majors — `ai@^7.0.62`,
`@ai-sdk/{anthropic,groq,openai}@^4.x`, `@ai-sdk/react@^4.0.65` — rather than
just catching up within v6, since Node 22 was already the frontend's pinned
version (`apps/web/.nvmrc`) and available in every environment that matters
here.

### Node version bump (required by AI SDK 7)

AI SDK 7 requires Node ≥22 and is ESM-only. This environment already runs
Node 22.19.0 and `apps/web/.nvmrc` already said `22`, but two things didn't
match yet:
- `.github/workflows/ci.yml` was pinned to Node 20 — bumped to 22.
- No `package.json` declared an `engines.node` requirement anywhere — added
  `"engines": { "node": ">=22" }` to the root, `apps/api`, and `apps/web`
  `package.json`s so a mismatched local Node version fails loudly instead of
  hitting a confusing ESM error three layers down.
- `README.md`'s prerequisite line updated from "Node.js (v18+)" to "v22+
  (required by AI SDK 7)".

### API migration (deprecated aliases still worked, migrated anyway)

`pnpm typecheck` passed immediately after the version bump with zero changes
— v7 keeps `system` and `result.toUIMessageStreamResponse()` working as
deprecated aliases. Migrated `apps/web/src/app/api/chat/route.ts` to the
non-deprecated forms anyway, since leaving freshly-touched code on APIs
already marked deprecated in the version just installed isn't good practice:
- `system: '...'` → `instructions: '...'` on the `streamText` call.
- `result.toUIMessageStreamResponse({ onError })` → the standalone
  `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream:
  result.stream, onError }) })`, matching the shape the refusal-response path
  in the same file already used.

### The real breaking change: `@ai-sdk/*` v4 is ESM-only, `apps/api` compiles to CommonJS

Typecheck passing was misleading — `pnpm test` failed with `SyntaxError:
Cannot use import statement outside a module`, tracing back to
`common/ai/model-registry.ts`'s static top-level imports of `createGroq`/
`createOpenAI`/`createAnthropic`. `@ai-sdk/*` v4 packages declare `"type":
"module"` with no CommonJS build; `apps/api/tsconfig.json` compiles with
`"module": "commonjs"`. A static `import`/`require` of an ESM-only package
under CommonJS throws `ERR_REQUIRE_ESM` **at module-load time** — meaning
merely loading `model-registry.ts` (e.g. for its `MODEL_REGISTRY` constant,
which is all `UsersService` actually uses today) would have crashed the real
NestJS backend on boot, not just Jest. This was caught before it could ship
precisely because verifying it meant actually running the compiled backend,
not just trusting a clean `tsc --noEmit`.

**Fix:** `resolveModel()` is now `async` and imports each provider SDK
lazily via `await import(...)` inside the relevant `switch` case, instead of
statically at the top of the file. Node's CommonJS runtime supports dynamic
`import()` as the sanctioned way to consume an ESM-only package, and
TypeScript's commonjs emit preserves `import()` expressions rather than
downleveling them to `require()`. `resolveModel` has zero callers anywhere
in the current live codebase (only `MODEL_REGISTRY`/`DEFAULT_MODEL_KEY`/
`ModelKey` are imported elsewhere), so making it async broke nothing —
Stage 5's diagnostic agent, its first real caller, will just `await` it.

**Verified, not assumed:** ran `ts-node` against the real compiled-CommonJS
tsconfig to call `resolveModel('groq:compound-mini')` directly — resolved a
real model object, confirming the dynamic import genuinely works under
Node's CJS runtime and isn't just papering over the Jest failure.

### A second, unrelated bug found by the same verification effort

Went one step further and actually booted the compiled backend
(`node dist/src/main.js`) rather than stopping at Jest passing. It got past
all module loading cleanly (proving the fix above), then failed with
`Cannot read properties of undefined (reading 'execute')` on
`dbService.db.execute(...)` in `main.ts`'s startup health check —
`DbService.db` was `undefined`.

Root cause, confirmed by direct reproduction (`app.get(DbService).db` right
after `NestFactory.create()` resolved, logged, was genuinely `undefined`):
**`NestFactory.create()` does not run `onModuleInit` lifecycle hooks** — those
fire only when `app.init()` (called internally by `app.listen()`) runs, which
`main.ts` does *after* the health check, not before. `DbService` had been
built the Prisma-era way — `pool`/`db` constructed in `onModuleInit` (a
holdover pattern from `PrismaService`, which happened to work there because
`PrismaClient`'s query methods lazily self-connect regardless of whether
`onModuleInit` ran). Drizzle's `db` object has no such self-initializing
behavior — if `onModuleInit` hasn't fired, it's just `undefined`.

**Fix:** moved `pool`/`db` construction into `DbService`'s constructor —
both are synchronous and need no injected dependencies, so there was never a
real reason to defer them to a lifecycle hook. Only `onModuleDestroy` (closing
the pool) remains a real lifecycle hook. Verified: `app.get(DbService).db` is
now populated immediately after `NestFactory.create()`, and a full compiled
boot against a genuinely unreachable `DATABASE_URL` now fails with a real
`ECONNREFUSED` from the health check's actual `SELECT 1` query — not a
`TypeError` from a service that was never initialized.

### Verification

- `pnpm typecheck` — 4/4 tasks pass.
- `pnpm test` — 3 suites, 25 tests pass.
- `pnpm build` (both apps) — succeeds.
- Compiled backend boot (`node dist/src/main.js`), twice: once missing
  `BYOK_ENCRYPTION_KEY` (fails on that specific, correct, unrelated check —
  proves nothing AI-SDK-related is broken), once with all required env vars
  set against an unreachable `DATABASE_URL` (fails with `ECONNREFUSED` from
  a real query — proves the DbService fix works end to end).
- `resolveModel()` called directly via `ts-node` under the real
  `commonjs`-target tsconfig — resolves a real model object.
- `pnpm build` (frontend) — succeeds, `/api/chat` route compiles.

---

## 2026-08-12 — Package renames: `@maintain/*` → `@gridstream/*`

Resolves the rename decision left pending in the Stage 2 plan entry above.
Root package renamed `maintain-agent` → `gridstream-agent`; the three
workspace packages renamed to match their directory names exactly:
`@maintain/backend` → `@gridstream/api`, `@maintain/frontend` →
`@gridstream/web`, `@maintain/shared` → `@gridstream/shared`.
`packages/shared`'s directory path is unchanged — only its package `name`
and description moved; the `@repo/ai-config` rename floated in the original
Stage 2 plan was not done, since that's a rename tied to the still-pending
domain pivot (Stage 3), not this scope-name cleanup.

### What changed

- Root `package.json`: `name` field, and the `--filter @maintain/...` targets
  in `dev:frontend`/`dev:backend`/`db:generate`/`db:migrate`.
- `apps/api/package.json`: `name` → `@gridstream/api`, its
  `@maintain/shared` dependency → `@gridstream/shared`.
- `apps/web/package.json`: `name` → `@gridstream/web`, same dependency
  rename. `apps/web/tsconfig.json`'s `@maintain/shared` path alias renamed
  to `@gridstream/shared` — also fixed its target path in the same edit,
  which pointed at a nonexistent `packages/shared/index.ts` (the real file
  is `packages/shared/src/index.ts`); harmless since nothing in `apps/web/src`
  actually imports the alias today (confirmed by grep before touching it),
  but there was no reason to carry a broken path forward while renaming it.
- `packages/shared/package.json`: `name` → `@gridstream/shared`,
  description's `maintain-agent` → `gridstream-agent`. `src/index.ts`'s
  header comment (`@maintain/shared` → `@gridstream/shared`).
- Confirmed via grep before starting that no `.ts` source file anywhere in
  `apps/api/src` or `apps/web/src` imports `@maintain/shared` by name
  today (everything that used to needed it — the maintenance-domain schemas
  — was deleted in an earlier pass) — so this was a purely mechanical
  package.json/tsconfig/docs rename, zero source-import updates needed.
- `AGENTS.md` and `README.md`: every `@maintain/backend`/`@maintain/frontend`/
  `@maintain/shared` and `--filter=@maintain/...` reference updated to the
  new names. `goal.md` (the old product brief, already documented elsewhere
  as historical/unmaintained) was deliberately left untouched — out of scope.

### Verification

- `pnpm install` — lockfile updated cleanly, Turbo's own scope listing now
  reads `@gridstream/api, @gridstream/shared, @gridstream/web`.
- `pnpm typecheck` — 4/4 pass. `pnpm test` — 3 suites, 25 tests pass.
  `pnpm build` — both apps succeed.

---

## 2026-08-12 — Stage 3: DeviceAsset/TelemetryLog/FaultDiagnostic — built, awaiting review

**Not committed** — working-tree changes only, per explicit instruction to stop
before committing so this can be reviewed first.

### Design change from the original Stage 3 spec: one definition, not two

The original plan (and the Stage-2-era file-level notes above) implied a Drizzle
table plus a hand-written, separately-maintained Zod schema per model. Changed
that on request: the Drizzle table is now the *only* hand-written definition;
its Zod schema is *derived* from it via `drizzle-zod`'s `createSelectSchema()`/
`createInsertSchema()`. One definition cascades to the migration, the Zod
validator, and every `z.infer<>` type both apps use — nothing to keep in sync
by hand. Checked compatibility first: `drizzle-zod@0.8.3` requires `zod ^4.0.0`
(have `^4.3.6`) and `drizzle-orm >=0.36.0` (have `^0.44.6`) — both satisfied.

### What changed

- **`packages/shared/src/db/schema.ts`** (new) — the single source of truth for
  every table:
  - `users` — moved here from `apps/api/src/common/db/schema.ts` (unchanged
    fields), so all four tables live in one place instead of three in
    `apps/api` and one in `packages/shared`.
  - `deviceAssets` — `id`, `deviceType` (`pgEnum`: SOLAR/BATTERY/HEAT_PUMP/
    WALLBOX), `serialNumber` (unique), `location` (nullable), `status`
    (`pgEnum`: ONLINE/OFFLINE/MAINTENANCE — **not in the original spec**,
    which only said "status" with no values; picked a minimal reasonable
    default set, flagged here since nothing downstream depends on these
    exact three yet), `createdAt`/`updatedAt`.
  - `telemetryLogs` — `id`, `deviceId` (FK → `deviceAssets.id`, **cascade
    delete** — explicit decision, see below), `timestamp` (defaults to
    `now()`), `solarProductionKwh`/`batterySoC`/`batteryTempCelsius`/
    `gridVoltage` (all nullable — not every device type reports every
    metric, e.g. a WALLBOX has no solar production).
  - `faultDiagnostics` — `id`, `deviceId` (FK, cascade delete), `severity`
    (`pgEnum`: LOW/MEDIUM/HIGH/CRITICAL), `faultType`, `summary`,
    `recommendedAction`, `requiresImmediateDispatch` (boolean), `status`
    (`pgEnum`: PENDING_APPROVAL/APPROVED/REJECTED, defaults to
    PENDING_APPROVAL), `createdAt`. Deliberately did *not* add
    `approvedAt`/`approvedBy` (the old `Plan` table had these) — not in the
    spec, not needed yet; add when Stage 6's approve/reject flow actually
    needs them.
  - **FK cascade decision (asked, not assumed):** deleting a `DeviceAsset`
    cascades to delete its `TelemetryLog`/`FaultDiagnostic` rows. Confirmed
    explicitly rather than guessed, since the alternative (restrict/block
    delete to preserve history on decommissioned devices) was a real,
    equally-defensible option.
  - `relations()` for both FK tables (`deviceAssetsRelations`,
    `telemetryLogsRelations`, `faultDiagnosticsRelations`) — enables
    Drizzle's typed relational query API (`db.query.deviceAssets.findMany({
    with: { telemetryLogs: true } })`), which Stage 4/5/6 will need
    immediately for any device-with-history query. Not speculative — the
    very next stage needs this.
  - Derived per table: `<name>SelectSchema`, `<name>InsertSchema` (Zod, via
    drizzle-zod) and `<Name>`/`New<Name>` types (`z.infer<>` of those).
- **`packages/shared/src/index.ts`** — now re-exports `./db/schema`.
- **`packages/shared/package.json`** — added `drizzle-orm`, `drizzle-zod`
  (deps) and `@types/node` (devDep — see the crypto fix below).
- **A real cross-environment bug caught before it shipped:** the first draft
  used `import { randomUUID } from 'crypto'` (Node's built-in module) for
  each table's `id` default. Typecheck failed immediately —
  `packages/shared` has no `@types/node`, correctly, since it's meant to be
  bundled into `apps/web` too. Fixed by switching to the *global*
  `crypto.randomUUID()` (Web Crypto API — a standard global in both Node 19+
  and every modern browser, no import needed at all), and added
  `@types/node` as a **devDependency only** (type-checking, not a runtime
  import) so the global is typed. This wasn't just a types error to silence
  — a Node-module import here would have broken `apps/web`'s build the
  moment it imported a type from this file, since bundlers can't resolve
  Node's `crypto` for a browser bundle.
- **`apps/api/src/common/db/schema.ts`** — deleted (superseded).
- **`apps/api/src/common/db/db.service.ts`** — `import * as schema from
  './schema'` → `import * as schema from '@gridstream/shared'`. Verified
  the extra non-table exports in that namespace (Zod schemas, inferred
  types) don't confuse Drizzle's `NodePgDatabase<typeof schema>` — it
  identifies tables/relations by internal symbol, not by the export list —
  via a full typecheck pass, not assumed.
- **`apps/api/src/modules/users/users.service.ts`** — same import-path
  change for the `users` table.
- **`apps/api/drizzle.config.ts`** — `schema` path updated to
  `../../packages/shared/src/db/schema.ts`.
- **Migration regenerated** — old one only had `users` (never applied to any
  database, so nothing to preserve); new one
  (`apps/api/drizzle/0000_eminent_apocalypse.sql`) has all four tables, four
  `CREATE TYPE ... AS ENUM` statements, and both FK constraints with
  `ON DELETE cascade`. Not applied anywhere — still no `DATABASE_URL` in
  this environment.
- **`AGENTS.md`** — Structure section: `packages/shared/src/db/schema.ts`
  documented as the single source of truth; `apps/api/src/common/db/`
  updated to reflect `schema.ts` no longer lives there. Added a rule that
  any runtime code inside a table definition (e.g. `$defaultFn`) must work
  in both Node and a browser bundle, citing the crypto fix as the concrete
  reason. Type-safety section rewritten: database rows are now explicitly
  "derived, not hand-written separately" as their own bullet, distinct from
  the hand-written-Zod-schema path for non-DB-row shapes.

### Verification

- `pnpm install` — clean, `drizzle-zod` resolved.
- `drizzle-kit generate` — 4 tables, 9 columns on `fault_diagnostics` (1 FK),
  7 on `telemetry_logs` (1 FK), 7 on `device_assets`, 7 on `users`, matching
  the design above exactly.
- `pnpm typecheck` — 4/4 pass, including `apps/api`'s `DbService` against the
  full shared-package namespace.
- `pnpm test` — 3 suites, 25 tests pass (one run measured 55s instead of the
  usual ~2s — re-ran directly with `npx jest`, got 1.8s; confirmed a one-off
  cold-compile, not a regression, before moving on).
- `pnpm build` — both apps succeed (`/api/chat` route included). First
  attempt hit a `.next/lock` conflict from an earlier build still running
  concurrently in the background — not a code issue; cleared the stale lock
  and re-ran cleanly.
- Compiled backend boot (`node dist/src/main.js`) against an unreachable
  `DATABASE_URL` — reaches a real `ECONNREFUSED` from the health check's
  actual `SELECT 1` query via the shared schema, same as the last two times
  this exact smoke test was used to verify a DB-layer change. Confirms the
  whole chain (packages/shared → DbService → real query execution) works
  end to end, not just that it typechecks.

### Still pending

- Applying the migration to a real database (no `DATABASE_URL` here).
- No controllers/services/endpoints for these tables yet — deliberately out
  of Stage 3's scope per AGENTS.md's minimal-footprint rule. Stage 4
  (ingestion) and Stage 6 (dashboard) are what actually query them.
- This entire stage is **uncommitted** — review the working tree and commit
  (or request changes) when ready.

---

## 2026-08-12 — Stage 4: NestJS ingestion, Redis/BullMQ queue, telemetry simulator

**Not committed** — same as Stage 3, working-tree changes only.

### Version decision: bullmq 5.x, not the just-released 6.x

`@nestjs/bullmq@11.0.5` accepts `bullmq ^3 || ^4 || ^5 || ^6`. Checked both
before picking: `bullmq@6.1.0` is a genuinely new major — it turned `pg`,
`redis`, and `ioredis` all into peer dependencies, adding Postgres itself as
an alternative queue backend alongside Redis. `bullmq@5.81.3` is still the
mature, Redis-only, ioredis-bundled architecture (confirmed via `npm view
bullmq@5.81.3 dependencies` — `ioredis` is a direct dependency, not a peer).
Pinned to 5.x: a brand-new multi-backend redesign is real complexity to
misconfigure for infrastructure this environment can't live-test against
(no Redis here either, same situation as Postgres). Added `ioredis@^5.11.1`
as an explicit dependency too, matching the exact version bullmq 5.x bundles
internally, so pnpm resolves both to the same instance rather than two.

### What changed

- **`apps/api/package.json`** — added `@nestjs/bullmq`, `bullmq`, `ioredis`.
- **`apps/api/.env.example`** — `REDIS_URL`, `TELEMETRY_SIMULATOR_ENABLED`
  (default `false`, confirmed via question before building), and
  `TELEMETRY_SIMULATOR_INTERVAL_MS`.
- **`apps/api/src/app.module.ts`** — `BullModule.forRootAsync` registers the
  Redis connection once, globally, as a real `ioredis` instance (constructed
  with `maxRetriesPerRequest: null`, which BullMQ's blocking connections
  require or Worker construction throws).
- **New module: `apps/api/src/modules/telemetry-ingestion/`** — no
  controller, since this isn't an HTTP feature (a producer/consumer pair):
  - `telemetry-reading-generator.ts` — pure function, generates a plausible
    reading per device type (SOLAR gets `solarProductionKwh`, BATTERY gets
    `batterySoC`/`batteryTempCelsius`, all types get `gridVoltage`), with a
    10% chance per tick of pushing one metric into anomaly range — thermal
    runaway (>65°C) for BATTERY devices, voltage sag (<200V) for everything
    else. Takes an injectable `random` source so tests are deterministic.
  - `telemetry-thresholds.ts` — pure `isAnomalous()`, the exact two bounds
    from the master plan, boundary-exclusive (65.0°C itself doesn't count).
  - `telemetry-simulator.service.ts` — the producer. Gated by
    `TELEMETRY_SIMULATOR_ENABLED` (off by default, confirmed via question).
    On each tick: picks a random `DeviceAsset`, generates a reading,
    `queue.add()`s it. Logs and no-ops if `device_assets` is empty rather
    than erroring.
  - `telemetry-queue.consumer.ts` — the `@Processor('telemetry')` consumer.
    Validates `job.data` against `telemetryLogInsertSchema` (from
    `@gridstream/shared` — Stage 3's derived schema, reused directly as the
    queue payload contract), inserts into `telemetry_logs`, calls
    `AiDiagnosticTriggerService.trigger()` if `isAnomalous()`.
  - `ai-diagnostic-trigger.service.ts` — the Stage 5 seam. One method,
    currently just logs. Kept as its own injectable service specifically so
    Stage 5 is a change to this one file, not a rewrite of the consumer.
  - `telemetry-ingestion.constants.ts` — see the circular-import bug below
    for why this exists as a separate file.
  - `telemetry-ingestion.module.ts` — registers the queue, wires the three
    providers.
- **`packages/shared/src/db/schema.ts`** — `telemetryLogInsertSchema`'s
  `timestamp` field overridden to `z.coerce.date()` instead of drizzle-zod's
  default strict `z.date()`. Reasoning below.
- **`apps/api/scripts/seed-devices.ts`** (new) + `db:seed` script (added
  back to both `apps/api/package.json` and root `package.json` — it didn't
  exist since the Prisma→Drizzle migration removed the old one). Seeds one
  demo device per `deviceType`, idempotent via `onConflictDoNothing()` on
  `serial_number`. Standalone script outside Nest's DI graph, same pattern
  the old Prisma-era `prisma/seed.ts` used.
- **`AGENTS.md`** — "What this is" now mentions Redis/BullMQ and the new
  module; Structure section documents the producer/consumer split and why
  there's no controller.

### Two real bugs caught by actually running things, not by typecheck

**1. BullMQ JSON-serializes job data through Redis — a `Date` doesn't survive.**
The producer enqueues `reading.timestamp` as a real `Date`; by the time the
consumer reads `job.data.timestamp`, it's a plain ISO string (Redis only
stores strings, so BullMQ always JSON-round-trips job payloads). Drizzle-zod's
default-derived schema uses a strict `z.date()`, which rejects a string
outright. Fixed by overriding just that one field to `z.coerce.date()` in
the schema derivation itself — accepts a real `Date` *or* a string
identically, so it works for both the queue consumer and any future direct
in-process insert. Regression-tested: `telemetry-queue.consumer.spec.ts`
explicitly passes a string timestamp through `process()` and asserts the
inserted value is a real `Date` instance.

**2. Circular import silently broke DI resolution at boot — not at typecheck, not in unit tests.**
`telemetry-ingestion.module.ts` originally both exported `TELEMETRY_QUEUE`
*and* imported the services that needed it; those services imported the
constant back from the module file. That cycle means `TELEMETRY_QUEUE` is
still `undefined` at the moment the `@InjectQueue()` decorator runs on
`TelemetrySimulatorService` (decorators execute at class-definition time,
before the cycle finishes resolving). Result: NestJS silently registered the
injection under a fallback `"BullQueue_default"` token instead of
`"BullQueue_telemetry"`, and the real app crashed at boot with
`UnknownDependenciesException` — while `tsc --noEmit` stayed clean and every
unit test passed, because the unit tests mock the queue object directly and
never exercise Nest's actual DI container. **Only caught by booting the real
compiled app** (same discipline as Stage 3's `DbService` bug) — moved
`TELEMETRY_QUEUE` into its own dependency-free `telemetry-ingestion.constants.ts`
so nothing importing it can be part of a cycle.

### Verification

- `pnpm typecheck` — 4/4 pass. `pnpm test` — 7 suites, 46 tests pass (21 new:
  6 reading-generator, 7 thresholds, 3 consumer, 5 simulator).
- `pnpm build` — both apps succeed.
- Compiled backend boot, twice: once with `REDIS_URL` pointed at a closed
  port and the simulator disabled — reaches the same correct Postgres
  `ECONNREFUSED` as every prior smoke test (confirms `ioredis`'s lazy-connect
  behavior doesn't block or crash boot when Redis is unreachable, unlike a
  synchronous-connect client would); once with the simulator enabled too —
  same clean result, `TelemetryIngestionModule dependencies initialized`
  with no DI error (this is what caught bug #2 above, before the fix).
- The simulator's `onModuleInit` itself doesn't fire in either boot test —
  expected, not a gap: `main.ts`'s DB health check runs (and fails, no live
  Postgres here) *before* `app.listen()`, and `onModuleInit` hooks fire on
  `listen()`/`init()`, not on `NestFactory.create()` (this is the exact
  mechanism Stage 3's `DbService` bug turned on). The simulator's actual
  tick/enable-gating/queue-call behavior is covered by
  `telemetry-simulator.service.spec.ts` instead, which calls `onModuleInit()`
  directly against a mocked queue+DbService.

### Still pending

- Applying the migration and running `pnpm db:seed` against a real database
  — no `DATABASE_URL`/`REDIS_URL` here.
- Actually seeing a job flow through a live Redis end-to-end — can't verify
  further than "DI resolves correctly and the consumer's logic is correct
  in isolation" without one.
- Stage 5 (the real diagnostic agent) replaces `AiDiagnosticTriggerService`'s
  body — everything else in this stage stays as-is.
- This entire stage is **uncommitted**, same as Stage 3.

---

## 2026-08-12 — Stage 5: Vercel AI SDK diagnostic agent (generateText + tool calling)

**Not committed** — same as Stage 3/4, working-tree changes only.

### Design change from the original Stage 3-era plan wording: `generateText`+tools, not `generateObject`

Earlier docs (Stage 1's audit, `AGENTS.md`'s pre-Stage-5 notes) described the
target as "generateObject + tool calling." That combination doesn't exist in
the AI SDK — `generateObject()` is single-shot structured extraction with no
tool-calling loop at all. What the master plan actually needs (investigate
via `getHistoricalBaseline`/`getHardwareManual`, *then* produce a structured
verdict) is `generateText()` with `tools` and `stopWhen: stepCountIs(n)`, plus
a **schema-only "final answer" tool** (`submitDiagnosis`: an `inputSchema`
with no `execute`) — the model's call to it is validated against the schema
and lands in `result.toolCalls`, and having no result to append is what
naturally ends the loop. `AGENTS.md`'s "Building an AI feature" section and
`README.md`'s "Building an AI feature here" section were both corrected to
document this distinction properly, citing this module as the reference
implementation.

### What changed

- **New module: `apps/api/src/modules/diagnostics/`** — no controller (an
  internal service the BullMQ consumer calls, not an HTTP feature):
  - `tools/get-historical-baseline.tool.ts` — `queryHistoricalBaseline()`
    (pure-ish, takes a `DbService`) aggregates the last 24h of `telemetry_logs`
    for one device via Drizzle's `avg()`/`count()`, returning sample count and
    per-metric averages (`null` for metrics that device type never reports).
    `createGetHistoricalBaselineTool()` closes over `deviceId` — the calling
    service already knows definitively which device triggered a diagnosis, so
    the model is never asked to supply an ID it could get wrong.
  - `tools/get-hardware-manual.tool.ts` — `lookupHardwareManual()`, a pure
    static lookup table keyed by device type + anomaly kind
    (`THERMAL_RUNAWAY`/`VOLTAGE_SAG`), explicitly documented in its own
    comment as placeholder troubleshooting text, not real manufacturer data —
    same honesty standard as the telemetry simulator standing in for real
    hardware.
  - `diagnostics.service.ts` — `DiagnosticsService.diagnose(deviceId,
    triggeringReading)`: loads the `DeviceAsset` (404s if missing, without
    ever calling the model), runs `generateText()` with both tools plus
    `submitDiagnosis` and `stopWhen: stepCountIs(3)`, extracts the
    `submitDiagnosis` tool call from `result.toolCalls` (throws a clear error
    naming the step limit and `finishReason` if the model never called it),
    re-validates its `input` against the proposal schema, then inserts the
    `FaultDiagnostic` with `status: 'PENDING_APPROVAL'` set by the service
    itself — never by the model, which is the whole point of the HITL gate.
  - `diagnostics.module.ts` — imports `DbModule`, exports `DiagnosticsService`.
- **The model-facing proposal shape isn't a new hand-written schema** —
  `diagnosisProposalSchema` is `faultDiagnosticInsertSchema.pick({ severity,
  faultType, summary, recommendedAction, requiresImmediateDispatch })`, reusing
  Stage 3's table-derived schema and excluding exactly the fields the service
  fills in deterministically (`deviceId`, `status`, `id`, `createdAt`) —
  consistent with the "one definition, not two" principle Stage 3 established
  for the tables themselves.
- **`apps/api/src/modules/telemetry-ingestion/ai-diagnostic-trigger.service.ts`**
  — the Stage 4 seam is now live: constructor-injects `DiagnosticsService`,
  `trigger()` calls `diagnose()` inside a try/catch that **swallows** any
  error (logs it, doesn't rethrow). Deliberate, not an oversight: this method
  runs inside a BullMQ job that already did a non-idempotent DB insert (the
  triggering `TelemetryLog` row); a thrown error here would fail the whole
  job and cause BullMQ to retry it, re-inserting that row. `AGENTS.md`'s
  resilience convention (decorative calls never throw, required calls
  propagate) gained a concrete new case for this: a queue-triggered AI call
  stacked on a non-idempotent write is decorative from the queue's
  perspective even though the AI call itself is the point of the job.
- **`telemetry-ingestion.module.ts`** — now imports `DiagnosticsModule` to
  supply the `DiagnosticsService` dependency.
- **`AGENTS.md`** — Structure section documents
  `apps/api/src/modules/diagnostics/`; "Building an AI feature" section
  rewritten to correctly distinguish `generateObject()` (single-shot
  extraction) from `generateText()`+tools+`stopWhen` (agentic loops) from the
  schema-only final-answer-tool pattern, citing `diagnostics.service.ts` as
  the reference implementation.
- **`README.md`** — "Where this project is right now" updated to state the
  diagnostic agent exists; "Building an AI feature here" corrected to match
  `AGENTS.md`'s generateObject-vs-generateText+tools distinction.

### Three real bugs caught by actually running things, not by typecheck alone

**1. `resolveModel()` returns a `Promise`, not a `LanguageModel` — this is
its first real caller.** Predicted in Stage 4's own writeup ("Stage 5's
diagnostic agent...will just `await` it") and confirmed exactly true: fixed
by awaiting it at the `generateText({ model: await resolveModel(...) })`
call site.

**2. The core `ai` package itself is ESM-only in v7 — not just the
`@ai-sdk/*` provider packages.** `pnpm test` failed with `SyntaxError: Cannot
use import statement outside a module`, tracing into `ai/dist/index.js`'s own
`import ... from "@ai-sdk/gateway"` — triggered by a static top-level `import
{ tool } from 'ai'` in both tool factory files and `import { generateText,
stepCountIs, tool } from 'ai'` in `diagnostics.service.ts`. Same root cause
as Stage 4's `resolveModel()` fix, one layer further out: apps/api compiles
to CommonJS, `ai` v7 declares `"type": "module"` with no CJS build, so a
static import crashes at module-load time — under Jest immediately, and
would have crashed the real compiled backend at boot too. Fixed identically:
`tool`/`generateText`/`stepCountIs` are now imported via `await
import('ai')` inside the async functions that use them; only the `import
type { Tool } from 'ai'` type-only imports stayed static (erased at compile
time, no runtime `require`). **Verified beyond Jest passing**: since
`diagnose()`'s dynamic import never actually executes during a normal boot
(nothing triggers a real diagnosis at startup), wrote a standalone script run
directly against the compiled-CommonJS tsconfig that forces the same import
path — `await import('ai')` resolved `generateText`/`tool`/`stepCountIs` as
real functions, and `createGetHistoricalBaselineTool()` produced a genuine
`Tool` object (`description`/`inputSchema`/`execute` keys) — then deleted the
script.

**3. `TS2742` declaration-emit errors on both tool factory functions.**
`declaration: true` requires every exported function's return type to be
portably nameable; the tool factories' inferred return types involved
deeply-nested generics from `ai` that couldn't be named. First fix attempt
(`ReturnType<typeof tool>`) was wrong — `tool()` is overloaded, and that
expression resolves to the *last* overload (`Tool<never, never>`), producing
a different, more confusing type error at each `execute` implementation.
Corrected with explicit annotations naming the real generic parameters:
`Promise<Tool<Record<string, never>, HistoricalBaseline>>` and
`Promise<Tool<{ symptom: AnomalyKind }, string>>`.

### Testing the ESM-only pieces required more than the usual mock

`diagnostics.service.spec.ts` needed two `jest.mock()` calls:
- `jest.mock('ai', ...)` as a **fully manual** mock object — not `{
  ...jest.requireActual('ai'), generateText: jest.fn() }`, since
  `jest.requireActual('ai')` hits the exact same ESM-only load failure as a
  static import would. `tool`/`stepCountIs` got inert pass-through
  implementations (nothing in these tests inspects their output, since the
  thing that would normally call them — a real `generateText()` — is mocked
  out entirely too).
- `jest.mock('../../common/ai/model-registry', ...)` — `resolveModel()`
  dynamically imports a real `@ai-sdk/openai` package internally, which hits
  the same problem; mocked to resolve an empty object, not because its own
  logic needed re-testing here (verified separately in Stage 4 via a
  standalone `ts-node` script for the same reason it can't run under Jest).
- One initialization-order bug along the way: `mockGenerateText` was
  `undefined` inside `beforeEach` because a `jest.mock()` factory only
  executes lazily on the *first* real load of the module — here, that's deep
  inside a test's `diagnose()` call, after `beforeEach` already needed a live
  reference. Fixed by declaring `const mockGenerateText = jest.fn()` *before*
  and *outside* the `jest.mock()` call, referenced from inside the factory
  (works correctly under `ts-jest`, which — unlike `babel-jest` — doesn't
  hoist `jest.mock()` above regular top-to-bottom module code).
- 4 test cases: successful diagnosis persists with `status:
  'PENDING_APPROVAL'`; missing device throws without ever calling the model;
  missing `submitDiagnosis` call throws a clear step-limit error naming
  `finishReason`; a `submitDiagnosis` call with an invalid proposal shape
  throws from the re-validation.

### Verification

- `pnpm typecheck` — 4/4 pass.
- `pnpm test` — 11 suites, 58 tests pass (12 new: 4 `diagnostics.service`,
  4 `get-historical-baseline` query logic, 2 `get-hardware-manual` lookup
  logic, plus `ai-diagnostic-trigger.service.spec.ts` rewritten from a
  logging-stub check to delegation + error-swallowing coverage).
- `pnpm build` — all 3 packages succeed (`apps/web`'s `/api/chat` route
  included, `apps/api`'s `nest build` succeeded).
- Compiled backend boot (`node dist/src/main.js`) against an unreachable
  `DATABASE_URL` — reaches `DiagnosticsModule dependencies initialized` with
  no DI/circular-import error (same discipline as Stage 4's circular-import
  catch), then the same correct `ECONNREFUSED` from the health check's real
  `SELECT 1` query as every prior stage's boot smoke test.
- Standalone runtime script (see bug #2 above) — confirms `await
  import('ai')` and the tool factories genuinely work under real Node
  CommonJS execution, not just Jest's mocks.

### Still pending

- Applying the migration and actually exercising `diagnose()` against a real
  model/database/Redis — no live credentials in this environment for any of
  the three.
- Stage 6 (dashboard) is what will let a human actually see and act on a
  `PENDING_APPROVAL` `FaultDiagnostic` — right now these rows are created but
  nothing surfaces or approves/rejects them.
- This entire stage is **uncommitted**, same as Stage 3/4.

---

## 2026-08-12 — Stage 5 refinement: native `Output.object()` replaces the schema-only "submit" tool

Prompted by a direct question about whether an official AI SDK pattern existed
for this exact shape ("investigate with tools, then emit one structured
verdict") rather than relying on the hand-rolled version built above. Checked
the actual installed `ai` package's type declarations directly
(`apps/api/node_modules/ai/dist/index.d.ts`), not just the doc site — the
doc-site fetch's own paraphrase disagreed with itself on a helper name
(`isStepCount` vs. `stepCountIs`), which the type declarations resolved:
`stepCountIs` is a real named export, just an alias of `isStepCount` (`export
{ ... isStepCount as stepCountIs ... }`) — both work, no discrepancy.

The real finding: `generateText()` accepts an `output` option (`Output.object({
schema })`, confirmed against `declare const object: <OBJECT>({ schema, name?,
description? }) => Output<OBJECT, ...>` in the type declarations) that binds
the model's **final** response — after it's done calling `tools` — to a Zod
schema, surfaced as `result.output` (throws `NoOutputGeneratedError` if the
model never converges within `stopWhen`'s step limit). This is the SDK's own
native mechanism for exactly the shape `diagnose()` needed, and is strictly
less code than the schema-only `submitDiagnosis` tool trick built earlier in
this same stage (a tool with no `execute`, whose call had to be manually
located in `result.toolCalls` and re-parsed).

### What changed

- **`diagnostics.service.ts`** — removed the `submitDiagnosisTool` construction
  entirely; `tools` now only contains the two real investigative tools
  (`getHistoricalBaseline`, `getHardwareManual`). Added `output:
  Output.object({ schema: diagnosisProposalSchema })` to the `generateText()`
  call. Replaced the `result.toolCalls.find(...)` extraction with a `try {
  rawOutput = result.output } catch` that catches `NoOutputGeneratedError`
  specifically and rethrows the same clear step-limit error message as
  before (naming `finishReason`) — any other error still propagates
  unchanged. The system prompt's "then call submitDiagnosis exactly once"
  instruction was simplified to "then provide your diagnosis," since the
  model no longer needs to know about a specific tool name to finish — it
  just stops calling tools and answers, and the SDK enforces the schema on
  that answer. The defensive `diagnosisProposalSchema.parse(...)` re-check
  stayed, now applied to `rawOutput` instead of a tool call's `input`.
- **`diagnostics.service.spec.ts`** — mock `ai` module gained `Output: {
  object: (config) => config }` (inert passthrough, same treatment as `tool`)
  and a `MockNoOutputGeneratedError` class (declared before `jest.mock()`,
  same initialization-order reason as `mockGenerateText`). The "step limit
  exceeded" test now mocks `generateText`'s resolved value with a getter
  (`get output() { throw new MockNoOutputGeneratedError(...) }`) instead of
  an empty `toolCalls` array, mirroring how the real SDK object's `output`
  property actually behaves (a throwing accessor, not a plain field). Same 4
  test cases, same coverage, updated to the new shape.
- **`tools/get-historical-baseline.tool.ts`** and
  **`tools/get-hardware-manual.tool.ts`** — unchanged. Their own `tool()`
  calls are real investigative tools with a real `execute`, not the pattern
  being replaced.
- **`AGENTS.md`** — "Building an AI feature" section's third bullet under
  "Rules that don't bend" (the schema-only final-answer-tool guidance)
  replaced with a rule pointing at `output: Output.object({ schema })` +
  `result.output` as the native mechanism for a tool-calling loop ending in
  structured output, citing this file as the reference. The
  `<feature>.service.spec.ts` line in the folder-shape block updated to
  mention mocking `Output.object` alongside `tool()`/`stepCountIs`.

### Verification

- `pnpm typecheck` — 4/4 pass.
- `pnpm test` — 11 suites, 58 tests pass (same count as before this
  refinement — no tests added or removed, four rewritten to match the new
  mock shape).
- `pnpm build` — all 3 packages succeed.
- Compiled backend boot — reaches `DiagnosticsModule dependencies
  initialized` with no DI error, then the same correct `ECONNREFUSED`, same
  as every prior boot smoke test in this file.
- Standalone runtime script (same discipline as the ESM verification above)
  — confirmed `Output.object()` and `NoOutputGeneratedError` both resolve as
  real values via `await import('ai')` under the real compiled-CommonJS
  runtime, not just Jest's manual mock.

### Still pending

- Same as the entry above — no live model/database/Redis in this
  environment, Stage 6 still owns surfacing `PENDING_APPROVAL` rows to a
  human, and this stage remains **uncommitted**.

---

## 2026-08-12 — New package: `packages/ai-config`, replacing a real duplication

Prompted by a direct question about whether the model registry should live
somewhere shared, "like stagewise has." Checked the actual
`stagewise-io/stagewise` GitHub repo before answering rather than guessing:
its `packages/` directory (`agent-core`, `agent-shell`, `icons`, `karton`,
`stage-ui`, `tailwindcss-color-modifiers`, `typescript-config`) has no
`ai-config`-shaped package — makes sense for that project, since it's an IDE
where the user connects *any* provider at runtime, not a small fixed
registry baked into the build. So the premise as stated wasn't quite right —
but the underlying instinct was: checking `apps/web/src/app/api/chat/route.ts`
turned up a real, already-existing duplication of `apps/api`'s
`model-registry.ts` — its own hand-rolled `createOpenAI({ baseURL:
'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })`
plus a hardcoded `'nvidia/nemotron-nano-12b-v2-vl:free'` model id, which is
byte-for-byte the same OpenRouter setup as the registry's
`'openrouter:nemotron-nano-12b-v2-vl-free'` entry — just copied by hand into
a second file in a second app. This is exactly the "concrete need" the
Stage 2 plan entry (see above) said would justify a `packages/ai-config`
split later, rather than speculatively up front.

### Why not fold it into `packages/shared`

`packages/shared` gets bundled into `apps/web`'s browser build the moment a
client component imports a derived type from it. `resolveModel()` does
server-only things — dynamic `import()` of provider SDKs, reads secret
provider API keys from `process.env` — that must never end up in client JS.
A separate package, imported only by server-side code (NestJS services,
Next.js Route Handlers — both run in Node, never the browser), keeps that
boundary intact rather than relying on every future contributor remembering
not to import it from a client component.

### What changed

- **New package `packages/ai-config/`** (`@gridstream/ai-config`) — same
  shape as `packages/shared`: `package.json`, `tsconfig.json` (`module:
  commonjs`, matching both consumers' own module system), `src/model-
  registry.ts` (moved from `apps/api/src/common/ai/model-registry.ts`
  verbatim except for a doc-comment update generalizing "apps/api compiles
  to CommonJS" to name both current consumers), `src/index.ts` re-exporting
  it. Depends directly on `ai`, `@ai-sdk/groq`, `@ai-sdk/openai`,
  `@ai-sdk/anthropic` — the only place any of these get imported, now across
  *both* apps, not just `apps/api`.
- **`apps/api`** — deleted `src/common/ai/` (now empty). `diagnostics.service.ts`,
  `diagnostics.service.spec.ts` (`jest.mock()` path updated), and
  `users.service.ts` now import from `@gridstream/ai-config` instead of the
  relative `../../common/ai/model-registry` path. `package.json`: added
  `@gridstream/ai-config: workspace:*`, removed the now-unused direct
  `@ai-sdk/anthropic`/`@ai-sdk/groq`/`@ai-sdk/openai` dependencies (`ai`
  itself stays — `diagnostics.service.ts` and the tool files still call
  `generateText`/`tool`/`Output` directly, that's the core SDK, not a
  provider).
- **`apps/web`** — `src/app/api/chat/route.ts` no longer imports
  `@ai-sdk/openai` or constructs its own OpenRouter client; it now calls
  `resolveModel(DEFAULT_MODEL_KEY)` from `@gridstream/ai-config`. Since
  `DEFAULT_MODEL_KEY` already *is* the OpenRouter free vision model this
  route was hardcoding, the route needs no model id of its own anymore — it
  automatically stays in sync with whatever `apps/api` treats as the
  default. The existing `OPENROUTER_API_KEY` presence check at the top of
  `POST()` was left as-is (still accurate: that's the exact env var
  `resolveModel`'s `'openrouter'` branch reads). `package.json`: added
  `@gridstream/ai-config: workspace:*`, removed `@ai-sdk/openai` (no longer
  used directly) and `@ai-sdk/groq` (confirmed via grep to have had zero
  imports anywhere in `apps/web/src` even before this change — pre-existing
  dead dependency, removed as a minor byproduct of touching this file
  rather than a change of its own). `tsconfig.json` got a
  `@gridstream/ai-config` path alias matching the existing `@gridstream/shared`
  one. `apps/web`'s system prompt still says "maintain-agent, an AI-powered
  industrial maintenance planner" — left untouched, same as every prior
  mention of this in this file: a content/copy pass, not a wiring concern,
  explicitly out of scope here.
- **`AGENTS.md`** — "What this is" now mentions `packages/ai-config`
  alongside `packages/shared`. Structure section: removed the `src/common/ai/`
  line from `apps/api`'s tree, added a `packages/ai-config/` block (mirroring
  `packages/shared/`'s), and a line under `apps/web/`'s tree noting
  `api/chat/route.ts` as its one AI-calling file. New rule added alongside
  the existing `packages/shared` browser-bundling rule: `packages/ai-config`
  is server-side-only, never imported from a client component. "Model access
  is centralized, permanently" paragraph and the LSP bullet under SOLID both
  updated to the new path and explicitly note both apps resolve through the
  same registry now. (Also fixed a stale "schema-only submit tool" mention
  left over in the Structure section's `diagnostics/` description from
  before the `Output.object()` refinement above — should have been updated
  in that entry, caught here instead.)

### Verification

- `pnpm install` — picked up the new workspace package (`Scope: all 5
  workspace projects`, up from 4).
- `pnpm typecheck` — 4 packages now (`@gridstream/ai-config` included), all
  pass.
- `pnpm test` — 11 suites, 58 tests pass, same count — `users.service.spec.ts`
  needed no mock changes (it exercises `MODEL_REGISTRY`/`DEFAULT_MODEL_KEY`
  as plain values, which import fine statically; only `resolveModel()`'s
  *internal* dynamic imports are the ESM-only concern, and that function
  isn't called from that spec).
- `pnpm build` — all 4 packages succeed, `apps/web`'s `/api/chat` route
  still compiles.
- Compiled backend boot — reaches both `UsersModule` and `DiagnosticsModule`
  `dependencies initialized` with no error, then the same correct
  `ECONNREFUSED`, confirming `@gridstream/ai-config` resolves correctly as a
  real workspace package at compiled CommonJS runtime, not just under `tsc`.
- Standalone runtime script — called `resolveModel('groq:compound-mini')`
  from the relocated package directly (not just confirming the module
  loads) and got back a real model object
  (`{"specificationVersion":"v4",...,"modelId":"groq/compound-mini",...}`),
  proving the dynamic-import-of-ESM-only-provider pattern still works
  correctly from its new package location, not just that NestJS's DI
  container didn't crash on the static import.

### Still pending

- `apps/web`'s chat route still can't be live-tested end-to-end (no
  `OPENROUTER_API_KEY` in this environment) — verification here is limited
  to "compiles and the shared resolution path is proven correct in
  isolation," same ceiling as every other AI-calling code in this repo so
  far.
- This stage is **uncommitted**, same as everything else in this file.

---

## 2026-08-12 — Fixed a pre-existing invalid `modelKey` column default

Found while relocating `model-registry.ts` above: `users.modelKey`'s Drizzle
column default was `'groq:llama-4-scout'`, which has never been a valid
`MODEL_REGISTRY` key (valid Groq keys are `'groq:compound-mini'`,
`'groq:compound'`, `'groq:qwen3.6-27b'`) — predates this stage, not
introduced by it. Currently unreachable in practice: `UsersService.getSettings()`
reads `user?.modelKey || DEFAULT_MODEL_KEY` (a JS-level fallback that wins
before the DB default ever matters for a read), and `updateSettings()`'s
insert always sets `modelKey` explicitly (`(updates.modelKey as ModelKey) ??
DEFAULT_MODEL_KEY`) — so no code path today actually inserts a row relying
on the column default. Still a landmine: `resolveModel()` would throw
reading `.provider` off `undefined` the moment anything ever did rely on it
(a raw insert, a future migration script, a different future caller).

### What changed

- **`packages/shared/src/db/schema.ts`** — `modelKey`'s default changed to
  `'openrouter:nemotron-nano-12b-v2-vl-free'`, the same value as
  `@gridstream/ai-config`'s `DEFAULT_MODEL_KEY`. Added a comment explaining
  why it's a literal instead of an import: `packages/shared` can't depend on
  `packages/ai-config` (the former is bundled into `apps/web`'s browser
  build, the latter is deliberately server-only), so this value has to be
  kept in sync by hand rather than referencing the constant directly — the
  tradeoff accepted for keeping the browser-bundle boundary from the ai-config
  entry above intact.
- **Migration regenerated from scratch** — the previous migration
  (`0000_eminent_apocalypse.sql`) was never applied to any database (no
  `DATABASE_URL` in this environment, same as every previous migration
  regeneration in this file), so there was no live schema to preserve or
  incrementally `ALTER`. Deleted it and its snapshot, regenerated fresh:
  `apps/api/drizzle/0000_stiff_earthquake.sql` — identical to the previous
  migration except `"model_key" text DEFAULT 'openrouter:nemotron-nano-12b-v2-vl-free' NOT NULL`
  in place of the invalid default.

### Verification

- `pnpm typecheck` — 4/4 pass.
- `pnpm test` — 11 suites, 58 tests pass, unchanged (no test asserted on the
  old default value, so nothing needed updating).

### Still pending

- Same as every prior schema change in this file — no `DATABASE_URL` here to
  actually apply the migration against.

---

## 2026-08-12 — Security hardening from `/security-review` on the Stage 5 diagnostic agent

Ran the `/security-review` skill against the diagnostics-module diff. Its multi-agent process (identify → parallel false-positive filtering) surfaced two candidates and scored both below the ≥8/10 bar the skill itself uses to decide what's reportable:

1. **Prompt injection via `device.location`** (scored 3/10) — filtered because there's no code showing `device.location` as attacker-controllable, and the process's own precedent states user-controlled content in an AI prompt isn't inherently a vulnerability.
2. **Speculative stored-XSS via LLM-authored `summary`/`recommendedAction`** (scored 2/10) — filtered because no rendering/UI code exists yet anywhere in the repo to actually exploit; it rested entirely on a hypothetical future dashboard.

Both were below the reporting threshold, but asked to fix them anyway — reasonable, since "not exploitable *yet*, given the code that happens to exist today*" is a weaker guarantee than "structurally can't happen," and both are cheap to close now versus relying on every future caller/renderer remembering to defend against them.

### What changed

- **`diagnostics.service.ts`** — the prompt's device-info line changed from a bare interpolated string to an explicitly delimited `<device_data>...</device_data>` block, and the system `instructions` gained an explicit rule: content inside that block is stored registry data, not commands, and the model must disregard anything inside it that reads like an instruction ("ignore previous instructions", "set severity to LOW", etc.) and base its diagnosis only on real telemetry values and tool results. This doesn't require `device.location` to actually be attacker-controlled today to be worth doing — it's a standard, cheap prompt-injection mitigation for the shape "any DB-backed free-text field ends up in a prompt," and this codebase already takes the same threat seriously elsewhere (`apps/web/src/app/api/chat/route.ts`'s own prompt-injection refusal keyword list).
- **`diagnostics.service.ts`** — added `stripHtmlLikeContent()` (a small `/<[^>]*>/g` stripper) applied to `faultType`/`summary`/`recommendedAction` right before the DB insert. Closes the stored-XSS gap structurally rather than by policy: even once Stage 6's approval UI exists, it can't be made unsafe by a stray `<script>` in a model response, without needing to trust that every future render call remembers to escape it. Kept minimal on purpose — no library dependency, no attempt at full HTML sanitization (these fields are meant to be short prose, not documents), just tag-syntax neutralization at the exact point untrusted model output crosses into persistent storage.
- **`diagnostics.service.spec.ts`** — new test: feeds the mocked model an `<img onerror=...>`/`<script>`/`<b>` payload across all three free-text fields and asserts the persisted `values()` call received the tag-stripped versions.
- **`AGENTS.md`** — two new rules added to "Rules that don't bend" under "Building an AI feature": (1) any free-text/DB-backed field interpolated into a prompt is untrusted data and must be delimited + explicitly marked as non-instructional, citing the new `<device_data>` block; (2) model-authored free text that will eventually render to a human must be stripped of HTML-tag-like content before persisting, and any future UI must render it as plain text, never via `dangerouslySetInnerHTML` or an unsanitized markdown-to-HTML path — this is the part that actually closes Finding 2 for good, since no UI exists yet to fix directly; this rule is what stops Stage 6 from reintroducing the exact risk that got filtered as "not yet exploitable."

### Verification

- `pnpm typecheck` — 4/4 pass.
- `pnpm test` — 11 suites, 59 tests pass (1 new — the sanitization test; caught its own test-setup bug along the way, a mock insert row missing `deviceId`, fixed before the suite went green).
- `pnpm build` — all 4 packages succeed.
- Compiled backend boot — same clean `DiagnosticsModule dependencies initialized` → correct `ECONNREFUSED` pattern as every prior stage.

### Still pending

- No live model to confirm the `<device_data>` instruction actually changes real model behavior against a crafted `location` value — verified only that the code compiles, persists tag-stripped content correctly, and that the prompt structure itself is correct; the model-following-instructions half of this can't be tested without live provider credentials, same ceiling as every other AI-calling code in this repo.

**Note on "uncommitted":** Stages 3–5 above were, at time of writing, actually already committed and merged (PRs #1–#3) — the "uncommitted"/"commit pending" language in those entries had gone stale relative to the real repo state, since commits/merges happen outside this assistant's own actions (this assistant has never run `git commit`, per standing instruction) and weren't being tracked back into this file as they landed. Corrected in the status table above. Going forward, entries in this file describe what was *built and verified*, not commit status — check `git log`/`git status` directly for the latter.

---

## 2026-08-12 — Stage 6: Next.js VPP Dashboard & HITL UI

Closes the gap every prior stage has pointed at: `FaultDiagnostic` rows have been reaching `PENDING_APPROVAL` since Stage 5 with nothing to see or act on them. This stage adds the dashboard surface and the two decisions confirmed with the user before building it: **real backend auth** (not the existing open trust model) for the new endpoints, and **scope = Alerts queue + Devices overview** (no telemetry charts/device-detail views yet).

### Backend (`apps/api`)

- **New `src/common/auth/`** — `ClerkAuthGuard` (`CanActivate`) verifies a Clerk session JWT via `@clerk/backend`'s `verifyToken()`, reading `Authorization: Bearer <token>`; fails closed if `CLERK_SECRET_KEY` isn't configured (throws immediately, doesn't let requests through unverified). `ClerkUserId` (`createParamDecorator`) exposes the verified identity to controllers. `@clerk/backend@2.33.0` was already resolvable (transitive dep of `@clerk/nextjs`) and — checked before assuming otherwise, given this session's repeated ESM-only pain with the AI SDK packages — ships a real CommonJS build, so no dynamic-import workaround was needed; a plain static import and a plain `jest.mock()` both worked immediately.
- **`packages/shared/src/db/schema.ts`** — added `approvedAt`/`approvedBy` (both nullable) to `faultDiagnostics`, deferred since Stage 3 specifically for this. Used for both approve *and* reject — represents "who/when a human last decided this," not approval specifically. Migration regenerated from scratch (`0000_woozy_susan_delgado.sql`), same as every prior schema change in this file, since nothing's ever been applied to a live database here.
- **`packages/shared/src/schemas/`** — first real use of this directory (left empty since Stage 3 for exactly this): `diagnostics.schema.ts` (`faultDiagnosticWithDeviceSchema`, `diagnosticsListResponseSchema`) and `devices.schema.ts` (`devicesListResponseSchema`) — composite API response shapes that aren't 1:1 with a table row, per AGENTS.md's rule.
- **`DiagnosticsService`** gained `listDiagnostics()`, `approve()`, `reject()`. `listDiagnostics()` is the first real caller of Drizzle's relational query API (`db.query.faultDiagnostics.findMany({ with: { device: true } })`) — wired since Stage 3's `faultDiagnosticsRelations` but never used until now; every other query in this codebase uses the fluent `.select().from()` builder instead. `approve()`/`reject()` share an atomic conditional-update implementation (`UPDATE ... WHERE status = 'PENDING_APPROVAL'`) rather than read-then-write, specifically so two operators racing to decide the same diagnostic can't both succeed; a follow-up read on a no-op update distinguishes 404 (doesn't exist) from 409 (already decided) instead of one generic error either way.
- **New `DiagnosticsController`** (`GET /diagnostics`, `PATCH /diagnostics/:id/approve`, `PATCH /diagnostics/:id/reject`) and **new `DevicesModule`** (`devices.service.ts` + `devices.controller.ts`, `GET /devices`) — both guarded by `ClerkAuthGuard`. Query params validated with an inline Zod schema per controller (a DTO used by one endpoint stays inline, per the minimal-footprint rule) rather than wiring up the still-unused `nestjs-zod` dependency. `DiagnosticsModule`/`DevicesModule` both now imported at the `app.module.ts` top level — `DiagnosticsModule` was previously only pulled in transitively via `TelemetryIngestionModule`, which registers its provider but not its (now-existing) controller.
- **`main.ts`** — CORS tightened from `app.enableCors()` (wide open, any origin) to `app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true })`, directly motivated by adding endpoints worth protecting.

### Frontend (`apps/web`)

No backend-fetch pattern existed anywhere in this app before this stage — confirmed via exploration: `products`/`overview` use fake in-memory data, TanStack Query was wired in `providers.tsx` but never actually used for a real query.

- **New `src/lib/api-client.ts`** — `apiFetch()`, the first (and only) HTTP client to `apps/api`. Attaches the caller's Clerk session token as a bearer token; the backend's `ClerkAuthGuard` verifies it.
- **`src/features/diagnostics/`** — `hooks/use-diagnostics.ts` (`useDiagnosticsQuery` with `refetchInterval` polling — no websocket/queue-to-frontend infra exists, polling is the honest simple option for near-live updates on a human-review queue; `useApproveDiagnosticMutation`/`useRejectDiagnosticMutation`, invalidating the list on success), `components/columns.tsx`, `components/diagnostic-actions.tsx` (reuses the existing `AlertModal` confirmation pattern from `product-tables/cell-action.tsx`), `components/diagnostics-listing.tsx` (status-filter `Tabs` + the existing `DataTable` shadcn primitive).
- **`src/features/devices/`** — same shape, read-only, no actions column.
- **Deliberate deviation from the `products` feature's table pattern**: `products` drives pagination/filtering through `nuqs`-backed URL state via the `useDataTable` hook (`shallow: false`, triggering a full Next.js navigation/refetch on every page change) — appropriate for a server-rendered catalog, not for a live-refreshing, mutation-heavy queue. `DataTable`/`DataTablePagination` themselves turned out to be decoupled from `nuqs` (they just take a `table` prop), so this stage reuses those directly with a plain `useReactTable()` call and client-side pagination instead of pulling in the nuqs-coupled hook. The backend still supports `limit`/`offset` server-side pagination if a fleet ever outgrows a single fetched page (currently fetches `limit=100` per status tab) — the UI just doesn't need that complexity yet.
- **Routes**: `app/dashboard/alerts/page.tsx`, `app/dashboard/devices/page.tsx` — `PageContainer` wrapper matching `dashboard/product/page.tsx`'s shape. No `<Suspense>` boundary around the client listing components: a plain `useQuery()` never suspends (that's `useSuspenseQuery`'s job), so wrapping it in `Suspense` would have been dead weight that looked functional but wasn't — caught and removed before verification.
- **Nav**: two new `nav-config.ts` entries ("Active Alerts" → `/dashboard/alerts`, icon `warning`; "Devices" → `/dashboard/devices`, icon `devices`, a new `IconServer2` key added to `components/icons.tsx`, confirmed to exist in the installed `@tabler/icons-react` version before using it).

### Verification

- `pnpm typecheck` / `pnpm test` (72 tests, 13 new) / `pnpm build` — all pass across all 4 packages.
- Compiled backend boot smoke test — `DiagnosticsModule`/`DevicesModule` both reach `dependencies initialized` cleanly (confirming `@clerk/backend` resolves fine at real CommonJS runtime), then the same correct `ECONNREFUSED`, same discipline as every prior stage.
- **Frontend UI verification, and its real limits**: no browser automation tool was available this session, and `/dashboard/*` is Clerk-gated with no live Clerk credentials in this environment — a full interactive browser check wasn't possible, and that limitation is stated here rather than glossed over. What *was* verified: started the dev server and confirmed both new routes render their correct titles server-side with no error markers; confirmed (by checking pre-existing routes like `/dashboard/chat` behave identically) that the unauthenticated-request behavior is this environment's pre-existing Clerk keyless-mode setup, not something the new routes broke.

### Housekeeping found along the way

- `packages/ai-config/dist/*` was tracked in git despite the intent for it to be build output — same issue Stage 2 fixed for `packages/shared/dist`. Added to `.gitignore`, untracked with `git rm --cached` (files stay on disk).

### Still pending

- No live `DATABASE_URL`/`CLERK_SECRET_KEY`/backend running in this environment to exercise a real approve/reject click end-to-end.
- Telemetry charts and a device-detail view were explicitly deferred out of this stage's confirmed scope.
- Stage 7 (documentation, cleanup, final CI verification) is what's left on the original master plan.

---

## 2026-08-12 — Stage 7: Documentation, cleanup, final CI verification

The last stage on the original master plan. No new features — this pass finds and closes every doc/cleanup item this file itself has been flagging as deferred since as far back as the Stage 1 audit ("Candidate for deletion in Stage 7, not touched now"), plus a full accuracy pass over every doc now that the product is functionally complete end to end.

### Deleted — dead weight found along the way

- **`goal.md`** (root) — the original `maintain-agent` product brief: `MachineProfile`, `ComplianceService`, Prisma, `@maintain/shared`, GDPR-for-maintenance-reports. Entirely superseded by `README.md`/`AGENTS.md`/`REFACTOR_PROGRESS.md` and, worse, actively wrong about what this project is. Flagged as "historical/unmaintained" multiple times earlier in this file; never acted on until now.
- **`apps/web/__CLEANUP__/`** — the starter template's own feature-flag stripper (scripts + "after removal" templates for optionally stripping Clerk/Kanban/Sentry). This app deliberately *keeps* Clerk and Sentry — neither was ever a removal candidate — and the folder's own `cleanup.md` says to delete it once done. Flagged as a "Stage 7 candidate" since the very first cleanup pass; deleted now.
- **`apps/web/README.md` and `apps/web/AGENTS.md`** — found during this pass, not previously flagged: the *original, untouched* `next-shadcn-dashboard-starter` docs, sitting inside `apps/web/` this entire time. Generic SaaS-dashboard branding, recommends **Bun** as the package manager (this monorepo uses pnpm exclusively, root `AGENTS.md` says so explicitly), documents Kanban/Sentry/Clerk-Organizations features not part of this domain, and referenced the now-deleted `__CLEANUP__` folder. A coding agent poking around `apps/web/` could easily have picked up `apps/web/AGENTS.md` and followed genuinely wrong guidance (Bun over pnpm) from it. `apps/web/LICENSE` (MIT, © Kiranism) was **kept** — that's a real attribution requirement the starter's license imposes; the docs aren't, and root `README.md`'s Acknowledgments section already credits the starter by name and link.
- **`apps/api/README.md`** — default `nest new` CLI scaffolding, zero project-specific content, no attribution requirement (unlike the web starter, this is just generator output, not a licensed template).

### Fixed — stale copy and config

- **`apps/web/src/app/api/chat/route.ts`** — system prompt, refusal message, and security-policy wording all still described "maintain-agent, an AI-powered industrial maintenance planner" and "maintenance reports, machine profiles, measures, and project plans." Rewritten for the actual domain: devices, telemetry, fault diagnostics, the Active Alerts approval workflow. Deliberately honest about what the chat assistant *can't* do — it has no live tool access to a user's actual device/alert data (no tools are wired to this route), so the prompt explicitly tells it to say so and point at the real dashboard pages rather than let it hallucinate device status.
- **`apps/web/src/app/dashboard/chat/chat-view.tsx`** — the three suggestion-chip prompts were still maintenance-domain ("What maintenance measures are available?", "How is confidence calculated?", "What does plan approval do?"). Replaced with VPP-relevant ones.
- **`.github/workflows/ci.yml`** — the `DATABASE_URL` env var on the install step carried a comment explaining it was needed because "`prisma generate` (runs via postinstall)... needs a syntactically valid `DATABASE_URL`" — Prisma was removed from this codebase stages ago, and neither the root nor `apps/api`'s `package.json` has a `postinstall` script anymore. Verified directly rather than assumed: ran `pnpm install --frozen-lockfile` locally with no `DATABASE_URL` set at all — clean, confirming the env var was genuinely unnecessary, not just the comment being stale. Removed it. **Added a `Build` step** (`pnpm build`) — CI previously only ran typecheck + test, never a real build; this session repeatedly found real bugs (TS2742 declaration-emit errors, ESM-only-package issues) that surfaced at build/boot time, not always at plain `tsc --noEmit` time, so CI not building at all was a real gap for a "final CI verification" pass to close, not scope creep.
- **`README.md`** — full accuracy pass now that Stage 6 shipped:
  - Node badge said `>=18.0.0`; AI SDK 7 has required Node ≥22 since the Stage 4/5 upgrade. Fixed.
  - "Where this project is right now" still said the dashboard was "still ahead" and diagnostics "just sit in the database" — both wrong since Stage 6. Rewritten to state the loop works end to end, with an honest "What's not built yet" list (telemetry charts/device-detail view, severity-based auto-triage, broader backend authorization beyond the two guarded controllers, frontend test coverage) replacing the vague "still ahead" framing.
  - The "Target architecture" section was explicitly captioned "the *plan*, not current behavior" and included a fictional severity-based auto-triage branch (`Auto-Log System Ticket` for low severity) that was never actually implemented — every diagnosis goes to `PENDING_APPROVAL` regardless of severity, unconditionally. Replaced with "How a fault gets diagnosed and approved," a corrected diagram matching the real, verified pipeline (including the atomic conditional-update approve/reject mechanism and the swallowed-trigger-error resilience behavior), since the plan is now real rather than aspirational.
  - "Tech Stack" claimed "Auth: Clerk (frontend-only — no backend session/RBAC layer yet)" — no longer true; `ClerkAuthGuard` now does real backend session verification on two controllers. Corrected, including the honest caveat that it checks for *a* valid session, not role/permission, and other backend endpoints (`UsersController`) still use the older unverified trust model.
  - Repo Structure tree gained the `diagnostics`/`devices`/`common/auth` backend modules and `apps/web`'s `lib/api-client.ts`/`features/diagnostics`/`features/devices`, none of which existed when that tree was last accurate.
  - Environment variable instructions gained `CLERK_SECRET_KEY`/`FRONTEND_URL` (backend) and `NEXT_PUBLIC_API_URL` (frontend) — all added in Stage 6, never documented in the setup instructions. Also fixed the frontend env file name (`env.example.txt`, not `.env.example` as the doc claimed) and the `db:generate` comment's stale path (`apps/api/src/common/db/schema.ts` — that file hasn't existed since Stage 3 moved it to `packages/shared`).
- **`CONTRIBUTING.md`** — still titled "Contributing to maintain-agent," linked `github.com/m-ahmedbashir/maintain-agent/issues` (wrong repo), used `pnpm --filter frontend`/`backend` (the actual filter names are `@gridstream/web`/`@gridstream/api`), pointed at a `README.md#-roadmap` section that doesn't exist, claimed Zod schemas "stay `.strict()`" (checked — genuinely never true, `.strict()` isn't used anywhere in `packages/shared`), and listed "good first issues" that were either already done (a provider-agnostic model registry — that's `packages/ai-config` now) or referenced deleted code (`extraction.service.ts`). Rewritten wholesale: correct repo name/filters, pre-PR checklist now includes `pnpm build` (matching the new CI step), and the "good first issues" list replaced with real current gaps pulled from README's "What's not built yet" section rather than invented ones. Confirmed `next lint`'s broken-in-Next-16 claim is still accurate before carrying it forward, rather than assuming.
- **`CODE_OF_CONDUCT.md`** — checked, genuinely generic Contributor Covenant boilerplate with no domain-specific content. Left as-is.

### Verification

- `pnpm install --frozen-lockfile` with no `DATABASE_URL` set — clean (validates the CI env-var removal above).
- `pnpm typecheck` / `pnpm test` (72 tests) / `pnpm build` — all pass across all 4 packages, matching exactly what the updated CI workflow now runs.
- Compiled backend boot smoke test — same clean `DiagnosticsModule`/`DevicesModule` → correct `ECONNREFUSED` pattern as every prior stage.
- Grepped the full repo for `__CLEANUP__`/`goal.md`/`maintain-agent`/`@maintain/`/`MachineProfile`/`Prisma` references after every deletion and rewrite — nothing dangling.

### Still pending

- No live database/Redis/Clerk credentials in this environment, same ceiling as every stage before this one — nothing here changes that. **Update, same day:** this changed — see the two dated entries below, where live `DATABASE_URL`, `REDIS_URL`, and `CLERK_SECRET_KEY` all landed and got verified end to end for the first time.
- The "What's not built yet" items in `README.md` (telemetry charts, device-detail view, severity-based auto-triage, broader backend authorization, frontend test coverage) are genuine open work, not blockers — they were never in scope for any of the 7 stages on the original master plan.
- All 7 stages of the original master plan are now done. Future work is genuinely new scope, not a pending stage.

---

## 2026-08-15 — Live infrastructure: real Postgres, Clerk, and Redis for the first time

Every verification in this file up to this point used deliberately-fake credentials (an unreachable `DATABASE_URL`, no `CLERK_SECRET_KEY`/`REDIS_URL` at all) — genuinely useful for catching DI/ESM/boot-order bugs, but it meant nothing in this project had ever actually run against live infrastructure. That changed this session: a real Neon `DATABASE_URL`, real Clerk test-instance keys, and a real Upstash `REDIS_URL` were added to `apps/api/.env` / `apps/web/.env`, and each was verified working directly rather than assumed.

### What changed

- **`pnpm db:migrate`** applied the existing migration to the real database — first successful live migration this project has had.
- **`pnpm db:seed`** — failed on the first real attempt (`ECONNREFUSED`), surfacing a genuine, previously-latent bug: `scripts/seed-devices.ts` is a standalone script outside Nest's DI container, so it never went through `ConfigModule.forRoot()` (the thing that auto-loads `.env` for the real app) — `process.env.DATABASE_URL` was silently `undefined`, and `pg.Pool` fell back to connecting to `localhost:5432`. Fixed by switching the script's invocation to Node's native `--env-file=.env` flag (Node ≥22 already required here, so no new dependency) combined with the `-r ts-node/register` pattern `test:debug` already used elsewhere in this file. Re-ran clean — 4 demo devices seeded and confirmed via a direct query.
- **`BYOK_ENCRYPTION_KEY`** was still the literal placeholder text in `apps/api/.env`, not a real key — generated a real one (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")`, safe to do since no BYOK key had ever been saved against the placeholder.
- **`apps/web/.env`** didn't exist yet — created from `env.example.txt` with the real Clerk keys filled in. Along the way, found and fixed a second stale doc bug: `env.example.txt` said `GROQ_API_KEY` was required for chat responses, left over from before the ai-config migration moved the chat route onto `DEFAULT_MODEL_KEY` (currently OpenRouter) — corrected to `OPENROUTER_API_KEY`, reusing the same key already in `apps/api/.env` (same personal account).
- **`REDIS_URL`** — Upstash requires TLS; the value had to use the `rediss://` scheme (not `redis://`), which `ioredis` auto-detects and enables TLS for automatically. Verified directly with a throwaway PING/SET/GET script before trusting it.
- **Live verification, not assumption, for every piece**: booted the compiled backend against the real `DATABASE_URL` — `✅ Database connection verified`, all routes mapped. Hit `GET /devices` with no token and with a garbage token — both correctly `401`, proving `ClerkAuthGuard`'s `verifyToken()` is genuinely round-tripping to Clerk's real API, not a stub. Started the frontend dev server with the real Clerk keys and confirmed `/dashboard/*` is now actually gated (`x-clerk-auth-status: signed-out`, real redirects) — a real behavior change from the earlier keyless-mode test, where every dashboard route returned `200` with no protection at all.

### Verification

- `pnpm typecheck` / `pnpm test` / `pnpm build` — unaffected (env/script changes only, confirmed via the fixed `db:seed` script's real run).
- Direct Postgres query confirmed all 4 seeded devices genuinely persisted.
- Direct Redis PING/SET/GET round-trip confirmed the Upstash connection works.
- `curl` against the real running backend confirmed `ClerkAuthGuard` correctly rejects missing/invalid tokens with `401`.

---

## 2026-08-15 — Simulate Chaos Event, per-alert telemetry chart, and a detail page

Two related asks: a demo control to trigger the ingestion → diagnosis → approval loop on demand (rather than waiting on the automatic simulator's 1-in-10 chance per tick), and a way to actually show *why* an alert fired — a telemetry chart, behind a per-alert detail page since "we're going to add some more things in there as well."

### Simulate Chaos Event

- **`generateReading()`** (`telemetry-reading-generator.ts`) gained a `forceAnomaly` parameter — skips the probability roll and always applies the anomaly branch. Explicitly confirmed with the user that this does *not* mean inserting a boolean flag anywhere: `isAnomalous()` only ever reads real sensor values (`batteryTempCelsius > 65`, `gridVoltage < 200`) — `forceAnomaly` is purely an internal control deciding whether `generateReading()` computes a genuine extreme number (e.g. `batteryTempCelsius: 78.3`) instead of a normal one. That real number is what lands in `telemetry_logs`, identical in shape to any organic anomaly.
- **`TelemetrySimulatorService.simulateChaosEvent()`** — new public method: picks a random device, forces an anomalous reading, enqueues it through the exact same BullMQ queue the automatic timer uses. Works regardless of `TELEMETRY_SIMULATOR_ENABLED` (that flag only gates the automatic background loop, not this explicit action).
- **New `TelemetryIngestionController`** (`POST /telemetry/simulate-chaos`, `ClerkAuthGuard`) — this module's first HTTP surface; previously producer/consumer-only.
- **Frontend**: `useSimulateChaosEventMutation()` + a `ChaosEventButton` in the Active Alerts page header (`pageHeaderAction`). The mutation resolves as soon as the job is *enqueued*, not once the agent finishes (that takes real LLM-call time) — a delayed `invalidateQueries` (6s) makes the resulting alert show up promptly instead of waiting on the normal 15s poll.
- **Live end-to-end proof, not just unit tests**: enqueued a real forced-anomaly job directly onto the live Redis queue while the compiled backend (with real DB/Redis/Clerk) was running, and watched it flow through the real consumer → real anomaly detection → a real `generateText()` call against the free OpenRouter model → a real `FaultDiagnostic` row. Took ~71 seconds (free-tier model latency, consistent with this file's own earlier note about free OpenRouter models being slow) but completed correctly: `status: PENDING_APPROVAL`, `approvedAt`/`approvedBy` both `null`, a coherent AI-written summary referencing the actual injected values. **This is the first real, live, end-to-end AI-generated diagnosis this project has ever produced** — left in the database as a genuine example alert rather than cleaned up.

### Historical telemetry seed

- **New `scripts/seed-telemetry-history.ts`** (`pnpm db:seed:history`) — backfills ~24h of plausible telemetry per device (one reading every 30 minutes, reusing `generateReading()` for realistic per-device-type values), inserted directly rather than through the queue (a bulk historical backfill isn't live ingestion, so there's no consumer/anomaly-trigger step to go through). Without this, `getHistoricalBaseline()` and the new chart both had nothing to show — every demo would cite "0 samples." Idempotent-lite: skips entirely if `telemetry_logs` already has any rows. Verified against the real database: 192 rows inserted (48 × 4 devices), correct per-device-type shape, ~8% organic anomaly rate (close to the expected 10%, left in deliberately — real 24h history isn't perfectly clean, and these don't retroactively trigger a diagnosis since they never pass through the queue consumer).

### Telemetry chart + alert detail page

- **Backend**: `DiagnosticsService.getDiagnosticById()` + `GET /diagnostics/:id`; `DevicesService.getDeviceTelemetryHistory()` + `GET /devices/:id/telemetry?hours=` (confirms the device exists first, so a bad ID gets a clear 404 instead of a chart that looks like "no data"). New `deviceTelemetryHistoryResponseSchema` in `packages/shared`.
- **`components/ui/table/data-table.tsx`** gained an optional `onRowClick` prop — a small, backward-compatible addition to the shared table primitive (used by both the diagnostics and, potentially, a future devices table). `DiagnosticActions`' buttons now stop click propagation, so clicking Approve/Reject inside a row doesn't also trigger row navigation.
- **New `TelemetryChart`** (`features/devices/components/telemetry-chart.tsx`) — an `AreaChart` (Recharts, following the existing `area-graph.tsx` shadcn-chart pattern) of the last 24h, with a `ReferenceLine` at the relevant safety threshold: battery temperature (65°C) for `BATTERY` devices, grid voltage (200V) for every other type — the same two thresholds `isAnomalous()` checks server-side, duplicated here only as display constants, not re-implemented logic.
- **New `/dashboard/alerts/[id]` route** (`DiagnosticDetail` component) — full diagnosis (severity, fault type, summary, recommended action, device info, decided-at), the telemetry chart, and the same `DiagnosticActions` reused from the list view. Explicitly scoped as a starting point for more content later, per the request.
- Clicking any row in the Active Alerts table now navigates to its detail page (`DataTable`'s new `onRowClick`).

### Verification

- `pnpm typecheck` — clean across all 4 packages. `pnpm test` — 80 tests pass (8 new: `forceAnomaly`, `simulateChaosEvent()` ×3, `getDiagnosticById()` ×2, `getDeviceTelemetryHistory()` ×2). `pnpm build` — all 4 packages succeed, `/dashboard/alerts/[id]` present in the route list.
- Compiled backend boot against real infra — `DiagnosticsController`/`DevicesController`/`TelemetryIngestionController` all show their new routes mapped (`GET /diagnostics/:id`, `GET /devices/:id/telemetry`, `POST /telemetry/simulate-chaos`).
- Frontend dev server against real Clerk keys — `/dashboard/alerts/[id]` for the real chaos-triggered `FaultDiagnostic` correctly 307-redirects to sign-in with the right `redirect_url` back to that exact page, identical behavior to every other `/dashboard/*` route — confirms the dynamic route is registered and gated correctly. Full authenticated rendering still can't be verified without a real browser session (no browser automation tool available this session) — stated rather than assumed.

### Still pending

- A dedicated device-detail page (drill in from the Devices list itself) — the chart currently only exists on the alert-detail page, reached via an alert, not via a device directly.
- Interactive browser verification of the new chart/detail page's actual rendering — structurally verified (routes, gating, data shape) but not visually confirmed in a real browser this session.

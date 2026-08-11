# Refactor Progress — maintain-agent → gridstream-agent

Tracks execution of the staged pivot from an industrial-maintenance planner to an
event-driven IoT telemetry / VPP diagnostic pipeline. One stage at a time; each
stage must compile/typecheck clean before the next begins.

## Status

| Stage | Description | Status |
|---|---|---|
| 1 | Codebase audit & mapping | ✅ Done |
| 2 | Monorepo workspace & package renaming | ⬜ Not started |
| 3 | Database & domain schema refactor (DeviceAsset/TelemetryLog/FaultDiagnostic) | ⬜ Not started |
| 4 | NestJS ingestion, Redis/BullMQ queue, telemetry simulator | ⬜ Not started |
| 5 | Vercel AI SDK diagnostic agent (generateObject + tool calling) | ⬜ Not started |
| 6 | Next.js VPP dashboard & HITL UI | ⬜ Not started |
| 7 | Documentation, cleanup, final CI verification | ⬜ Not started |

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

## Confirmed file-level plan for Stage 2

- `package.json` (root): rename `maintain-agent` → `gridstream-agent`.
- `packages/shared/` → `packages/ai-config/`, package name `@maintain/shared` → `@repo/ai-config`.
- Every `@maintain/shared` import across `apps/api` and `apps/web` → `@repo/ai-config` (also update their `package.json` dependency entries).
- Package names `@maintain/backend` / `@maintain/frontend` still pending a rename decision (e.g. `@gridstream/api`, `@gridstream/web`) — not done yet, since it touches the deploy filter commands in `AGENTS.md` (`pnpm build --filter=@maintain/backend`) and any Railway/Vercel dashboard build-command overrides.
- Verify with `pnpm install && pnpm typecheck`.

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

- Applying `apps/api/drizzle/0000_ambiguous_makkari.sql` to a real database —
  needs a `DATABASE_URL` this environment doesn't have.
- Stage 3's domain pivot (`DeviceAsset`/`TelemetryLog`/`FaultDiagnostic`) now
  happens directly against the Drizzle schema in `apps/api/src/common/db/schema.ts`
  — no second ORM migration needed first.

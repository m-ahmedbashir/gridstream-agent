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

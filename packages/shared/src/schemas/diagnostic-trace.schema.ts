import { z } from 'zod';

/**
 * Shapes for `faultDiagnostics.executionTrace`/`confidenceFactors` — both
 * `jsonb` columns in db/schema.ts. drizzle-zod maps any jsonb/json column to
 * a generic recursive `jsonSchema` regardless of the column's `.$type<T>()`
 * annotation (that annotation is TS-only, invisible to drizzle-zod's
 * runtime introspection), so these need to be hand-written here and used
 * both as the `.$type<T>()` argument in db/schema.ts and as the
 * createSelectSchema/createInsertSchema per-field override — same pattern
 * as telemetryLogInsertSchema's `timestamp: z.coerce.date()` override.
 */

export const executionTraceStepSchema = z.object({
  stepNumber: z.number(),
  toolName: z.enum(['getHistoricalBaseline', 'getHardwareManual']),
  input: z.record(z.string(), z.unknown()),
  output: z.unknown(),
});
export type ExecutionTraceStep = z.infer<typeof executionTraceStepSchema>;

/**
 * One entry per deterministic confidence signal (see
 * apps/api/src/modules/diagnostics/diagnostic-confidence.ts) — `points`/`max`
 * let the UI render "12/25" style bars, `detail` is a human-readable
 * explanation of what was actually observed for that signal.
 */
const confidenceFactorSchema = z.object({
  points: z.number(),
  max: z.number(),
  detail: z.string(),
});

export const confidenceFactorBreakdownSchema = z.object({
  deviationStrength: confidenceFactorSchema,
  baselineCorroboration: confidenceFactorSchema,
  manualCorroboration: confidenceFactorSchema,
  investigationCompleteness: confidenceFactorSchema,
});
export type ConfidenceFactorBreakdown = z.infer<typeof confidenceFactorBreakdownSchema>;

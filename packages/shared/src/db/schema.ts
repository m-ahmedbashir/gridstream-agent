import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgEnum, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  confidenceFactorBreakdownSchema,
  executionTraceStepSchema,
  type ConfidenceFactorBreakdown,
  type ExecutionTraceStep,
} from '../schemas/diagnostic-trace.schema';

/**
 * Single source of truth for every table shape in the app. Zod validation
 * schemas below are *derived* from these tables via drizzle-zod
 * (createSelectSchema/createInsertSchema), not hand-duplicated — one
 * definition, cascading to DB migrations, backend validation/types, and
 * frontend types. See AGENTS.md's "Type safety & single source of truth"
 * section.
 *
 * Lives in packages/shared (not apps/api) so apps/web can import the
 * derived Zod schemas/types directly. Safe to do: drizzle-orm/pg-core is
 * pure schema-builder metadata (table/column definitions) — no `pg`
 * driver, no native bindings, nothing that doesn't belong in a browser
 * bundle. The actual DB connection (pg.Pool) stays backend-only, in
 * apps/api/src/common/db/db.service.ts.
 */

// ── users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: text('clerk_id').notNull().unique(),
  planApprovalMode: text('plan_approval_mode').notNull().default('MANUAL_REVIEW'), // "AUTO_APPROVE" | "MANUAL_REVIEW"
  // Key into MODEL_REGISTRY (packages/ai-config/src/model-registry.ts). Must
  // match a real registry entry — this package can't import ai-config to
  // reference DEFAULT_MODEL_KEY directly (ai-config is server-only, this
  // schema is bundled into apps/web's browser build), so keep this literal
  // in sync with ai-config's DEFAULT_MODEL_KEY by hand.
  modelKey: text('model_key').notNull().default('openrouter:nemotron-nano-12b-v2-vl-free'),
  encryptedApiKey: text('encrypted_api_key'), // AES-256-GCM ciphertext (see apps/api/src/common/crypto/) — NEVER the plaintext key. Null = use the app's shared key.
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

// ── DeviceAsset ──────────────────────────────────────────────────────────────

export const deviceTypeEnum = pgEnum('device_type', ['SOLAR', 'BATTERY', 'HEAT_PUMP', 'WALLBOX']);

/**
 * Not part of the original spec (which only said "status") — a reasonable
 * minimal default set for device lifecycle state. Adjust freely; nothing
 * downstream depends on these exact three values yet.
 */
export const deviceStatusEnum = pgEnum('device_status', ['ONLINE', 'OFFLINE', 'MAINTENANCE']);

export const deviceAssets = pgTable('device_assets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceType: deviceTypeEnum('device_type').notNull(),
  serialNumber: text('serial_number').notNull().unique(),
  location: text('location'),
  status: deviceStatusEnum('status').notNull().default('OFFLINE'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const deviceAssetsRelations = relations(deviceAssets, ({ many }) => ({
  telemetryLogs: many(telemetryLogs),
  faultDiagnostics: many(faultDiagnostics),
}));

// ── TelemetryLog ─────────────────────────────────────────────────────────────

export const telemetryLogs = pgTable('telemetry_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id')
    .notNull()
    .references(() => deviceAssets.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { mode: 'date' }).notNull().defaultNow(),
  // Nullable: not every device type reports every metric (e.g. a WALLBOX
  // has no solarProductionKwh, a SOLAR-only site has no batterySoC).
  solarProductionKwh: real('solar_production_kwh'),
  batterySoC: real('battery_soc'),
  batteryTempCelsius: real('battery_temp_celsius'),
  gridVoltage: real('grid_voltage'),
});

export const telemetryLogsRelations = relations(telemetryLogs, ({ one }) => ({
  device: one(deviceAssets, { fields: [telemetryLogs.deviceId], references: [deviceAssets.id] }),
}));

// ── FaultDiagnostic ──────────────────────────────────────────────────────────

export const faultSeverityEnum = pgEnum('fault_severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const faultStatusEnum = pgEnum('fault_status', ['PENDING_APPROVAL', 'APPROVED', 'REJECTED']);

/**
 * The closed set of anomalies this system can actually detect (see
 * apps/api/src/modules/telemetry-ingestion/telemetry-thresholds.ts's
 * `classifyAnomaly()`) — which threshold breach triggered a diagnosis is
 * known deterministically before the AI agent ever runs, so `faultType`
 * below is this enum, not a model-authored free-text field. Single source
 * of truth for both the DB column and the getHardwareManual tool's own
 * `symptom` input schema (apps/api/src/modules/diagnostics/tools/get-
 * hardware-manual.tool.ts), which previously duplicated this set locally.
 */
export const anomalyKindEnum = pgEnum('anomaly_kind', ['THERMAL_RUNAWAY', 'VOLTAGE_SAG']);
export const anomalyKindSchema = z.enum(anomalyKindEnum.enumValues);
export type AnomalyKind = z.infer<typeof anomalyKindSchema>;

/** The deterministic confidence label — see diagnostic-confidence.ts for the scoring that derives it. */
export const faultConfidenceLabelEnum = pgEnum('fault_confidence_label', ['LOW', 'MEDIUM', 'HIGH']);

export const faultDiagnostics = pgTable('fault_diagnostics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id')
    .notNull()
    .references(() => deviceAssets.id, { onDelete: 'cascade' }),
  severity: faultSeverityEnum('severity').notNull(),
  faultType: anomalyKindEnum('fault_type').notNull(),
  summary: text('summary').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  requiresImmediateDispatch: boolean('requires_immediate_dispatch').notNull().default(false),
  status: faultStatusEnum('status').notNull().default('PENDING_APPROVAL'),
  // Deterministic confidence scoring (apps/api's diagnostic-confidence.ts) +
  // the real AI SDK tool-call trace it's derived from — both nullable, no
  // default: rows created before this feature shipped genuinely have no
  // recorded confidence/trace, and backfilling a fabricated value for them
  // would be exactly the kind of hallucinated number this feature exists to
  // avoid. Always set together, by DiagnosticsService.diagnose() only.
  confidenceScore: integer('confidence_score'), // 0-100
  confidenceLabel: faultConfidenceLabelEnum('confidence_label'),
  confidenceFactors: jsonb('confidence_factors').$type<ConfidenceFactorBreakdown>(),
  executionTrace: jsonb('execution_trace').$type<ExecutionTraceStep[]>(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  // Set together, by the Stage 6 approve/reject flow only — never by the
  // diagnostic agent itself. Represents "who/when a human last decided
  // this," not approval specifically: a rejection sets both fields too.
  approvedAt: timestamp('approved_at', { mode: 'date' }),
  approvedBy: text('approved_by'), // the deciding user's Clerk userId
});

export const faultDiagnosticsRelations = relations(faultDiagnostics, ({ one }) => ({
  device: one(deviceAssets, { fields: [faultDiagnostics.deviceId], references: [deviceAssets.id] }),
}));

// ── Derived Zod schemas + types ──────────────────────────────────────────────
// Generated from the tables above, never hand-written — see file header.

export const deviceAssetSelectSchema = createSelectSchema(deviceAssets);
export const deviceAssetInsertSchema = createInsertSchema(deviceAssets);
export type DeviceAsset = z.infer<typeof deviceAssetSelectSchema>;
export type NewDeviceAsset = z.infer<typeof deviceAssetInsertSchema>;

export const telemetryLogSelectSchema = createSelectSchema(telemetryLogs);
/**
 * `timestamp` is coerced (`z.coerce.date()`), not the strict `z.date()`
 * drizzle-zod would derive by default — this schema validates BullMQ job
 * payloads (Stage 4's ingestion queue), and BullMQ JSON-serializes job data
 * through Redis, so a `Date` enqueued by the producer arrives at the
 * consumer as a plain ISO string. `z.coerce.date()` accepts both a real
 * `Date` and a string equally, so this works whether the caller is the
 * queue consumer or a direct in-process insert.
 */
export const telemetryLogInsertSchema = createInsertSchema(telemetryLogs, {
  timestamp: z.coerce.date(),
});
export type TelemetryLog = z.infer<typeof telemetryLogSelectSchema>;
export type NewTelemetryLog = z.infer<typeof telemetryLogInsertSchema>;

// executionTrace/confidenceFactors overridden — drizzle-zod maps any
// jsonb column to a generic `jsonSchema` regardless of the column's
// `.$type<T>()` annotation (TS-only, invisible to drizzle-zod's runtime
// introspection), same reasoning as telemetryLogInsertSchema's `timestamp`
// override above.
const faultDiagnosticJsonRefinement = {
  executionTrace: z.array(executionTraceStepSchema).nullable(),
  confidenceFactors: confidenceFactorBreakdownSchema.nullable(),
};
export const faultDiagnosticSelectSchema = createSelectSchema(faultDiagnostics, faultDiagnosticJsonRefinement);
export const faultDiagnosticInsertSchema = createInsertSchema(faultDiagnostics, faultDiagnosticJsonRefinement);
export type FaultDiagnostic = z.infer<typeof faultDiagnosticSelectSchema>;
export type NewFaultDiagnostic = z.infer<typeof faultDiagnosticInsertSchema>;

export const userSelectSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users);
export type User = z.infer<typeof userSelectSchema>;
export type NewUser = z.infer<typeof userInsertSchema>;

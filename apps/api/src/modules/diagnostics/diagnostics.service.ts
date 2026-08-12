import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  deviceAssets,
  faultDiagnostics,
  faultDiagnosticInsertSchema,
  faultDiagnosticSelectSchema,
  type FaultDiagnostic,
  type TelemetryLog,
} from '@gridstream/shared';
import { DbService } from '../../common/db/db.service';
import { DEFAULT_MODEL_KEY, resolveModel } from '@gridstream/ai-config';
import { createGetHistoricalBaselineTool } from './tools/get-historical-baseline.tool';
import { createGetHardwareManualTool } from './tools/get-hardware-manual.tool';

/**
 * What the model is actually allowed to decide — picked from the same
 * table-derived insert schema Stage 3/4 already established, not a second
 * hand-written shape. Deliberately excludes `deviceId` (the service already
 * knows it), `status` (always starts PENDING_APPROVAL — the model never
 * approves its own diagnosis, that's the whole point of HITL), and
 * `id`/`createdAt` (DB-defaulted).
 */
const diagnosisProposalSchema = faultDiagnosticInsertSchema.pick({
  severity: true,
  faultType: true,
  summary: true,
  recommendedAction: true,
  requiresImmediateDispatch: true,
});

const DIAGNOSTIC_STEP_LIMIT = 3;

/**
 * DiagnosticsService
 *
 * The Stage 5 diagnostic agent: given a device and the telemetry reading
 * that breached a safety bound, investigates via tools and produces a
 * Zod-validated FaultDiagnostic. Runs as an autonomous backend process (the
 * BullMQ consumer's trigger, not a request from a logged-in user), so it
 * always resolves the model through the app's own shared provider key
 * (DEFAULT_MODEL_KEY) — there's no per-user BYOK context to use here.
 */
@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  constructor(private readonly dbService: DbService) {}

  async diagnose(deviceId: string, triggeringReading: TelemetryLog): Promise<FaultDiagnostic> {
    const [device] = await this.dbService.db.select().from(deviceAssets).where(eq(deviceAssets.id, deviceId));
    if (!device) {
      throw new NotFoundException(`DeviceAsset ${deviceId} not found`);
    }

    // Dynamic import, same ESM/CommonJS reason as resolveModel() and the two
    // tool factories below: `ai` v7 is ESM-only, apps/api compiles to
    // CommonJS. Node caches a dynamic import after its first resolution, so
    // this isn't a meaningful per-call cost.
    const { generateText, stepCountIs, Output, NoOutputGeneratedError } = await import('ai');

    const result = await generateText({
      // resolveModel() is async — see its own doc comment in model-registry.ts:
      // @ai-sdk/* v4 is ESM-only, apps/api compiles to CommonJS, so the
      // provider SDK is imported lazily inside it.
      model: await resolveModel(DEFAULT_MODEL_KEY),
      instructions: `You are a Virtual Power Plant fault-diagnostic agent for green-energy hardware (solar, battery storage, heat pumps, EV wallboxes).

A device has breached a safety bound. Investigate using the available tools — check the device's own 24-hour baseline to see how far this reading deviates from its normal behavior, and look up manufacturer guidance for the symptom — then provide your diagnosis.

Rules you must follow:
- Never invent a financial figure, cost, or exact percentage — describe severity and urgency in words, the schema's enums carry the structured judgment.
- severity and requiresImmediateDispatch must reflect genuine risk, not just "the numbers were high" — a mild, brief deviation is not automatically CRITICAL.
- summary and recommendedAction must be concise and written for a human operator deciding whether to approve a technician dispatch.`,
      prompt: `Device: ${device.id} (${device.deviceType}, serial ${device.serialNumber}, location: ${device.location ?? 'unknown'})

Triggering reading (id ${triggeringReading.id}, recorded ${triggeringReading.timestamp.toISOString()}):
${JSON.stringify(
  {
    solarProductionKwh: triggeringReading.solarProductionKwh,
    batterySoC: triggeringReading.batterySoC,
    batteryTempCelsius: triggeringReading.batteryTempCelsius,
    gridVoltage: triggeringReading.gridVoltage,
  },
  null,
  2,
)}`,
      tools: {
        getHistoricalBaseline: await createGetHistoricalBaselineTool(this.dbService, device.id),
        getHardwareManual: await createGetHardwareManualTool(device.deviceType),
      },
      // Output.object() is the AI SDK's native mechanism for a tool-calling
      // loop that ends in one structured answer: the model investigates
      // freely via `tools`, and once it stops calling them, the SDK binds
      // its final response to this schema instead of plain text. Replaces
      // an earlier hand-rolled version of this (a schema-only "submit" tool
      // with no `execute`, manually located in `result.toolCalls`) now that
      // this native path is confirmed to exist in the installed AI SDK
      // version — strictly less code for the same guarantee.
      output: Output.object({ schema: diagnosisProposalSchema }),
      stopWhen: stepCountIs(DIAGNOSTIC_STEP_LIMIT),
    });

    // Accessing `result.output` is what throws NoOutputGeneratedError if the
    // model never converged on a final answer within the step limit (e.g.
    // it kept calling tools until stopWhen cut it off) — not a separate
    // check of our own.
    let rawOutput: unknown;
    try {
      rawOutput = result.output;
    } catch (err) {
      if (err instanceof NoOutputGeneratedError) {
        throw new Error(
          `Diagnostic agent for device ${deviceId} did not produce a diagnosis within ${DIAGNOSTIC_STEP_LIMIT} steps (finishReason: ${result.finishReason}).`,
        );
      }
      throw err;
    }

    // The AI SDK already validates its structured output against the schema
    // bound via Output.object() — re-parsing here is a cheap
    // belt-and-suspenders check, not redundant validation logic of our own.
    const proposal = diagnosisProposalSchema.parse(rawOutput);

    const [inserted] = await this.dbService.db
      .insert(faultDiagnostics)
      .values({
        deviceId: device.id,
        ...proposal,
        status: 'PENDING_APPROVAL', // deterministic — never set by the model
      })
      .returning();

    this.logger.log(`FaultDiagnostic ${inserted.id} created for device ${deviceId} (severity: ${proposal.severity})`);

    return faultDiagnosticSelectSchema.parse(inserted);
  }
}

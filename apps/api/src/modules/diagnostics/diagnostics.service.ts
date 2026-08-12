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
import { DEFAULT_MODEL_KEY, resolveModel } from '../../common/ai/model-registry';
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
    const { generateText, stepCountIs, tool } = await import('ai');

    // A tool with no `execute` is the AI SDK's mechanism for a model to
    // return structured final output from inside a tool-calling loop: the
    // call's `input` is still validated against `inputSchema` and shows up
    // in `result.toolCalls`, but with no result to append, the SDK can't
    // continue the loop past this step — which is exactly the "stop once
    // you've submitted" behavior this needs, on top of the stepCountIs(3)
    // ceiling that guards against the model never calling it at all.
    const submitDiagnosisTool = tool({
      description: 'Submit the final structured fault diagnosis. Call this exactly once, after investigating with the other tools.',
      inputSchema: diagnosisProposalSchema,
    });

    const result = await generateText({
      // resolveModel() is async — see its own doc comment in model-registry.ts:
      // @ai-sdk/* v4 is ESM-only, apps/api compiles to CommonJS, so the
      // provider SDK is imported lazily inside it.
      model: await resolveModel(DEFAULT_MODEL_KEY),
      instructions: `You are a Virtual Power Plant fault-diagnostic agent for green-energy hardware (solar, battery storage, heat pumps, EV wallboxes).

A device has breached a safety bound. Investigate using the available tools — check the device's own 24-hour baseline to see how far this reading deviates from its normal behavior, and look up manufacturer guidance for the symptom — then call submitDiagnosis exactly once with your conclusion.

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
        submitDiagnosis: submitDiagnosisTool,
      },
      stopWhen: stepCountIs(DIAGNOSTIC_STEP_LIMIT),
    });

    const submission = result.toolCalls.find((call) => call.toolName === 'submitDiagnosis');
    if (!submission) {
      throw new Error(
        `Diagnostic agent for device ${deviceId} did not submit a diagnosis within ${DIAGNOSTIC_STEP_LIMIT} steps (finishReason: ${result.finishReason}).`,
      );
    }

    // submission.input is already validated against diagnosisProposalSchema
    // by the AI SDK itself (that's what inputSchema is for) — re-parsing
    // here is a cheap belt-and-suspenders check, not redundant validation
    // logic of our own.
    const proposal = diagnosisProposalSchema.parse(submission.input);

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

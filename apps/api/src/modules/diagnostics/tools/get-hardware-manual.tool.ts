import type { Tool } from 'ai';
import { z } from 'zod';
import {
  anomalyKindSchema,
  type AnomalyKind,
  type DeviceAsset,
} from '@gridstream/shared';

/**
 * Stand-in for a real manufacturer fault-code documentation lookup (the
 * master plan's "getHardwareManual: Looks up manufacturer fault code
 * documentation") — there's no real hardware or manufacturer API behind
 * this, same as the telemetry simulator standing in for real smart meters.
 * Deliberately small and honest about being placeholder content, not
 * dressed up as real data. Replace with a real lookup (a manufacturer API,
 * a documents table, embeddings over PDF manuals) if this ever needs to be
 * real.
 */
const HARDWARE_MANUAL: Record<
  DeviceAsset['deviceType'],
  Partial<Record<AnomalyKind, string>>
> = {
  BATTERY: {
    THERMAL_RUNAWAY:
      'Battery cell temperature above safe operating range can indicate cell degradation, a failed cooling fan, or an internal short. Guidance: isolate the battery from the grid immediately, do not attempt to recharge until physically inspected, schedule an in-person inspection within 24 hours.',
    VOLTAGE_SAG:
      'A grid voltage sag at a battery site can indicate an inverter fault or a loose grid-tie connection. Guidance: check inverter status remotely if possible; schedule inspection within 3 business days if the sag is intermittent, immediately if sustained.',
  },
  SOLAR: {
    VOLTAGE_SAG:
      'A grid voltage sag at a solar site is usually inverter- or grid-tie-side, not the panels themselves. Guidance: check inverter fault codes remotely; schedule inspection within 3 business days if intermittent.',
  },
  HEAT_PUMP: {
    VOLTAGE_SAG:
      'A voltage sag at a heat pump can trip its compressor protection circuit. Guidance: confirm the unit has not entered a fault-lockout state; schedule inspection within 3 business days.',
  },
  WALLBOX: {
    VOLTAGE_SAG:
      'A voltage sag at a wallbox can interrupt an active charging session. Guidance: confirm no vehicle is mid-charge; schedule inspection within 3 business days if the sag recurs.',
  },
};

const FALLBACK_GUIDANCE =
  'No specific guidance on file for this device type and symptom combination. Recommend a standard inspection within 3 business days as a default.';

export interface HardwareManualLookup {
  guidance: string;
  /** Whether a real device-type/symptom entry existed vs. the generic fallback — a confidence-scoring signal (diagnostic-confidence.ts), not shown to the model. */
  matched: boolean;
}

/** Pure lookup — trivially testable without the AI SDK. */
export function lookupHardwareManual(
  deviceType: DeviceAsset['deviceType'],
  symptom: AnomalyKind,
): HardwareManualLookup {
  const guidance = HARDWARE_MANUAL[deviceType]?.[symptom];
  return guidance
    ? { guidance, matched: true }
    : { guidance: FALLBACK_GUIDANCE, matched: false };
}

/**
 * `deviceType` is closed over, same reasoning as getHistoricalBaseline's
 * `deviceId`. Async + lazy `import('ai')` for the same ESM/CommonJS reason
 * documented on that tool.
 */
export async function createGetHardwareManualTool(
  deviceType: DeviceAsset['deviceType'],
): Promise<Tool<{ symptom: AnomalyKind }, string>> {
  const { tool } = await import('ai');
  return tool({
    description:
      "Looks up manufacturer troubleshooting guidance for this device's type and a given anomaly symptom.",
    inputSchema: z.object({
      symptom: anomalyKindSchema.describe(
        'Which kind of anomaly is being diagnosed',
      ),
    }),
    // Only the guidance text goes to the model — the tool's contract with
    // the model is unchanged. `matched` is recovered separately by
    // DiagnosticsService from this same pure function, called directly
    // against the tool call's actual recorded input (see diagnose()).
    execute: async ({ symptom }) =>
      lookupHardwareManual(deviceType, symptom).guidance,
  });
}

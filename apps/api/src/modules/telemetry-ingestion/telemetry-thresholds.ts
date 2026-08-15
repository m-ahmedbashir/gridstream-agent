import type { AnomalyKind } from '@gridstream/shared';
import {
  THERMAL_RUNAWAY_TEMP_C,
  VOLTAGE_SAG_V,
} from './telemetry-reading-generator';

export interface ThresholdCheckable {
  batteryTempCelsius?: number | null;
  gridVoltage?: number | null;
}

/**
 * The exact two safety bounds named in the master plan, and *which* one
 * tripped — this is what makes `faultType` on FaultDiagnostic deterministic
 * rather than model-authored (see DiagnosticsService.diagnose()): the
 * classification is already known before the AI agent ever runs, so it's
 * handed to the model as a stated fact, not asked as a question. Thermal
 * checked first, same priority as the boolean OR this replaces — if both
 * conditions happen to be true, thermal wins. Pure function, no DI — the
 * queue consumer calls this, but it's tested in isolation here.
 */
export function classifyAnomaly(
  reading: ThresholdCheckable,
): AnomalyKind | null {
  if (
    reading.batteryTempCelsius != null &&
    reading.batteryTempCelsius > THERMAL_RUNAWAY_TEMP_C
  ) {
    return 'THERMAL_RUNAWAY';
  }
  if (reading.gridVoltage != null && reading.gridVoltage < VOLTAGE_SAG_V) {
    return 'VOLTAGE_SAG';
  }
  return null;
}

/** Defined in terms of classifyAnomaly() so the two can never drift apart. */
export function isAnomalous(reading: ThresholdCheckable): boolean {
  return classifyAnomaly(reading) !== null;
}

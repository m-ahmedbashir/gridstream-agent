import type {
  AnomalyKind,
  ConfidenceFactorBreakdown,
} from '@gridstream/shared';
import {
  THERMAL_RUNAWAY_TEMP_C,
  VOLTAGE_SAG_V,
} from '../telemetry-ingestion/telemetry-reading-generator';
import type { HistoricalBaseline } from './tools/get-historical-baseline.tool';

export type ConfidenceLabel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ConfidenceInput {
  anomalyKind: AnomalyKind;
  triggeringReading: {
    batteryTempCelsius: number | null;
    gridVoltage: number | null;
  };
  /** null = getHistoricalBaseline was never called within the model's step budget. */
  baseline: HistoricalBaseline | null;
  /** null = getHardwareManual was never called; otherwise whether it found a real entry vs. the generic fallback. */
  hardwareManualMatched: boolean | null;
  /** Distinct tools actually invoked before the model converged (0-2). */
  toolsInvokedCount: number;
}

export interface ConfidenceResult {
  score: number; // 0-100
  label: ConfidenceLabel;
  factors: ConfidenceFactorBreakdown;
}

const DEVIATION_MAX = 35;
const BASELINE_MAX = 25;
const MANUAL_MAX = 20;
const INVESTIGATION_MAX = 20;

/**
 * Deterministic, TypeScript-computed confidence scoring for a
 * FaultDiagnostic — deliberately never asked of the model (see
 * DiagnosticsService.diagnose() and AGENTS.md's rule that numeric facts
 * shown to a human must be computed deterministically, never left to the
 * model). Every input here is a real signal captured off the AI SDK's
 * actual tool-call trace for this run, not re-queried or re-imagined —
 * same inputs always produce the same score.
 *
 * Four signals, fixed point buckets summing to 100:
 *  - Deviation strength (35): how far the triggering reading is past the
 *    fixed safety threshold — the single strongest first-party signal, since
 *    it's the number the whole diagnosis is about.
 *  - Baseline corroboration (25): how many historical samples back up the
 *    comparison — a thin sample is weaker evidence.
 *  - Manual corroboration (20): whether a real manufacturer-guidance entry
 *    existed for this device/symptom pair vs. generic fallback text.
 *  - Investigation completeness (20): how much of the tool budget was
 *    actually used — floors the score when the model skipped investigation,
 *    doesn't reward tool-calling for its own sake.
 *
 * No single signal can reach HIGH (75+) on its own — that requires several
 * signals corroborating together, by construction of the weights.
 */
export function computeDiagnosticConfidence(
  input: ConfidenceInput,
): ConfidenceResult {
  const deviationStrength = scoreDeviationStrength(
    input.anomalyKind,
    input.triggeringReading,
  );
  const baselineCorroboration = scoreBaselineCorroboration(input.baseline);
  const manualCorroboration = scoreManualCorroboration(
    input.hardwareManualMatched,
  );
  const investigationCompleteness = scoreInvestigationCompleteness(
    input.toolsInvokedCount,
  );

  const factors: ConfidenceFactorBreakdown = {
    deviationStrength,
    baselineCorroboration,
    manualCorroboration,
    investigationCompleteness,
  };

  const score =
    deviationStrength.points +
    baselineCorroboration.points +
    manualCorroboration.points +
    investigationCompleteness.points;

  return { score, label: scoreToLabel(score), factors };
}

function scoreToLabel(score: number): ConfidenceLabel {
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

/**
 * Fraction past the fixed threshold, saturating at 50% past it. That
 * saturation point is calibrated against telemetry-reading-generator.ts's
 * own simulated anomaly ranges (thermal: up to ~23% over threshold; voltage:
 * up to ~15% under) so realistic anomalies land mid-scale here, not
 * trivially maxed out on a barely-anomalous reading.
 */
function scoreDeviationStrength(
  anomalyKind: AnomalyKind,
  reading: { batteryTempCelsius: number | null; gridVoltage: number | null },
): ConfidenceFactorBreakdown['deviationStrength'] {
  let deviationRatio: number | null = null;

  if (anomalyKind === 'THERMAL_RUNAWAY' && reading.batteryTempCelsius != null) {
    deviationRatio =
      (reading.batteryTempCelsius - THERMAL_RUNAWAY_TEMP_C) /
      THERMAL_RUNAWAY_TEMP_C;
  } else if (anomalyKind === 'VOLTAGE_SAG' && reading.gridVoltage != null) {
    deviationRatio = (VOLTAGE_SAG_V - reading.gridVoltage) / VOLTAGE_SAG_V;
  }

  if (deviationRatio == null || deviationRatio <= 0) {
    return {
      points: 0,
      max: DEVIATION_MAX,
      detail:
        'Triggering value not past the safety threshold — unexpected, treated as no evidence.',
    };
  }

  const points = Math.round(Math.min(deviationRatio / 0.5, 1) * DEVIATION_MAX);
  const percentPast = Math.round(deviationRatio * 100);
  return {
    points,
    max: DEVIATION_MAX,
    detail: `Triggering reading is ${percentPast}% past the ${anomalyKind === 'THERMAL_RUNAWAY' ? `${THERMAL_RUNAWAY_TEMP_C}°C` : `${VOLTAGE_SAG_V}V`} safety threshold.`,
  };
}

/** 20 samples (~1 day at the seeded 30-minute interval) earns full points; fewer scales down linearly. */
function scoreBaselineCorroboration(
  baseline: HistoricalBaseline | null,
): ConfidenceFactorBreakdown['baselineCorroboration'] {
  if (baseline === null) {
    return {
      points: 0,
      max: BASELINE_MAX,
      detail: 'Historical baseline was not queried during investigation.',
    };
  }
  const points = Math.round(
    Math.min(baseline.sampleCount / 20, 1) * BASELINE_MAX,
  );
  return {
    points,
    max: BASELINE_MAX,
    detail: `Historical baseline drawn from ${baseline.sampleCount} sample${baseline.sampleCount === 1 ? '' : 's'} over the last 24 hours.`,
  };
}

function scoreManualCorroboration(
  matched: boolean | null,
): ConfidenceFactorBreakdown['manualCorroboration'] {
  if (matched === null) {
    return {
      points: 0,
      max: MANUAL_MAX,
      detail: 'Manufacturer guidance was not looked up during investigation.',
    };
  }
  if (matched === false) {
    return {
      points: 8,
      max: MANUAL_MAX,
      detail:
        'No manufacturer guidance on file for this device type and symptom — generic fallback guidance only.',
    };
  }
  return {
    points: MANUAL_MAX,
    max: MANUAL_MAX,
    detail: 'Manufacturer guidance found for this device type and symptom.',
  };
}

function scoreInvestigationCompleteness(
  toolsInvokedCount: number,
): ConfidenceFactorBreakdown['investigationCompleteness'] {
  const points = toolsInvokedCount * 10;
  return {
    points,
    max: INVESTIGATION_MAX,
    detail: `${toolsInvokedCount} of 2 available investigation tools used.`,
  };
}

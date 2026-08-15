import {
  computeDiagnosticConfidence,
  type ConfidenceInput,
} from './diagnostic-confidence';

const BASE_INPUT: ConfidenceInput = {
  anomalyKind: 'THERMAL_RUNAWAY',
  triggeringReading: { batteryTempCelsius: 97.5, gridVoltage: 230 }, // 50% past 65 -> saturates deviation score
  baseline: {
    sampleCount: 20,
    avgSolarProductionKwh: null,
    avgBatterySoC: 80,
    avgBatteryTempCelsius: 62,
    avgGridVoltage: 230,
  },
  hardwareManualMatched: true,
  toolsInvokedCount: 2,
};

describe('computeDiagnosticConfidence()', () => {
  it('scores a full, well-corroborated investigation as HIGH', () => {
    const result = computeDiagnosticConfidence(BASE_INPUT);
    expect(result.score).toBe(100);
    expect(result.label).toBe('HIGH');
    expect(result.factors.deviationStrength.points).toBe(35);
    expect(result.factors.baselineCorroboration.points).toBe(25);
    expect(result.factors.manualCorroboration.points).toBe(20);
    expect(result.factors.investigationCompleteness.points).toBe(20);
  });

  it('degrades without crashing when no tools were called at all', () => {
    const result = computeDiagnosticConfidence({
      ...BASE_INPUT,
      baseline: null,
      hardwareManualMatched: null,
      toolsInvokedCount: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.factors.baselineCorroboration.points).toBe(0);
    expect(result.factors.manualCorroboration.points).toBe(0);
    expect(result.factors.investigationCompleteness.points).toBe(0);
    // deviation strength is independent of any tool call, still computable
    expect(result.factors.deviationStrength.points).toBe(35);
    expect(result.label).toBe('LOW');
  });

  it('scores the fallback-guidance path as weak but non-zero manual corroboration', () => {
    const result = computeDiagnosticConfidence({
      ...BASE_INPUT,
      hardwareManualMatched: false,
    });
    expect(result.factors.manualCorroboration.points).toBe(8);
  });

  it('scales baseline corroboration linearly below the 20-sample saturation point', () => {
    const result = computeDiagnosticConfidence({
      ...BASE_INPUT,
      baseline: { ...BASE_INPUT.baseline!, sampleCount: 10 },
    });
    expect(result.factors.baselineCorroboration.points).toBe(13); // round(10/20 * 25)
  });

  it('caps baseline corroboration at the max once past the saturation point', () => {
    const result = computeDiagnosticConfidence({
      ...BASE_INPUT,
      baseline: { ...BASE_INPUT.baseline!, sampleCount: 40 },
    });
    expect(result.factors.baselineCorroboration.points).toBe(25);
  });

  it('scales deviation strength for a voltage sag using the voltage formula', () => {
    const result = computeDiagnosticConfidence({
      ...BASE_INPUT,
      anomalyKind: 'VOLTAGE_SAG',
      triggeringReading: { batteryTempCelsius: null, gridVoltage: 190 }, // 5% under 200
    });
    // deviationRatio = (200-190)/200 = 0.05; points = round(min(0.05/0.5,1)*35) = round(3.5) = 4
    expect(result.factors.deviationStrength.points).toBe(4);
  });

  it('scores investigation completeness proportionally to tools actually used', () => {
    const result = computeDiagnosticConfidence({
      ...BASE_INPUT,
      toolsInvokedCount: 1,
    });
    expect(result.factors.investigationCompleteness.points).toBe(10);
  });

  // Each case hand-verified against the sub-formulas: deviation saturates
  // (35) at batteryTempCelsius: 130 (ratio 1.0 >= 0.5); a baseline
  // sampleCount of 7 yields round(7/20*25) = 9 points.
  it('labels an exact score of 75 as HIGH (the label boundary)', () => {
    const result = computeDiagnosticConfidence({
      anomalyKind: 'THERMAL_RUNAWAY',
      triggeringReading: { batteryTempCelsius: 130, gridVoltage: 230 }, // deviation: 35
      baseline: null, // 0
      hardwareManualMatched: true, // 20
      toolsInvokedCount: 2, // 20
    });
    expect(result.score).toBe(75);
    expect(result.label).toBe('HIGH');
  });

  it('labels an exact score of 74 as MEDIUM (just below the HIGH boundary)', () => {
    const result = computeDiagnosticConfidence({
      anomalyKind: 'THERMAL_RUNAWAY',
      triggeringReading: { batteryTempCelsius: 130, gridVoltage: 230 }, // deviation: 35
      baseline: {
        sampleCount: 7,
        avgSolarProductionKwh: null,
        avgBatterySoC: null,
        avgBatteryTempCelsius: null,
        avgGridVoltage: null,
      }, // 9
      hardwareManualMatched: true, // 20
      toolsInvokedCount: 1, // 10
    });
    expect(result.score).toBe(74);
    expect(result.label).toBe('MEDIUM');
  });

  it('labels an exact score of 45 as MEDIUM (the label boundary)', () => {
    const result = computeDiagnosticConfidence({
      anomalyKind: 'THERMAL_RUNAWAY',
      triggeringReading: { batteryTempCelsius: 130, gridVoltage: 230 }, // deviation: 35
      baseline: null, // 0
      hardwareManualMatched: null, // 0
      toolsInvokedCount: 1, // 10
    });
    expect(result.score).toBe(45);
    expect(result.label).toBe('MEDIUM');
  });

  it('labels an exact score of 44 as LOW (just below the MEDIUM boundary)', () => {
    const result = computeDiagnosticConfidence({
      anomalyKind: 'THERMAL_RUNAWAY',
      triggeringReading: { batteryTempCelsius: 130, gridVoltage: 230 }, // deviation: 35
      baseline: {
        sampleCount: 7,
        avgSolarProductionKwh: null,
        avgBatterySoC: null,
        avgBatteryTempCelsius: null,
        avgGridVoltage: null,
      }, // 9
      hardwareManualMatched: null, // 0
      toolsInvokedCount: 0, // 0
    });
    expect(result.score).toBe(44);
    expect(result.label).toBe('LOW');
  });

  it('labels a zero-evidence diagnosis as a score of 0, LOW', () => {
    const result = computeDiagnosticConfidence({
      anomalyKind: 'THERMAL_RUNAWAY',
      triggeringReading: { batteryTempCelsius: 65, gridVoltage: 230 }, // exactly at threshold, not past it
      baseline: null,
      hardwareManualMatched: null,
      toolsInvokedCount: 0,
    });
    expect(result.score).toBe(0);
    expect(result.label).toBe('LOW');
  });
});

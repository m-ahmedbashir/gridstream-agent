import { isAnomalous } from './telemetry-thresholds';

describe('isAnomalous()', () => {
  it('is not anomalous when both metrics are within normal range', () => {
    expect(isAnomalous({ batteryTempCelsius: 30, gridVoltage: 230 })).toBe(false);
  });

  it('is anomalous when batteryTempCelsius exceeds 65°C (thermal runaway)', () => {
    expect(isAnomalous({ batteryTempCelsius: 65.1, gridVoltage: 230 })).toBe(true);
  });

  it('is NOT anomalous when batteryTempCelsius is exactly 65°C (boundary is exclusive)', () => {
    expect(isAnomalous({ batteryTempCelsius: 65, gridVoltage: 230 })).toBe(false);
  });

  it('is anomalous when gridVoltage drops below 200V (voltage sag)', () => {
    expect(isAnomalous({ batteryTempCelsius: 30, gridVoltage: 199.9 })).toBe(true);
  });

  it('is NOT anomalous when gridVoltage is exactly 200V (boundary is exclusive)', () => {
    expect(isAnomalous({ batteryTempCelsius: 30, gridVoltage: 200 })).toBe(false);
  });

  it('treats null/undefined metrics as absent, not anomalous', () => {
    expect(isAnomalous({ batteryTempCelsius: null, gridVoltage: null })).toBe(false);
    expect(isAnomalous({})).toBe(false);
  });

  it('is anomalous if either metric breaches, even if the other is fine', () => {
    expect(isAnomalous({ batteryTempCelsius: 70, gridVoltage: 230 })).toBe(true);
    expect(isAnomalous({ batteryTempCelsius: 30, gridVoltage: 150 })).toBe(true);
  });
});

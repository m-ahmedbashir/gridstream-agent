import {
  ANOMALY_PROBABILITY,
  THERMAL_RUNAWAY_TEMP_C,
  VOLTAGE_SAG_V,
  generateReading,
} from './telemetry-reading-generator';

/** Fixed sequence so each test controls exactly which random() calls happen. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('generateReading()', () => {
  it('a BATTERY device reports batterySoC/batteryTempCelsius and no solar production', () => {
    // random() calls in order: gridVoltage, batterySoC, batteryTempCelsius, anomaly-check (>= probability => no anomaly)
    const random = sequence(0.5, 0.5, 0.5, ANOMALY_PROBABILITY);
    const reading = generateReading(
      { id: 'device-1', deviceType: 'BATTERY' },
      random,
    );

    expect(reading.deviceId).toBe('device-1');
    expect(reading.solarProductionKwh).toBeNull();
    expect(reading.batterySoC).toBe(50);
    expect(reading.batteryTempCelsius).toBeGreaterThanOrEqual(20);
    expect(reading.batteryTempCelsius).toBeLessThanOrEqual(35);
  });

  it('a SOLAR device reports solarProductionKwh and no battery fields', () => {
    const random = sequence(0.5, 0.5, ANOMALY_PROBABILITY);
    const reading = generateReading(
      { id: 'device-2', deviceType: 'SOLAR' },
      random,
    );

    expect(reading.batterySoC).toBeNull();
    expect(reading.batteryTempCelsius).toBeNull();
    expect(reading.solarProductionKwh).toBeGreaterThanOrEqual(0);
    expect(reading.solarProductionKwh).toBeLessThanOrEqual(8);
  });

  it('a WALLBOX/HEAT_PUMP device reports neither solar nor battery fields', () => {
    const random = sequence(0.5, ANOMALY_PROBABILITY);
    const reading = generateReading(
      { id: 'device-3', deviceType: 'WALLBOX' },
      random,
    );

    expect(reading.solarProductionKwh).toBeNull();
    expect(reading.batterySoC).toBeNull();
    expect(reading.batteryTempCelsius).toBeNull();
    expect(reading.gridVoltage).not.toBeNull();
  });

  it('injects thermal runaway (>65°C) for a BATTERY device when the anomaly roll succeeds', () => {
    const random = sequence(0.5, 0.5, 0.5, 0, 0.5); // last two: anomaly-check (0 < probability => anomaly), then the temp roll
    const reading = generateReading(
      { id: 'device-4', deviceType: 'BATTERY' },
      random,
    );

    expect(reading.batteryTempCelsius).toBeGreaterThan(THERMAL_RUNAWAY_TEMP_C);
  });

  it('injects a voltage sag (<200V) for a non-BATTERY device when the anomaly roll succeeds', () => {
    const random = sequence(0.5, 0, 0.5); // gridVoltage, anomaly-check (anomaly), voltage-sag roll
    const reading = generateReading(
      { id: 'device-5', deviceType: 'HEAT_PUMP' },
      random,
    );

    expect(reading.gridVoltage).toBeLessThan(VOLTAGE_SAG_V);
  });

  it('never injects an anomaly when the roll lands exactly on the probability boundary', () => {
    const random = sequence(0.5, 0.5, 0.5, ANOMALY_PROBABILITY); // strictly < required, so exactly-equal must not trigger
    const reading = generateReading(
      { id: 'device-6', deviceType: 'BATTERY' },
      random,
    );

    expect(reading.batteryTempCelsius).toBeLessThan(THERMAL_RUNAWAY_TEMP_C);
  });

  it('forceAnomaly guarantees an anomaly even when the roll would not have triggered one', () => {
    // random() calls: gridVoltage, batterySoC, batteryTempCelsius — then no anomaly-check
    // roll at all (forceAnomaly short-circuits the `||` before it's evaluated), then the
    // thermal-runaway magnitude roll.
    const random = sequence(0.5, 0.5, 0.5, 0.9);
    const reading = generateReading(
      { id: 'device-7', deviceType: 'BATTERY' },
      random,
      true,
    );

    expect(reading.batteryTempCelsius).toBeGreaterThan(THERMAL_RUNAWAY_TEMP_C);
  });
});

import type { NewTelemetryLog } from '@gridstream/shared';

/** Matches the two anomaly kinds named in the master plan, exactly. */
export const THERMAL_RUNAWAY_TEMP_C = 65;
export const VOLTAGE_SAG_V = 200;

/** Chance any given tick's reading is pushed into anomaly range. */
export const ANOMALY_PROBABILITY = 0.1;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface SimulatableDevice {
  id: string;
  deviceType: 'SOLAR' | 'BATTERY' | 'HEAT_PUMP' | 'WALLBOX';
}

/**
 * Pure — no I/O, no DI — so it's testable without touching Redis, Postgres,
 * or Nest's DI container. `random` is injectable purely for deterministic
 * tests; production callers just use the default `Math.random`.
 *
 * `forceAnomaly` skips the probability roll entirely and always applies the
 * anomaly branch — used by the "Simulate Chaos Event" manual trigger
 * (TelemetrySimulatorService.simulateChaosEvent()), where the whole point is
 * a guaranteed anomaly on demand, not a 1-in-10 chance.
 */
export function generateReading(
  device: SimulatableDevice,
  random: () => number = Math.random,
  forceAnomaly = false,
): NewTelemetryLog {
  const reading: NewTelemetryLog = {
    deviceId: device.id,
    timestamp: new Date(),
    solarProductionKwh: null,
    batterySoC: null,
    batteryTempCelsius: null,
    // Normal European mains: ~220-240V.
    gridVoltage: roundTo(220 + random() * 20, 1),
  };

  if (device.deviceType === 'SOLAR') {
    reading.solarProductionKwh = roundTo(random() * 8, 2); // 0-8 kWh
  }
  if (device.deviceType === 'BATTERY') {
    reading.batterySoC = roundTo(random() * 100, 1);
    reading.batteryTempCelsius = roundTo(20 + random() * 15, 1); // 20-35°C normal
  }

  const isAnomaly = forceAnomaly || random() < ANOMALY_PROBABILITY;
  if (isAnomaly) {
    if (device.deviceType === 'BATTERY') {
      // Thermal runaway: push well past the 65°C threshold.
      reading.batteryTempCelsius = roundTo(THERMAL_RUNAWAY_TEMP_C + random() * 15, 1);
    } else {
      // Voltage sag: only device types without a battery get this anomaly —
      // keeps each simulated reading to one clear anomaly kind, not both.
      reading.gridVoltage = roundTo(VOLTAGE_SAG_V - random() * 30, 1);
    }
  }

  return reading;
}

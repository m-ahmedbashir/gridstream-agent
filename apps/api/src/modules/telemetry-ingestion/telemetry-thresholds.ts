import { THERMAL_RUNAWAY_TEMP_C, VOLTAGE_SAG_V } from './telemetry-reading-generator';

export interface ThresholdCheckable {
  batteryTempCelsius?: number | null;
  gridVoltage?: number | null;
}

/**
 * The exact two safety bounds named in the master plan. Pure function, no
 * DI — the queue consumer calls this, but it's tested in isolation here.
 */
export function isAnomalous(reading: ThresholdCheckable): boolean {
  return (
    (reading.batteryTempCelsius != null && reading.batteryTempCelsius > THERMAL_RUNAWAY_TEMP_C) ||
    (reading.gridVoltage != null && reading.gridVoltage < VOLTAGE_SAG_V)
  );
}

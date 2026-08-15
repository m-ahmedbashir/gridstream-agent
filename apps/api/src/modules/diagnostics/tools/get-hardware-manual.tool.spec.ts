import { lookupHardwareManual } from './get-hardware-manual.tool';

describe('lookupHardwareManual()', () => {
  it('returns specific guidance and matched: true for a known deviceType/symptom pair', () => {
    const result = lookupHardwareManual('BATTERY', 'THERMAL_RUNAWAY');
    expect(result.guidance).toContain('isolate the battery from the grid');
    expect(result.matched).toBe(true);
  });

  it('returns fallback guidance and matched: false for a deviceType with no entry for that symptom', () => {
    // SOLAR has no THERMAL_RUNAWAY entry (solar panels don't report battery temp).
    const result = lookupHardwareManual('SOLAR', 'THERMAL_RUNAWAY');
    expect(result.guidance).toMatch(/no specific guidance/i);
    expect(result.matched).toBe(false);
  });

  it('every device type has at least VOLTAGE_SAG guidance (the anomaly every device type can exhibit)', () => {
    for (const deviceType of [
      'SOLAR',
      'BATTERY',
      'HEAT_PUMP',
      'WALLBOX',
    ] as const) {
      const result = lookupHardwareManual(deviceType, 'VOLTAGE_SAG');
      expect(result.guidance).not.toMatch(/no specific guidance/i);
      expect(result.matched).toBe(true);
    }
  });
});

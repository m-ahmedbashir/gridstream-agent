import { lookupHardwareManual } from './get-hardware-manual.tool';

describe('lookupHardwareManual()', () => {
    it('returns specific guidance for a known deviceType/symptom pair', () => {
        const guidance = lookupHardwareManual('BATTERY', 'THERMAL_RUNAWAY');
        expect(guidance).toContain('isolate the battery from the grid');
    });

    it('returns fallback guidance for a deviceType with no entry for that symptom', () => {
        // SOLAR has no THERMAL_RUNAWAY entry (solar panels don't report battery temp).
        const guidance = lookupHardwareManual('SOLAR', 'THERMAL_RUNAWAY');
        expect(guidance).toMatch(/no specific guidance/i);
    });

    it('every device type has at least VOLTAGE_SAG guidance (the anomaly every device type can exhibit)', () => {
        for (const deviceType of ['SOLAR', 'BATTERY', 'HEAT_PUMP', 'WALLBOX'] as const) {
            expect(lookupHardwareManual(deviceType, 'VOLTAGE_SAG')).not.toMatch(/no specific guidance/i);
        }
    });
});

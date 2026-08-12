import { queryHistoricalBaseline } from './get-historical-baseline.tool';
import type { DbService } from '../../../common/db/db.service';

function makeDbMock(row: Record<string, unknown> | undefined) {
    const whereMock = jest.fn().mockResolvedValue(row ? [row] : []);
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    const selectMock = jest.fn().mockReturnValue({ from: fromMock });
    return { db: { select: selectMock } } as unknown as DbService;
}

describe('queryHistoricalBaseline()', () => {
    it('converts Postgres avg()/count() results (numeric strings) into real numbers', async () => {
        const dbService = makeDbMock({
            sampleCount: 42,
            avgSolarProductionKwh: '3.5',
            avgBatterySoC: '61.25',
            avgBatteryTempCelsius: '28.1',
            avgGridVoltage: '229.8',
        });

        const baseline = await queryHistoricalBaseline(dbService, 'device-1');

        expect(baseline).toEqual({
            sampleCount: 42,
            avgSolarProductionKwh: 3.5,
            avgBatterySoC: 61.25,
            avgBatteryTempCelsius: 28.1,
            avgGridVoltage: 229.8,
        });
    });

    it('returns nulls and a zero sample count when the device has no telemetry in the last 24h', async () => {
        const dbService = makeDbMock({
            sampleCount: 0,
            avgSolarProductionKwh: null,
            avgBatterySoC: null,
            avgBatteryTempCelsius: null,
            avgGridVoltage: null,
        });

        const baseline = await queryHistoricalBaseline(dbService, 'device-2');

        expect(baseline).toEqual({
            sampleCount: 0,
            avgSolarProductionKwh: null,
            avgBatterySoC: null,
            avgBatteryTempCelsius: null,
            avgGridVoltage: null,
        });
    });

    it('handles a completely empty result set (no row at all) the same as zero samples', async () => {
        const dbService = makeDbMock(undefined);

        const baseline = await queryHistoricalBaseline(dbService, 'device-3');

        expect(baseline.sampleCount).toBe(0);
        expect(baseline.avgGridVoltage).toBeNull();
    });
});

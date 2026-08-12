import { TelemetryQueueConsumer } from './telemetry-queue.consumer';
import { DbService } from '../../common/db/db.service';
import { AiDiagnosticTriggerService } from './ai-diagnostic-trigger.service';

function makeDbMock(insertedRow: Record<string, unknown>) {
    const returningMock = jest.fn().mockResolvedValue([insertedRow]);
    const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
    const insertMock = jest.fn().mockReturnValue({ values: valuesMock });

    const dbService = { db: { insert: insertMock } } as unknown as DbService;
    return { dbService, insertMock, valuesMock };
}

function makeJob(data: Record<string, unknown>) {
    return { id: 'job-1', data } as any;
}

describe('TelemetryQueueConsumer', () => {
    let aiDiagnosticTrigger: AiDiagnosticTriggerService;

    beforeEach(() => {
        aiDiagnosticTrigger = { trigger: jest.fn().mockResolvedValue(undefined) } as unknown as AiDiagnosticTriggerService;
    });

    it('inserts a normal reading and does not trigger the AI diagnostic', async () => {
        const row = {
            id: 'log-1',
            deviceId: 'device-1',
            timestamp: new Date(),
            solarProductionKwh: null,
            batterySoC: 50,
            batteryTempCelsius: 30,
            gridVoltage: 230,
        };
        const { dbService, valuesMock } = makeDbMock(row);
        const consumer = new TelemetryQueueConsumer(dbService, aiDiagnosticTrigger);

        await consumer.process(makeJob({
            deviceId: 'device-1',
            timestamp: new Date().toISOString(), // as it actually arrives after a real BullMQ/Redis round-trip
            batterySoC: 50,
            batteryTempCelsius: 30,
            gridVoltage: 230,
        }));

        expect(valuesMock).toHaveBeenCalled();
        expect(aiDiagnosticTrigger.trigger).not.toHaveBeenCalled();
    });

    it('triggers the AI diagnostic when the inserted reading breaches a safety bound', async () => {
        const row = {
            id: 'log-2',
            deviceId: 'device-2',
            timestamp: new Date(),
            solarProductionKwh: null,
            batterySoC: 80,
            batteryTempCelsius: 70,
            gridVoltage: 230,
        };
        const { dbService } = makeDbMock(row);
        const consumer = new TelemetryQueueConsumer(dbService, aiDiagnosticTrigger);

        await consumer.process(makeJob({
            deviceId: 'device-2',
            timestamp: new Date().toISOString(),
            batterySoC: 80,
            batteryTempCelsius: 70,
            gridVoltage: 230,
        }));

        expect(aiDiagnosticTrigger.trigger).toHaveBeenCalledWith('device-2', row);
    });

    it('accepts a string timestamp (the real shape after a BullMQ/Redis JSON round-trip) without throwing', async () => {
        const row = { id: 'log-3', deviceId: 'device-3', timestamp: new Date(), batteryTempCelsius: 25, gridVoltage: 230 };
        const { dbService, valuesMock } = makeDbMock(row);
        const consumer = new TelemetryQueueConsumer(dbService, aiDiagnosticTrigger);

        await expect(
            consumer.process(makeJob({ deviceId: 'device-3', timestamp: '2026-01-01T00:00:00.000Z', gridVoltage: 230 })),
        ).resolves.not.toThrow();

        const insertedValue = valuesMock.mock.calls[0][0];
        expect(insertedValue.timestamp).toBeInstanceOf(Date);
    });
});

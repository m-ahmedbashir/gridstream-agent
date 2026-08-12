import { DiagnosticsService } from './diagnostics.service';
import { DbService } from '../../common/db/db.service';

// A fully manual mock, not `{ ...jest.requireActual('ai'), generateText: jest.fn() }`
// — `jest.requireActual('ai')` would try to actually load the real package,
// which can't be `require()`'d at all under Jest's CJS test environment (the
// same ESM-only-package problem documented on diagnostics.service.ts's own
// dynamic `import('ai')`). `tool` and `stepCountIs` are given inert
// pass-through implementations: nothing in these tests inspects their
// output, since the thing that would normally call them (a real
// generateText()) is mocked out entirely too.
//
// `mockGenerateText` is declared *before* `jest.mock()` and referenced by
// the factory, rather than assigned from inside it — the factory only runs
// lazily, the first time something actually loads 'ai' (here, that's deep
// inside a test's `diagnose()` call, well after `beforeEach` already needs
// a live reference to reset), so relying on the factory's own execution to
// produce this value would leave it `undefined` when `beforeEach` runs.
const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
    generateText: mockGenerateText,
    tool: (config: unknown) => config,
    stepCountIs: (n: number) => n,
}));

// resolveModel() itself dynamically imports a real @ai-sdk/* provider
// package (same reason as above) — mocked out for the same reason, not
// because its own logic needs testing here (that's model-registry's own
// concern, verified separately in Stage 4 via a standalone ts-node script
// specifically because it can't run under Jest either).
jest.mock('../../common/ai/model-registry', () => ({
    DEFAULT_MODEL_KEY: 'mock-model-key',
    resolveModel: jest.fn().mockResolvedValue({}),
}));

function makeDbMock(device: Record<string, unknown> | undefined, insertedRow: Record<string, unknown>) {
    const whereMock = jest.fn().mockResolvedValue(device ? [device] : []);
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    const selectMock = jest.fn().mockReturnValue({ from: fromMock });

    const returningMock = jest.fn().mockResolvedValue([insertedRow]);
    const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
    const insertMock = jest.fn().mockReturnValue({ values: valuesMock });

    const dbService = { db: { select: selectMock, insert: insertMock } } as unknown as DbService;
    return { dbService, valuesMock };
}

const DEVICE = { id: 'device-1', deviceType: 'BATTERY', serialNumber: 'X-1', location: 'Basement' };
const READING = {
    id: 'log-1',
    deviceId: 'device-1',
    timestamp: new Date(),
    solarProductionKwh: null,
    batterySoC: 80,
    batteryTempCelsius: 70,
    gridVoltage: 230,
} as any;

describe('DiagnosticsService', () => {
    beforeEach(() => {
        mockGenerateText.mockReset();
    });

    it("persists a FaultDiagnostic from the model's submitDiagnosis tool call, forcing status to PENDING_APPROVAL", async () => {
        const proposal = {
            severity: 'HIGH',
            faultType: 'Battery thermal runaway',
            summary: 'Battery temperature exceeded safe range.',
            recommendedAction: 'Dispatch a technician to inspect cooling.',
            requiresImmediateDispatch: true,
        };
        mockGenerateText.mockResolvedValue({
            toolCalls: [{ toolName: 'submitDiagnosis', input: proposal }],
            finishReason: 'tool-calls',
        });

        const insertedRow = {
            id: 'fault-1',
            deviceId: 'device-1',
            ...proposal,
            status: 'PENDING_APPROVAL',
            createdAt: new Date(),
        };
        const { dbService, valuesMock } = makeDbMock(DEVICE, insertedRow);
        const service = new DiagnosticsService(dbService);

        const result = await service.diagnose('device-1', READING);

        expect(valuesMock).toHaveBeenCalledWith(
            expect.objectContaining({ deviceId: 'device-1', status: 'PENDING_APPROVAL', severity: 'HIGH' }),
        );
        expect(result.id).toBe('fault-1');
    });

    it('throws if the device does not exist, without ever calling the model', async () => {
        const { dbService } = makeDbMock(undefined, {});
        const service = new DiagnosticsService(dbService);

        await expect(service.diagnose('missing-device', READING)).rejects.toThrow('missing-device');
        expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('throws a clear error if the model never calls submitDiagnosis within the step limit', async () => {
        mockGenerateText.mockResolvedValue({ toolCalls: [], finishReason: 'stop' });
        const { dbService } = makeDbMock(DEVICE, {});
        const service = new DiagnosticsService(dbService);

        await expect(service.diagnose('device-1', READING)).rejects.toThrow(/did not submit a diagnosis/);
    });

    it('rejects a submitDiagnosis call whose input fails schema validation', async () => {
        mockGenerateText.mockResolvedValue({
            toolCalls: [{ toolName: 'submitDiagnosis', input: { severity: 'NOT_A_REAL_SEVERITY' } }],
            finishReason: 'tool-calls',
        });
        const { dbService } = makeDbMock(DEVICE, {});
        const service = new DiagnosticsService(dbService);

        await expect(service.diagnose('device-1', READING)).rejects.toThrow();
    });
});

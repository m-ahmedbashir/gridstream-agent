import { DiagnosticsService } from './diagnostics.service';
import { DbService } from '../../common/db/db.service';

// A fully manual mock, not `{ ...jest.requireActual('ai'), generateText: jest.fn() }`
// — `jest.requireActual('ai')` would try to actually load the real package,
// which can't be `require()`'d at all under Jest's CJS test environment (the
// same ESM-only-package problem documented on diagnostics.service.ts's own
// dynamic `import('ai')`). `tool`, `stepCountIs`, and `Output.object` are
// given inert pass-through implementations: nothing in these tests inspects
// their output, since the thing that would normally call them (a real
// generateText()) is mocked out entirely too.
//
// `mockGenerateText` and `MockNoOutputGeneratedError` are declared *before*
// `jest.mock()` and referenced by the factory, rather than assigned from
// inside it — the factory only runs lazily, the first time something
// actually loads 'ai' (here, that's deep inside a test's `diagnose()` call,
// well after `beforeEach` already needs a live reference to reset), so
// relying on the factory's own execution to produce these would leave them
// `undefined` when `beforeEach` runs.
const mockGenerateText = jest.fn();
class MockNoOutputGeneratedError extends Error {}
jest.mock('ai', () => ({
  generateText: mockGenerateText,
  tool: (config: unknown) => config,
  stepCountIs: (n: number) => n,
  Output: { object: (config: unknown) => config },
  NoOutputGeneratedError: MockNoOutputGeneratedError,
}));

// resolveModel() itself dynamically imports a real @ai-sdk/* provider
// package (same reason as above) — mocked out for the same reason, not
// because its own logic needs testing here (that's @gridstream/ai-config's
// own concern, verified separately in Stage 4 via a standalone ts-node
// script specifically because it can't run under Jest either).
jest.mock('@gridstream/ai-config', () => ({
  DEFAULT_MODEL_KEY: 'mock-model-key',
  resolveModel: jest.fn().mockResolvedValue({}),
}));

function makeDbMock(
  device: Record<string, unknown> | undefined,
  insertedRow: Record<string, unknown>,
) {
  const whereMock = jest.fn().mockResolvedValue(device ? [device] : []);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  const selectMock = jest.fn().mockReturnValue({ from: fromMock });

  const returningMock = jest.fn().mockResolvedValue([insertedRow]);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  const insertMock = jest.fn().mockReturnValue({ values: valuesMock });

  const dbService = {
    db: { select: selectMock, insert: insertMock },
  } as unknown as DbService;
  return { dbService, valuesMock };
}

const DEVICE = {
  id: 'device-1',
  deviceType: 'BATTERY',
  serialNumber: 'X-1',
  location: 'Basement',
};
const READING = {
  id: 'log-1',
  deviceId: 'device-1',
  timestamp: new Date(),
  solarProductionKwh: null,
  batterySoC: 80,
  batteryTempCelsius: 70,
  gridVoltage: 230,
} as any;

const CONFIDENCE_FIELDS_NULL = {
  confidenceScore: null,
  confidenceLabel: null,
  confidenceFactors: null,
  executionTrace: null,
};

describe('DiagnosticsService', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

  it("persists a FaultDiagnostic from the model's structured output, forcing status to PENDING_APPROVAL and faultType to the deterministic anomalyKind", async () => {
    const proposal = {
      severity: 'HIGH',
      summary: 'Battery temperature exceeded safe range.',
      recommendedAction: 'Dispatch a technician to inspect cooling.',
      requiresImmediateDispatch: true,
    };
    mockGenerateText.mockResolvedValue({
      output: proposal,
      finishReason: 'stop',
      steps: [],
    });

    const insertedRow = {
      id: 'fault-1',
      deviceId: 'device-1',
      faultType: 'THERMAL_RUNAWAY',
      ...proposal,
      status: 'PENDING_APPROVAL',
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      confidenceScore: 0,
      confidenceLabel: 'LOW',
      confidenceFactors: null,
      executionTrace: [],
    };
    const { dbService, valuesMock } = makeDbMock(DEVICE, insertedRow);
    const service = new DiagnosticsService(dbService);

    const result = await service.diagnose(
      'device-1',
      READING,
      'THERMAL_RUNAWAY',
    );

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        status: 'PENDING_APPROVAL',
        severity: 'HIGH',
        faultType: 'THERMAL_RUNAWAY',
      }),
    );
    expect(result.id).toBe('fault-1');
  });

  it('computes and persists deterministic confidence + the real execution trace from a full 2-tool investigation', async () => {
    const proposal = {
      severity: 'HIGH',
      summary: 'Battery temperature exceeded safe range.',
      recommendedAction: 'Dispatch a technician to inspect cooling.',
      requiresImmediateDispatch: true,
    };
    const baseline = {
      sampleCount: 20,
      avgSolarProductionKwh: null,
      avgBatterySoC: 80,
      avgBatteryTempCelsius: 62,
      avgGridVoltage: 230,
    };
    mockGenerateText.mockResolvedValue({
      output: proposal,
      finishReason: 'stop',
      steps: [
        {
          stepNumber: 0,
          toolResults: [
            { toolName: 'getHistoricalBaseline', input: {}, output: baseline },
          ],
        },
        {
          stepNumber: 1,
          toolResults: [
            {
              toolName: 'getHardwareManual',
              input: { symptom: 'THERMAL_RUNAWAY' },
              output: 'some guidance text',
            },
          ],
        },
      ],
    });

    const insertedRow = {
      id: 'fault-1',
      deviceId: 'device-1',
      faultType: 'THERMAL_RUNAWAY',
      ...proposal,
      status: 'PENDING_APPROVAL',
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      confidenceScore: 95,
      confidenceLabel: 'HIGH',
      confidenceFactors: null,
      executionTrace: [],
    };
    const { dbService, valuesMock } = makeDbMock(DEVICE, insertedRow);
    const service = new DiagnosticsService(dbService);

    await service.diagnose('device-1', READING, 'THERMAL_RUNAWAY');

    // DEVICE is a BATTERY with a real THERMAL_RUNAWAY manual entry, so
    // hardwareManualMatched re-derives to true — deviation (35, READING's
    // 70°C is ~7.7% past 65) + baseline (25, 20 samples) + manual (20,
    // matched) + investigation (20, both tools) = a HIGH-range score.
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        confidenceScore: expect.any(Number),
        confidenceLabel: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/),
        confidenceFactors: expect.objectContaining({
          deviationStrength: expect.any(Object),
          baselineCorroboration: expect.objectContaining({ points: 25 }),
          manualCorroboration: expect.objectContaining({ points: 20 }),
          investigationCompleteness: expect.objectContaining({ points: 20 }),
        }),
        executionTrace: [
          {
            stepNumber: 0,
            toolName: 'getHistoricalBaseline',
            input: {},
            output: baseline,
          },
          {
            stepNumber: 1,
            toolName: 'getHardwareManual',
            input: { symptom: 'THERMAL_RUNAWAY' },
            output: 'some guidance text',
          },
        ],
      }),
    );
  });

  it('degrades to a low, non-crashing confidence score when the model calls no tools at all', async () => {
    const proposal = {
      severity: 'MEDIUM',
      summary: 'Battery temperature exceeded safe range.',
      recommendedAction: 'Monitor and re-check.',
      requiresImmediateDispatch: false,
    };
    mockGenerateText.mockResolvedValue({
      output: proposal,
      finishReason: 'stop',
      steps: [],
    });

    const insertedRow = {
      id: 'fault-1',
      deviceId: 'device-1',
      faultType: 'THERMAL_RUNAWAY',
      ...proposal,
      status: 'PENDING_APPROVAL',
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      confidenceScore: 4,
      confidenceLabel: 'LOW',
      confidenceFactors: null,
      executionTrace: [],
    };
    const { dbService, valuesMock } = makeDbMock(DEVICE, insertedRow);
    const service = new DiagnosticsService(dbService);

    await expect(
      service.diagnose('device-1', READING, 'THERMAL_RUNAWAY'),
    ).resolves.toBeDefined();

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        confidenceLabel: 'LOW',
        executionTrace: [],
      }),
    );
  });

  it('throws if the device does not exist, without ever calling the model', async () => {
    const { dbService } = makeDbMock(undefined, {});
    const service = new DiagnosticsService(dbService);

    await expect(
      service.diagnose('missing-device', READING, 'THERMAL_RUNAWAY'),
    ).rejects.toThrow('missing-device');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('throws a clear error if the model never produces a diagnosis within the step limit', async () => {
    mockGenerateText.mockResolvedValue({
      get output() {
        throw new MockNoOutputGeneratedError('no output generated');
      },
      finishReason: 'stop',
    });
    const { dbService } = makeDbMock(DEVICE, {});
    const service = new DiagnosticsService(dbService);

    await expect(
      service.diagnose('device-1', READING, 'THERMAL_RUNAWAY'),
    ).rejects.toThrow(/did not produce a diagnosis/);
  });

  it('rejects a structured output that fails schema validation', async () => {
    mockGenerateText.mockResolvedValue({
      output: { severity: 'NOT_A_REAL_SEVERITY' },
      finishReason: 'stop',
    });
    const { dbService } = makeDbMock(DEVICE, {});
    const service = new DiagnosticsService(dbService);

    await expect(
      service.diagnose('device-1', READING, 'THERMAL_RUNAWAY'),
    ).rejects.toThrow();
  });

  it("strips HTML-tag-like content from the model's free-text fields before persisting", async () => {
    // Defense-in-depth: even though the model is instructed not to produce
    // markup, nothing stops it from doing so anyway — a future approval UI
    // (not built yet) must not be the only thing standing between a model
    // response and stored HTML. faultType is no longer model-authored (it's
    // deterministic — see classifyAnomaly()), so it's not part of this
    // guarantee any more; only summary/recommendedAction are the model's
    // own free text.
    const proposal = {
      severity: 'HIGH',
      summary:
        'Battery temperature exceeded safe range.<script>alert(document.cookie)</script>',
      recommendedAction: 'Dispatch a technician<b> to inspect cooling</b>.',
      requiresImmediateDispatch: true,
    };
    mockGenerateText.mockResolvedValue({
      output: proposal,
      finishReason: 'stop',
      steps: [],
    });

    const { dbService, valuesMock } = makeDbMock(DEVICE, {
      id: 'fault-1',
      deviceId: 'device-1',
      faultType: 'THERMAL_RUNAWAY',
      ...proposal,
      status: 'PENDING_APPROVAL',
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      ...CONFIDENCE_FIELDS_NULL,
    });
    const service = new DiagnosticsService(dbService);

    await service.diagnose('device-1', READING, 'THERMAL_RUNAWAY');

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        faultType: 'THERMAL_RUNAWAY',
        summary:
          'Battery temperature exceeded safe range.alert(document.cookie)',
        recommendedAction: 'Dispatch a technician to inspect cooling.',
      }),
    );
  });
});

const FAULT_ROW = {
  id: 'fault-1',
  deviceId: 'device-1',
  severity: 'HIGH',
  faultType: 'THERMAL_RUNAWAY',
  summary: 'Battery temperature exceeded safe range.',
  recommendedAction: 'Dispatch a technician to inspect cooling.',
  requiresImmediateDispatch: true,
  status: 'PENDING_APPROVAL',
  createdAt: new Date(),
  approvedAt: null,
  approvedBy: null,
  confidenceScore: 80,
  confidenceLabel: 'HIGH',
  confidenceFactors: null,
  executionTrace: null,
};

describe('DiagnosticsService.getDiagnosticById()', () => {
  it('returns the diagnostic with its device joined', async () => {
    const findFirstMock = jest
      .fn()
      .mockResolvedValue({ ...FAULT_ROW, device: DEVICE_WITH_TIMESTAMPS() });
    const dbService = {
      db: { query: { faultDiagnostics: { findFirst: findFirstMock } } },
    } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    const result = await service.getDiagnosticById('fault-1');

    expect(result.id).toBe('fault-1');
    expect(result.device.serialNumber).toBe('X-1');
  });

  it('throws NotFoundException when the diagnostic does not exist', async () => {
    const findFirstMock = jest.fn().mockResolvedValue(undefined);
    const dbService = {
      db: { query: { faultDiagnostics: { findFirst: findFirstMock } } },
    } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    await expect(service.getDiagnosticById('missing')).rejects.toThrow(
      'not found',
    );
  });
});

describe('DiagnosticsService.listDiagnostics()', () => {
  it('returns each diagnostic with its device joined, plus a total count', async () => {
    const findManyMock = jest
      .fn()
      .mockResolvedValue([{ ...FAULT_ROW, device: DEVICE_WITH_TIMESTAMPS() }]);
    const whereMock = jest.fn().mockResolvedValue([{ total: '1' }]);
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    const selectMock = jest.fn().mockReturnValue({ from: fromMock });
    const dbService = {
      db: {
        query: { faultDiagnostics: { findMany: findManyMock } },
        select: selectMock,
      },
    } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    const result = await service.listDiagnostics({
      status: 'PENDING_APPROVAL',
      limit: 50,
      offset: 0,
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ with: { device: true }, limit: 50, offset: 0 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].device.serialNumber).toBe('X-1');
    expect(result.total).toBe(1); // coerced from Postgres's string count, same as get-historical-baseline.tool.ts
  });
});

function makeUpdateMock(updatedRow: Record<string, unknown> | undefined) {
  const returningMock = jest
    .fn()
    .mockResolvedValue(updatedRow ? [updatedRow] : []);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  const updateMock = jest.fn().mockReturnValue({ set: setMock });
  return { updateMock, setMock };
}

function makeSelectExistingMock(
  existingRow: Record<string, unknown> | undefined,
) {
  const whereMock = jest
    .fn()
    .mockResolvedValue(existingRow ? [existingRow] : []);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  return jest.fn().mockReturnValue({ from: fromMock });
}

function DEVICE_WITH_TIMESTAMPS() {
  return {
    id: 'device-1',
    deviceType: 'BATTERY',
    serialNumber: 'X-1',
    location: 'Basement',
    status: 'ONLINE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('DiagnosticsService.approve() / reject()', () => {
  it('approve() is an atomic conditional update — only succeeds against a PENDING_APPROVAL row', async () => {
    const updatedRow = {
      ...FAULT_ROW,
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: 'user_1',
    };
    const { updateMock, setMock } = makeUpdateMock(updatedRow);
    const dbService = { db: { update: updateMock } } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    const result = await service.approve('fault-1', 'user_1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'APPROVED', approvedBy: 'user_1' }),
    );
    expect(result.status).toBe('APPROVED');
    expect(result.approvedBy).toBe('user_1');
  });

  it('reject() sets the same approvedAt/approvedBy pair — it records who decided, not just who approved', async () => {
    const updatedRow = {
      ...FAULT_ROW,
      status: 'REJECTED',
      approvedAt: new Date(),
      approvedBy: 'user_2',
    };
    const { updateMock, setMock } = makeUpdateMock(updatedRow);
    const dbService = { db: { update: updateMock } } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    const result = await service.reject('fault-1', 'user_2');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REJECTED', approvedBy: 'user_2' }),
    );
    expect(result.status).toBe('REJECTED');
  });

  it('throws NotFoundException when the diagnostic does not exist at all', async () => {
    const { updateMock } = makeUpdateMock(undefined);
    const selectMock = makeSelectExistingMock(undefined);
    const dbService = {
      db: { update: updateMock, select: selectMock },
    } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    await expect(service.approve('missing', 'user_1')).rejects.toThrow(
      'not found',
    );
  });

  it('throws ConflictException (not a silent overwrite) when the diagnostic was already decided', async () => {
    const { updateMock } = makeUpdateMock(undefined);
    const selectMock = makeSelectExistingMock({
      ...FAULT_ROW,
      status: 'REJECTED',
    });
    const dbService = {
      db: { update: updateMock, select: selectMock },
    } as unknown as DbService;
    const service = new DiagnosticsService(dbService);

    await expect(service.approve('fault-1', 'user_1')).rejects.toThrow(
      'already REJECTED',
    );
  });
});

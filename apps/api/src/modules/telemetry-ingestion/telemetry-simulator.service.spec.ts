import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { DbService } from '../../common/db/db.service';

function makeDbMock(devices: Array<{ id: string; deviceType: string }>) {
  const fromMock = jest.fn().mockResolvedValue(devices);
  const selectMock = jest.fn().mockReturnValue({ from: fromMock });
  const dbService = { db: { select: selectMock } } as unknown as DbService;
  return dbService;
}

function makeQueueMock() {
  return { add: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('TelemetrySimulatorService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  it('does not start a timer when TELEMETRY_SIMULATOR_ENABLED is unset', () => {
    delete process.env.TELEMETRY_SIMULATOR_ENABLED;
    const queue = makeQueueMock();
    const dbService = makeDbMock([{ id: 'device-1', deviceType: 'SOLAR' }]);
    const service = new TelemetrySimulatorService(queue, dbService);

    service.onModuleInit();
    jest.advanceTimersByTime(60_000);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not start a timer when TELEMETRY_SIMULATOR_ENABLED is "false"', () => {
    process.env.TELEMETRY_SIMULATOR_ENABLED = 'false';
    const queue = makeQueueMock();
    const dbService = makeDbMock([{ id: 'device-1', deviceType: 'SOLAR' }]);
    const service = new TelemetrySimulatorService(queue, dbService);

    service.onModuleInit();
    jest.advanceTimersByTime(60_000);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues a reading on each tick when enabled and a device exists', async () => {
    process.env.TELEMETRY_SIMULATOR_ENABLED = 'true';
    process.env.TELEMETRY_SIMULATOR_INTERVAL_MS = '1000';
    const queue = makeQueueMock();
    const dbService = makeDbMock([{ id: 'device-1', deviceType: 'SOLAR' }]);
    const service = new TelemetrySimulatorService(queue, dbService);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(1000);

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'ingest-reading',
      expect.objectContaining({ deviceId: 'device-1' }),
    );
  });

  it('does not enqueue anything when device_assets is empty', async () => {
    process.env.TELEMETRY_SIMULATOR_ENABLED = 'true';
    process.env.TELEMETRY_SIMULATOR_INTERVAL_MS = '1000';
    const queue = makeQueueMock();
    const dbService = makeDbMock([]);
    const service = new TelemetrySimulatorService(queue, dbService);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(1000);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('clears the interval on module destroy', async () => {
    process.env.TELEMETRY_SIMULATOR_ENABLED = 'true';
    process.env.TELEMETRY_SIMULATOR_INTERVAL_MS = '1000';
    const queue = makeQueueMock();
    const dbService = makeDbMock([{ id: 'device-1', deviceType: 'SOLAR' }]);
    const service = new TelemetrySimulatorService(queue, dbService);

    service.onModuleInit();
    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(5000);

    expect(queue.add).not.toHaveBeenCalled();
  });

  describe('simulateChaosEvent()', () => {
    it('enqueues a forced-anomalous reading for a device and returns its identity', async () => {
      const queue = makeQueueMock();
      const dbService = makeDbMock([
        { id: 'device-1', deviceType: 'BATTERY', serialNumber: 'X-1' } as any,
      ]);
      const service = new TelemetrySimulatorService(queue, dbService);

      const result = await service.simulateChaosEvent();

      expect(queue.add).toHaveBeenCalledTimes(1);
      const [, enqueuedReading] = queue.add.mock.calls[0];
      expect(enqueuedReading.deviceId).toBe('device-1');
      expect(enqueuedReading.batteryTempCelsius).toBeGreaterThan(65); // forced anomaly, not left to chance
      expect(result).toEqual({
        deviceId: 'device-1',
        deviceType: 'BATTERY',
        serialNumber: 'X-1',
      });
    });

    it('works even when the automatic simulator is disabled — this is an explicit manual trigger', async () => {
      delete process.env.TELEMETRY_SIMULATOR_ENABLED;
      const queue = makeQueueMock();
      const dbService = makeDbMock([
        { id: 'device-1', deviceType: 'SOLAR', serialNumber: 'X-2' } as any,
      ]);
      const service = new TelemetrySimulatorService(queue, dbService);

      await service.simulateChaosEvent();

      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when there are no devices to target', async () => {
      const queue = makeQueueMock();
      const dbService = makeDbMock([]);
      const service = new TelemetrySimulatorService(queue, dbService);

      await expect(service.simulateChaosEvent()).rejects.toThrow(
        'No devices to simulate a chaos event for',
      );
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});

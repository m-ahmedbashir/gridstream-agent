import { AiDiagnosticTriggerService } from './ai-diagnostic-trigger.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';

const READING = {
  id: 'log-1',
  deviceId: 'device-1',
  timestamp: new Date(),
} as any;

describe('AiDiagnosticTriggerService', () => {
  it('delegates to DiagnosticsService.diagnose()', async () => {
    const diagnosticsService = {
      diagnose: jest.fn().mockResolvedValue({ id: 'fault-1' }),
    } as unknown as DiagnosticsService;
    const service = new AiDiagnosticTriggerService(diagnosticsService);

    await service.trigger('device-1', READING, 'THERMAL_RUNAWAY');

    expect(diagnosticsService.diagnose).toHaveBeenCalledWith(
      'device-1',
      READING,
      'THERMAL_RUNAWAY',
    );
  });

  it('swallows a diagnosis failure rather than propagating it', async () => {
    const diagnosticsService = {
      diagnose: jest.fn().mockRejectedValue(new Error('provider outage')),
    } as unknown as DiagnosticsService;
    const service = new AiDiagnosticTriggerService(diagnosticsService);

    // Must resolve, not reject — a thrown error here would fail the whole
    // BullMQ job and retry it, duplicating the already-persisted reading.
    await expect(
      service.trigger('device-1', READING, 'THERMAL_RUNAWAY'),
    ).resolves.toBeUndefined();
  });
});

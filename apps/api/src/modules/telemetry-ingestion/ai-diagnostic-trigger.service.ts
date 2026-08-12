import { Injectable, Logger } from '@nestjs/common';
import type { TelemetryLog } from '@gridstream/shared';

/**
 * Stage 5 seam. The queue consumer calls `trigger()` the moment it detects a
 * safety-bound breach — this stub just logs. Stage 5 replaces the body with
 * a real `generateObject()`/`tool()` call to the diagnostic agent, bound to
 * a FaultDiagnostic schema. Kept as its own injectable service (not inlined
 * into the consumer) specifically so Stage 5 is a change to one file, not a
 * rewrite of the queue-processing logic around it.
 */
@Injectable()
export class AiDiagnosticTriggerService {
  private readonly logger = new Logger(AiDiagnosticTriggerService.name);

  async trigger(deviceId: string, reading: TelemetryLog): Promise<void> {
    this.logger.warn(
      `AI diagnostic agent not implemented yet (Stage 5) — would trigger for device ${deviceId}. Reading: ${JSON.stringify(reading)}`,
    );
  }
}

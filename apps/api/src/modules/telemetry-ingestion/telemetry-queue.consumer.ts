import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { telemetryLogInsertSchema, telemetryLogs } from '@gridstream/shared';
import { DbService } from '../../common/db/db.service';
import { AiDiagnosticTriggerService } from './ai-diagnostic-trigger.service';
import { isAnomalous } from './telemetry-thresholds';
import { TELEMETRY_QUEUE } from './telemetry-ingestion.constants';

/**
 * TelemetryQueueConsumer
 *
 * Receives queued readings (from TelemetrySimulatorService today; a real
 * device-ingestion endpoint in the future would enqueue the same shape),
 * writes them to `telemetry_logs`, and triggers the AI diagnostic agent
 * seam when a safety bound is breached.
 */
@Injectable()
@Processor(TELEMETRY_QUEUE)
export class TelemetryQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(TelemetryQueueConsumer.name);

  constructor(
    private readonly dbService: DbService,
    private readonly aiDiagnosticTrigger: AiDiagnosticTriggerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // job.data crossed Redis as JSON — telemetryLogInsertSchema coerces
    // `timestamp` back into a real Date (see packages/shared/src/db/schema.ts).
    const reading = telemetryLogInsertSchema.parse(job.data);

    const [inserted] = await this.dbService.db.insert(telemetryLogs).values(reading).returning();

    if (isAnomalous(reading)) {
      this.logger.warn(`Anomaly detected for device ${reading.deviceId} (job ${job.id})`);
      await this.aiDiagnosticTrigger.trigger(reading.deviceId, inserted);
    }
  }
}

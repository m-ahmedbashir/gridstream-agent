import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DbModule } from '../../common/db/db.module';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { TelemetryQueueConsumer } from './telemetry-queue.consumer';
import { AiDiagnosticTriggerService } from './ai-diagnostic-trigger.service';
import { TELEMETRY_QUEUE } from './telemetry-ingestion.constants';

@Module({
  imports: [DbModule, BullModule.registerQueue({ name: TELEMETRY_QUEUE })],
  providers: [TelemetrySimulatorService, TelemetryQueueConsumer, AiDiagnosticTriggerService],
})
export class TelemetryIngestionModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DbModule } from '../../common/db/db.module';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module';
import { TelemetryIngestionController } from './telemetry-ingestion.controller';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { TelemetryQueueConsumer } from './telemetry-queue.consumer';
import { AiDiagnosticTriggerService } from './ai-diagnostic-trigger.service';
import { TELEMETRY_QUEUE } from './telemetry-ingestion.constants';

@Module({
  imports: [
    DbModule,
    DiagnosticsModule,
    BullModule.registerQueue({ name: TELEMETRY_QUEUE }),
  ],
  controllers: [TelemetryIngestionController],
  providers: [
    TelemetrySimulatorService,
    TelemetryQueueConsumer,
    AiDiagnosticTriggerService,
  ],
})
export class TelemetryIngestionModule {}

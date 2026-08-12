import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { deviceAssets } from '@gridstream/shared';
import { DbService } from '../../common/db/db.service';
import { generateReading } from './telemetry-reading-generator';
import { TELEMETRY_QUEUE } from './telemetry-ingestion.constants';

const DEFAULT_INTERVAL_MS = 5000;

/**
 * TelemetrySimulatorService
 *
 * Stands in for real smart-meter hardware: on a timer, picks a random
 * DeviceAsset and enqueues a plausible (occasionally anomalous) reading for
 * TelemetryQueueConsumer to process. Off by default — set
 * TELEMETRY_SIMULATOR_ENABLED=true to start it, so a plain `pnpm dev` stays
 * quiet. Run `pnpm db:seed` first; with no devices in `device_assets` it
 * logs a warning each tick and does nothing.
 */
@Injectable()
export class TelemetrySimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetrySimulatorService.name);
  private intervalHandle?: NodeJS.Timeout;

  constructor(
    @InjectQueue(TELEMETRY_QUEUE) private readonly queue: Queue,
    private readonly dbService: DbService,
  ) {}

  onModuleInit(): void {
    if (process.env.TELEMETRY_SIMULATOR_ENABLED !== 'true') {
      this.logger.log('Telemetry simulator disabled (set TELEMETRY_SIMULATOR_ENABLED=true to enable).');
      return;
    }

    const intervalMs = Number(process.env.TELEMETRY_SIMULATOR_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
    this.intervalHandle = setInterval(() => {
      this.tick().catch((error) => this.logger.error('Simulator tick failed', error));
    }, intervalMs);
    this.logger.log(`Telemetry simulator started (every ${intervalMs}ms).`);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  private async tick(): Promise<void> {
    const devices = await this.dbService.db.select().from(deviceAssets);
    if (devices.length === 0) {
      this.logger.warn('No devices in device_assets to simulate telemetry for — run `pnpm db:seed` first.');
      return;
    }

    const device = devices[Math.floor(Math.random() * devices.length)];
    const reading = generateReading(device);
    await this.queue.add('ingest-reading', reading);
  }
}

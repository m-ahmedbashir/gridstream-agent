import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { DbModule } from './common/db/db.module';
import { UsersModule } from './modules/users/users.module';
import { TelemetryIngestionModule } from './modules/telemetry-ingestion/telemetry-ingestion.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { DevicesModule } from './modules/devices/devices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // maxRetriesPerRequest: null is required by BullMQ's blocking connections
    // (see BullMQ's own docs) — without it, Worker construction throws.
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    DbModule,
    UsersModule,
    TelemetryIngestionModule,
    // Already pulled in transitively via TelemetryIngestionModule (for the
    // AI diagnostic trigger), but NestJS module resolution doesn't register
    // a module's controllers unless it's imported at the app level too —
    // this is what actually turns on DiagnosticsController's HTTP surface.
    DiagnosticsModule,
    DevicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

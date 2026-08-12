import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { DbModule } from './common/db/db.module';
import { UsersModule } from './modules/users/users.module';
import { TelemetryIngestionModule } from './modules/telemetry-ingestion/telemetry-ingestion.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

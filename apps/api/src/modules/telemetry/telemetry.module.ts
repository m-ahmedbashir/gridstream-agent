import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { ThingSpeakDemoFeedService } from './thingspeak-demo-feed.service';

@Module({
    imports: [PrismaModule],
    controllers: [TelemetryController],
    providers: [TelemetryService, ThingSpeakDemoFeedService],
})
export class TelemetryModule { }

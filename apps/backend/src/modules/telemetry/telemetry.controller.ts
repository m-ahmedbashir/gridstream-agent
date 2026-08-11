import { Controller, Get, Param } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('maintenance/machines')
export class TelemetryController {
    constructor(private readonly telemetryService: TelemetryService) { }

    @Get(':machineProfileId/telemetry')
    async getTelemetry(@Param('machineProfileId') machineProfileId: string) {
        return this.telemetryService.getSnapshot(machineProfileId);
    }
}

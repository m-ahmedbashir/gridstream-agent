import { Controller, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../common/auth/clerk-auth.guard';
import { TelemetrySimulatorService } from './telemetry-simulator.service';

@Controller('telemetry')
@UseGuards(ClerkAuthGuard)
export class TelemetryIngestionController {
  constructor(private readonly telemetrySimulatorService: TelemetrySimulatorService) {}

  /**
   * The "Simulate Chaos Event" dashboard button — an on-demand version of
   * what the automatic simulator does randomly, for demoing the full
   * ingestion → diagnosis → approval loop without waiting on a timer.
   */
  @Post('simulate-chaos')
  async simulateChaos() {
    return this.telemetrySimulatorService.simulateChaosEvent();
  }
}

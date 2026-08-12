import { Injectable, Logger } from '@nestjs/common';
import type { TelemetryLog } from '@gridstream/shared';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';

/**
 * The Stage 4 seam, now filled in: the queue consumer calls `trigger()` the
 * moment it detects a safety-bound breach, and this delegates straight to
 * the Stage 5 diagnostic agent. Stays its own class (rather than the
 * consumer calling DiagnosticsService directly) so the consumer's own
 * responsibility stays "persist + detect", not "and also know how
 * diagnosis works" — swapping or extending the diagnosis trigger logic
 * later (e.g. rate-limiting repeat triggers for the same device) is a
 * change to this one file.
 */
@Injectable()
export class AiDiagnosticTriggerService {
  private readonly logger = new Logger(AiDiagnosticTriggerService.name);

  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  async trigger(deviceId: string, reading: TelemetryLog): Promise<void> {
    try {
      await this.diagnosticsService.diagnose(deviceId, reading);
    } catch (error) {
      // Swallowed deliberately, per AGENTS.md's resilience convention: the
      // telemetry reading is already persisted by the time this runs, so a
      // failed diagnosis (model error, provider outage, no API key
      // configured) is a decorative-enrichment failure with a well-defined
      // fallback (no FaultDiagnostic this time), not a required call. Letting
      // it throw would also be actively harmful here specifically: BullMQ
      // would mark the whole job failed and retry it, re-running the
      // consumer's insert into telemetry_logs — which has no idempotency
      // key, so a retry would duplicate the reading, not just retry the
      // diagnosis.
      this.logger.error(
        `Diagnostic agent failed for device ${deviceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

import { and, avg, count, eq, gte } from 'drizzle-orm';
import { telemetryLogs } from '@gridstream/shared';
import type { DbService } from '../../../common/db/db.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface HistoricalBaseline {
  sampleCount: number;
  avgSolarProductionKwh: number | null;
  avgBatterySoC: number | null;
  avgBatteryTempCelsius: number | null;
  avgGridVoltage: number | null;
}

/**
 * Pure(ish) query function — no NestJS DI, just a DbService instance — so
 * it's testable with a mocked DbService without touching Nest. Called
 * directly by DiagnosticsService.diagnose() as deterministic pre-fetched
 * context, not as an AI SDK tool the model chooses whether to call: there's
 * no decision here for the model to usefully make (no arguments, the device
 * is already known), so wrapping this in an agentic tool-calling loop would
 * just be optional investigation the model could skip — see the removed
 * createGetHistoricalBaselineTool() this file used to export.
 */
export async function queryHistoricalBaseline(
  dbService: DbService,
  deviceId: string,
): Promise<HistoricalBaseline> {
  const since = new Date(Date.now() - ONE_DAY_MS);

  const [row] = await dbService.db
    .select({
      sampleCount: count(),
      avgSolarProductionKwh: avg(telemetryLogs.solarProductionKwh),
      avgBatterySoC: avg(telemetryLogs.batterySoC),
      avgBatteryTempCelsius: avg(telemetryLogs.batteryTempCelsius),
      avgGridVoltage: avg(telemetryLogs.gridVoltage),
    })
    .from(telemetryLogs)
    .where(
      and(
        eq(telemetryLogs.deviceId, deviceId),
        gte(telemetryLogs.timestamp, since),
      ),
    );

  return {
    sampleCount: Number(row?.sampleCount ?? 0),
    avgSolarProductionKwh:
      row?.avgSolarProductionKwh != null
        ? Number(row.avgSolarProductionKwh)
        : null,
    avgBatterySoC:
      row?.avgBatterySoC != null ? Number(row.avgBatterySoC) : null,
    avgBatteryTempCelsius:
      row?.avgBatteryTempCelsius != null
        ? Number(row.avgBatteryTempCelsius)
        : null,
    avgGridVoltage:
      row?.avgGridVoltage != null ? Number(row.avgGridVoltage) : null,
  };
}


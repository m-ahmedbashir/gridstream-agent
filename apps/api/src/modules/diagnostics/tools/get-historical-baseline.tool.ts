import type { Tool } from 'ai';
import { and, avg, count, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
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
 * it's testable with a mocked DbService without touching the AI SDK or Nest.
 */
export async function queryHistoricalBaseline(dbService: DbService, deviceId: string): Promise<HistoricalBaseline> {
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
    .where(and(eq(telemetryLogs.deviceId, deviceId), gte(telemetryLogs.timestamp, since)));

  return {
    sampleCount: Number(row?.sampleCount ?? 0),
    avgSolarProductionKwh: row?.avgSolarProductionKwh != null ? Number(row.avgSolarProductionKwh) : null,
    avgBatterySoC: row?.avgBatterySoC != null ? Number(row.avgBatterySoC) : null,
    avgBatteryTempCelsius: row?.avgBatteryTempCelsius != null ? Number(row.avgBatteryTempCelsius) : null,
    avgGridVoltage: row?.avgGridVoltage != null ? Number(row.avgGridVoltage) : null,
  };
}

/**
 * `deviceId` is closed over (bound at tool-construction time, one tool
 * instance per diagnosis call) rather than an input the model supplies —
 * the calling service already knows definitively which device triggered
 * this diagnosis, so there's nothing for the model to usefully decide here.
 * Asking it for an ID it could get wrong would just be a way to introduce a
 * bug; a minimal, precisely-typed input means an empty one when the real
 * input is already known.
 *
 * Async, and imports `tool` from `'ai'` lazily inside — not a stylistic
 * choice, the same ESM/CommonJS reason as `model-registry.ts`'s
 * `resolveModel()`: `ai` v7 is ESM-only, `apps/api` compiles to CommonJS, so
 * a static `import { tool } from 'ai'` would crash the real backend at boot
 * (confirmed here first by `pnpm test` itself failing this exact way before
 * a compiled boot was even attempted).
 */
export async function createGetHistoricalBaselineTool(dbService: DbService, deviceId: string): Promise<Tool<Record<string, never>, HistoricalBaseline>> {
  const { tool } = await import('ai');
  return tool({
    description:
      'Returns this device\'s 24-hour rolling average telemetry (solar production, battery state of charge, battery temperature, grid voltage) so the triggering reading can be compared against its own recent normal behavior, not just the fixed safety thresholds.',
    inputSchema: z.object({}),
    execute: async () => queryHistoricalBaseline(dbService, deviceId),
  });
}

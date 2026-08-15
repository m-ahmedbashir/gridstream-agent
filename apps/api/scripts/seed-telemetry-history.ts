import { Pool } from 'pg';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { deviceAssets, telemetryLogs, type NewTelemetryLog } from '@gridstream/shared';
import { generateReading } from '../src/modules/telemetry-ingestion/telemetry-reading-generator';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const READING_INTERVAL_MS = 30 * 60 * 1000; // one reading every 30 minutes
const READINGS_PER_DEVICE = ONE_DAY_MS / READING_INTERVAL_MS;

/**
 * One-time demo-data seed: backfills ~24h of plausible telemetry history per
 * device, inserted directly (not through the BullMQ queue — this is a bulk
 * historical backfill, not live ingestion, so there's no consumer/anomaly-
 * trigger step to go through). Without this, DiagnosticsService's
 * getHistoricalBaseline() tool has nothing to compare a live anomaly
 * against — every demo diagnosis would cite a baseline of "0 samples."
 *
 * Reuses generateReading() (the same pure function the simulator uses) for
 * realistic per-device-type values, just with backdated timestamps.
 * Occasional organic anomalies (its normal 10% chance) are left in on
 * purpose — real 24h history isn't perfectly clean, and these don't trigger
 * a diagnosis retroactively since they never pass through the queue
 * consumer.
 *
 * Idempotent-lite: skips entirely if telemetry_logs already has any rows,
 * rather than tracking per-device state — good enough for a one-time demo
 * seed, avoids silently bloating history on repeat runs.
 */
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const [{ total }] = await db.select({ total: count() }).from(telemetryLogs);
    if (Number(total) > 0) {
      console.log('telemetry_logs already has data — skipping (delete existing rows first to reseed).');
      return;
    }

    const devices = await db.select().from(deviceAssets);
    if (devices.length === 0) {
      console.log('No devices found — run `pnpm db:seed` first.');
      return;
    }

    const now = Date.now();
    const readings: NewTelemetryLog[] = [];
    for (const device of devices) {
      for (let i = READINGS_PER_DEVICE; i >= 1; i--) {
        const reading = generateReading(device);
        reading.timestamp = new Date(now - i * READING_INTERVAL_MS);
        readings.push(reading);
      }
    }

    await db.insert(telemetryLogs).values(readings);
    console.log(`Seeded ${readings.length} historical telemetry readings across ${devices.length} device(s) (last 24h, one every 30min).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seeding telemetry history failed:', error);
  process.exit(1);
});

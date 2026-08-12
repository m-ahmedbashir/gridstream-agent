import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { deviceAssets, type NewDeviceAsset } from '@gridstream/shared';

/**
 * One-time demo-data seed for local/dev use — the telemetry simulator
 * (TelemetrySimulatorService) needs at least one DeviceAsset to attach
 * readings to. Idempotent: re-running this is safe, `onConflictDoNothing()`
 * targets `serial_number`'s unique constraint, so already-seeded devices are
 * silently skipped rather than duplicated or erroring.
 *
 * Standalone script (not booted through Nest's DI container) — matches how
 * the old Prisma-era `prisma/seed.ts` worked: a plain script is simpler and
 * faster than spinning up the whole app just to insert four rows.
 */
const DEMO_DEVICES: NewDeviceAsset[] = [
  { deviceType: 'SOLAR', serialNumber: 'DEMO-SOLAR-001', location: 'Rooftop A', status: 'ONLINE' },
  { deviceType: 'BATTERY', serialNumber: 'DEMO-BATTERY-001', location: 'Basement Utility Room', status: 'ONLINE' },
  { deviceType: 'HEAT_PUMP', serialNumber: 'DEMO-HEATPUMP-001', location: 'Garden', status: 'ONLINE' },
  { deviceType: 'WALLBOX', serialNumber: 'DEMO-WALLBOX-001', location: 'Driveway', status: 'ONLINE' },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const inserted = await db.insert(deviceAssets).values(DEMO_DEVICES).onConflictDoNothing().returning({ serialNumber: deviceAssets.serialNumber });

    if (inserted.length === 0) {
      console.log('Demo devices already seeded — nothing to do.');
    } else {
      console.log(`Seeded ${inserted.length} demo device(s): ${inserted.map((d) => d.serialNumber).join(', ')}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});

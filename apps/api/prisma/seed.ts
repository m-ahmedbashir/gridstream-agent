import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// No-op for now: the maintenance-domain seed data (Measure catalog) was removed
// along with modules/maintenance/. This script is kept as the wired
// `prisma.seed` entry point for whatever the future VPP/telemetry domain needs
// to seed (e.g. demo DeviceAssets) — see REFACTOR_PROGRESS.md.
async function main() {
  // Intentionally empty.
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { PrismaClient } from '@prisma/client';
import { seedMeasures } from '../src/modules/maintenance/seed-measures';

const prisma = new PrismaClient();

async function main() {
  await seedMeasures(prisma);
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

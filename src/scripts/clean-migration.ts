import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const migrationName = '20251126202344_war_planning_init';
  console.log(`Deleting migration record: ${migrationName}`);
  
  const result = await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = ${migrationName}`;
  
  console.log(`Deleted ${result} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for duplicate WarFights...');

  // Group by warId, battlegroup, nodeId and find counts > 1
  const duplicates = await prisma.warFight.groupBy({
    by: ['warId', 'battlegroup', 'nodeId'],
    _count: {
      id: true,
    },
    having: {
      id: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Found ${duplicates.length} sets of duplicates.`);

  for (const dup of duplicates) {
    if (!dup.battlegroup) {
        console.log(`Skipping duplicate with null battlegroup (should be fixed already): War ${dup.warId}, Node ${dup.nodeId}`);
        continue;
    }
    console.log(`Processing duplicates for War: ${dup.warId}, BG: ${dup.battlegroup}, Node: ${dup.nodeId}, Count: ${dup._count.id}`);

    const fights = await prisma.warFight.findMany({
      where: {
        warId: dup.warId,
        battlegroup: dup.battlegroup,
        nodeId: dup.nodeId,
      },
      orderBy: {
        createdAt: 'desc', // Keep the newest one? Or oldest? Usually newest has more recent info.
      },
    });

    // Keep the first one, delete the rest
    const [keep, ...remove] = fights;
    
    console.log(`Keeping Fight ID: ${keep.id}, Deleting ${remove.length} others.`);

    for (const f of remove) {
        await prisma.warFight.delete({
            where: { id: f.id }
        });
    }
  }

  console.log('Duplicate cleanup complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding War Nodes 1-50...');
  
  const nodes = [];
  for (let i = 1; i <= 50; i++) {
    nodes.push({
      nodeNumber: i,
      description: `Node ${i}`,
    });
  }

  for (const node of nodes) {
    await prisma.warNode.upsert({
      where: { nodeNumber: node.nodeNumber },
      update: {},
      create: node,
    });
  }

  console.log('War Nodes seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

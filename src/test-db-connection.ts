
import { PrismaClient, QuestPlanStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const quests = await prisma.questPlan.findMany({
      where: { status: QuestPlanStatus.VISIBLE },
      take: 1
    });
    console.log('Successfully fetched quests:', quests.length);
    if (quests.length > 0) {
      console.log('VideoUrl field:', quests[0].videoUrl);
    }
  } catch (error) {
    console.error('Error fetching quests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

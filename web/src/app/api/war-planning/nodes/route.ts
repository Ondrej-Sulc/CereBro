import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { getFromCache } from '@/lib/cache';

// Cache node data for 1 hour as it's structurally static
const NODES_CACHE_TTL = 3600;

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const warId = searchParams.get('warId');
  const planId = searchParams.get('planId');

  if (!warId && !planId) {
    return NextResponse.json({ message: 'Missing warId or planId' }, { status: 400 });
  }

  try {
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "discord" },
    });
  
    if (!account?.providerAccountId) {
      return NextResponse.json({ message: 'No linked Discord account found.' }, { status: 403 });
    }
  
    const player = await prisma.player.findFirst({
      where: { discordId: account.providerAccountId },
      include: { alliance: true },
    });
  
    if (!player || !player.allianceId) {
        // Basic check for alliance membership
        return NextResponse.json({ message: 'You must be in an alliance.' }, { status: 403 });
    }

    let mapType = 'STANDARD';

    if (warId) {
        const war = await prisma.war.findUnique({
            where: { id: warId },
            select: { allianceId: true, mapType: true },
        });

        if (!war || war.allianceId !== player.allianceId) {
            return NextResponse.json({ message: 'War not found or not part of your alliance.' }, { status: 404 });
        }
        mapType = war.mapType;
    } else if (planId) {
         const plan = await prisma.warDefensePlan.findUnique({
            where: { id: planId },
            select: { allianceId: true, mapType: true },
         });

         if (!plan || plan.allianceId !== player.allianceId) {
            return NextResponse.json({ message: 'Defense plan not found or not part of your alliance.' }, { status: 404 });
         }
         mapType = plan.mapType;
    }

    // Fetch nodes with allocations, cached
    const nodes = await getFromCache(`war-nodes-${mapType}`, NODES_CACHE_TTL, async () => {
        return await prisma.warNode.findMany({
            orderBy: { nodeNumber: 'asc' },
            include: {
                allocations: {
                    include: {
                        nodeModifier: true
                    }
                }
            }
        });
    });

    return NextResponse.json(nodes);
  } catch (error) {
    logger.error({ error }, "Error fetching war nodes");
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

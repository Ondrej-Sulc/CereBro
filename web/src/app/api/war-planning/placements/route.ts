import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('planId');
  const battlegroupParam = searchParams.get('battlegroup');

  if (!planId) {
    return NextResponse.json({ message: 'Missing planId' }, { status: 400 });
  }

  const battlegroup = battlegroupParam ? parseInt(battlegroupParam) : undefined;

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
      return NextResponse.json({ message: 'You must be in an alliance.' }, { status: 403 });
    }

    const plan = await prisma.warDefensePlan.findUnique({
        where: { id: planId },
        select: { allianceId: true },
    });

    if (!plan || plan.allianceId !== player.allianceId) {
        return NextResponse.json({ message: 'Plan not found or not part of your alliance.' }, { status: 404 });
    }

    // Fetch placements (lightweight)
    const placements = await prisma.warDefensePlacement.findMany({
        where: { 
            planId,
            ...(battlegroup && { battlegroup })
        },
        select: {
            id: true,
            planId: true,
            battlegroup: true,
            nodeId: true,
            defenderId: true,
            starLevel: true, // New field
            playerId: true,
            node: {
                select: {
                    nodeNumber: true
                }
            },
            defender: {
                select: {
                    id: true,
                    name: true,
                    images: true,
                    class: true,
                    tags: { select: { name: true } }
                }
            },
            player: {
                select: {
                    id: true,
                    ingameName: true,
                    avatar: true
                }
            }
        },
        orderBy: {
            node: { nodeNumber: 'asc' }
        }
    });

    return NextResponse.json(placements);
  } catch (error) {
    logger.error({ error }, "Error fetching placements");
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

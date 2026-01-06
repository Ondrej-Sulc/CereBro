import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { getUserPlayerWithAlliance } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get('planId');
  const battlegroupParam = searchParams.get('battlegroup');

  if (!planId) {
    return NextResponse.json({ message: 'Missing planId' }, { status: 400 });
  }

  let battlegroup: number | undefined;
  if (battlegroupParam) {
      const parsed = parseInt(battlegroupParam, 10);
      if (!Number.isFinite(parsed)) {
          return NextResponse.json({ message: 'Invalid battlegroup parameter' }, { status: 400 });
      }
      battlegroup = parsed;
  }

  try {
    const player = await getUserPlayerWithAlliance();
  
    if (!player) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const isBotAdmin = player.isBotAdmin;
  
    if (!isBotAdmin && !player.allianceId) {
      return NextResponse.json({ message: 'You must be in an alliance.' }, { status: 403 });
    }

    const plan = await prisma.warDefensePlan.findUnique({
        where: { id: planId },
        select: { allianceId: true },
    });

    if (!plan) {
         return NextResponse.json({ message: 'Plan not found' }, { status: 404 });
    }

    if (!isBotAdmin && plan.allianceId !== player.allianceId) {
        return NextResponse.json({ message: 'Plan not part of your alliance.' }, { status: 404 }); // 404 to mask existence? Or 403.
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
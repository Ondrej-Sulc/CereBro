import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { getCachedChampions } from '@/lib/data/champions';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { player: true },
    });

    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const [champions, nodes, tactics] = await Promise.all([
      getCachedChampions(),
      prisma.warNode.findMany({
        select: {
          id: true,
          nodeNumber: true,
          description: true,
        },
        orderBy: {
          nodeNumber: 'asc',
        },
      }),
      prisma.warTactic.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    const alliancePlayers = uploadToken.player.allianceId
      ? await prisma.player.findMany({
          where: { allianceId: uploadToken.player.allianceId },
          orderBy: { ingameName: 'asc' },
          include: { alliance: true },
        })
      : [uploadToken.player];

    return NextResponse.json({
      champions,
      nodes,
      tactics,
      players: alliancePlayers,
      user: uploadToken.player,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching form data');
    return NextResponse.json({ error: 'Failed to fetch form data' }, { status: 500 });
  }
});

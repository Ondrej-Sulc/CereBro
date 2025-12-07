import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { getCachedChampions } from '@/lib/data/champions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
  }

  try {
    // 1. Validate the token and find the user
    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { 
        player: {
          include: { alliance: true }
        } 
      },
    });

    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 403 });
    }

    const user = uploadToken.player;
    if (!user) {
      return NextResponse.json({ error: 'User not found for this token' }, { status: 404 });
    }

    // 2. Fetch all data in parallel
    const [champions, nodes, alliancePlayers] = await Promise.all([
      getCachedChampions(),
      prisma.warNode.findMany({
        orderBy: { nodeNumber: 'asc' },
      }),
      user.allianceId
        ? prisma.player.findMany({
            where: { allianceId: user.allianceId },
            orderBy: { ingameName: 'asc' },
            include: { alliance: true },
          })
        : Promise.resolve([user]), // If user has no alliance, only return the user themselves
    ]);

    // 3. Return all data
    return NextResponse.json({
      user,
      champions,
      nodes,
      players: alliancePlayers,
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching form data');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

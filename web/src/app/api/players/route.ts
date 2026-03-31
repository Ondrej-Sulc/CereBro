import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { getFromCache } from '@/lib/cache';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async () => {
  try {
    const players = await getFromCache('players', 300, () => {
      return prisma.player.findMany({
        select: {
          id: true,
          ingameName: true,
          discordId: true,
          allianceId: true,
        },
        orderBy: {
          ingameName: 'asc',
        },
      });
    });
    return NextResponse.json(players, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching players');
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });       
  }
});

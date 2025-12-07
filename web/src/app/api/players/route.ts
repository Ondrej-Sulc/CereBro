import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { getFromCache } from '@/lib/cache';

export async function GET() {
  try {
    const players = await getFromCache('players', 3600, () => {
      return prisma.player.findMany({
        select: {
          id: true,
          ingameName: true,
        },
        orderBy: {
          ingameName: 'asc',
        },
      });
    });
    return NextResponse.json(players, { status: 200 });
  } catch (error) {
    logger.error({ error }, 'Error fetching players');
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

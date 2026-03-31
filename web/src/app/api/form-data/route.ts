import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from "@/lib/logger";
import { getCachedChampions } from '@/lib/data/champions';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (request: Request) => {
  try {
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

    return NextResponse.json({
      champions,
      nodes,
      tactics,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching form data');
    return NextResponse.json({ error: 'Failed to fetch form data' }, { status: 500 });
  }
});

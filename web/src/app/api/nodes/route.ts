import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromCache } from '@/lib/cache';
import logger from "@/lib/logger";
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async () => {
  try {
    const nodes = await getFromCache('nodes', 3600, () => {
      return prisma.warNode.findMany({
        select: {
          id: true,
          nodeNumber: true,
          description: true,
        },
        orderBy: {
          nodeNumber: 'asc',
        },
      });
    });
    return NextResponse.json(nodes, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching war nodes');
    return NextResponse.json({ error: 'Failed to fetch war nodes' }, { status: 500 });       
  }
});

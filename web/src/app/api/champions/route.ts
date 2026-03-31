import { NextResponse } from 'next/server';
import { getCachedChampions } from '@/lib/data/champions';
import logger from "@/lib/logger";
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async () => {
  try {
    const champions = await getCachedChampions();
    return NextResponse.json(champions, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching champions');
    return NextResponse.json({ error: 'Failed to fetch champions' }, { status: 500 });       
  }
});

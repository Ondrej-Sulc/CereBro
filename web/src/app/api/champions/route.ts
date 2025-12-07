import { NextResponse } from 'next/server';
import { getCachedChampions } from '@/lib/data/champions';
import loggerService from '@cerebro/core/services/loggerService';

export async function GET() {
  try {
    const champions = await getCachedChampions();
    return NextResponse.json(champions, { status: 200 });
  } catch (error) {
    loggerService.error({ err: error }, 'Error fetching champions');
    return NextResponse.json({ error: 'Failed to fetch champions' }, { status: 500 });
  }
}

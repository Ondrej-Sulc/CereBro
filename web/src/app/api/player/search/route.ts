import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const players = await prisma.player.findMany({
      where: {
        ingameName: {
          contains: q,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        ingameName: true,
        avatar: true,
        allianceId: true,
        alliance: {
            select: { name: true }
        }
      },
      take: 10
    });

    return NextResponse.json(players);
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
});

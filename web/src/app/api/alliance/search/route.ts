import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json([]);
  }

  try {
    const alliances = await prisma.alliance.findMany({
      where: {
        name: {
          contains: q,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true }
        }
      },
      take: 20
    });

    return NextResponse.json(alliances);
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
});

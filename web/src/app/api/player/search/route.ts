import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

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
}
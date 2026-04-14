import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { isUserBotAdmin } from '@/lib/auth-helpers';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const isAdmin = await isUserBotAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '10', 10)));

  try {
    const [totalCount, members] = await prisma.$transaction([
      prisma.player.count({ where: { allianceId: id } }),
      prisma.player.findMany({
        where: { allianceId: id },
        select: {
          id: true,
          avatar: true,
          ingameName: true,
          summonerPrestige: true,
          championPrestige: true,
          isOfficer: true,
          battlegroup: true,
          timezone: true,
          createdAt: true,
          _count: { select: { roster: true } },
        },
        orderBy: { ingameName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      members,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error) {
    logger.error({ err: error, allianceId: id }, 'Failed to fetch alliance members');
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
});

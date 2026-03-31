import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserBotAdmin } from '@/lib/auth-helpers';
import { withRouteContext } from '@/lib/with-request-context';

export const GET = withRouteContext(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const isAdmin = await isUserBotAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const members = await prisma.player.findMany({
      where: {
        allianceId: id
      },
      select: {
        id: true,
        ingameName: true,
        discordId: true,
        isOfficer: true,
        botUser: {
          select: {
            id: true,
            avatar: true
          }
        }
      },
      orderBy: {
        ingameName: 'asc'
      }
    });

    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
});

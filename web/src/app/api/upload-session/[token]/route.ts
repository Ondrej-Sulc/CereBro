import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { add } from 'date-fns';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const resolvedParams = await context.params;
  const { token } = resolvedParams;

  if (!token) {
    return NextResponse.json({ error: 'Missing session token' }, { status: 400 });
  }

  try {
    // 1. Find and validate the session
    const session = await prisma.uploadSession.findUnique({
      where: { token },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.uploadSession.delete({ where: { token } });
      }
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    // 2. Fetch all WarFight details for the session
    const warFights = await prisma.warFight.findMany({
      where: { id: { in: session.fightIds } },
      include: {
        war: true,
        player: {
          include: { alliance: true }
        },
        attacker: true,
        defender: true,
        node: true,
        prefightChampions: {
            include: { champion: true }
        },
      },
    });

    if (warFights.length === 0) {
      return NextResponse.json({ error: 'No fights found for this session' }, { status: 404 });
    }

    // Transform to match frontend expectation (prefightChampions as Champion[])
    const formattedFights = warFights.map(fight => ({
        ...fight,
        prefightChampions: fight.prefightChampions.map(pf => pf.champion)
    }));

    // 3. All fights belong to the same player; get the user from the first one.
    const user = warFights[0].player;
    if (!user) {
      return NextResponse.json({ error: 'Player not found for these fights' }, { status: 404 });
    }

    // 4. Generate a temporary upload token for the form submission
    const uploadTokenValue = crypto.randomBytes(32).toString('hex');
    const expiresAt = add(new Date(), { minutes: 30 }); // Give enough time to fill the form
    const uploadToken = await prisma.uploadToken.create({
      data: {
        token: uploadTokenValue,
        playerId: user.id,
        expiresAt: expiresAt,
      },
    });

    // 5. Fetch all generic form data in parallel
    const [champions, nodes, alliancePlayers] = await Promise.all([
      prisma.champion.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          class: true,
          images: true,
          abilities: {
            select: {
              ability: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.warNode.findMany({
        orderBy: { nodeNumber: 'asc' },
      }),
      user.allianceId
        ? prisma.player.findMany({
            where: { allianceId: user.allianceId },
            orderBy: { ingameName: 'asc' },
            include: { alliance: true },
          })
        : Promise.resolve([user]), // If user has no alliance, only return the user
    ]);

    // 6. Clean up - REMOVED: Session should persist until expiry to allow refreshes
    // await prisma.uploadSession.delete({ where: { token } });

    // 7. Return the combined data payload
    return NextResponse.json({
      fights: formattedFights,
      user,
      champions,
      nodes,
      players: alliancePlayers,
      token: uploadToken.token,
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err }, 'Error fetching upload session');
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { getCachedChampions } from '@/lib/data/champions';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const warId = searchParams.get('warId');
  const battlegroup = searchParams.get('battlegroup');

  if (!warId || !battlegroup) {
    return NextResponse.json({ message: 'Missing warId or battlegroup' }, { status: 400 });
  }

  // Validate battlegroup is a number
  const bgNum = parseInt(battlegroup, 10);
  if (isNaN(bgNum) || bgNum < 1 || bgNum > 3) {
    return NextResponse.json({ message: 'Invalid battlegroup' }, { status: 400 });
  }

  try {
    // Check if the user is an officer of the alliance the war belongs to
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "discord",
      },
    });
  
    if (!account?.providerAccountId) {
      return NextResponse.json({ message: 'No linked Discord account found.' }, { status: 403 });
    }
  
    const player = await prisma.player.findFirst({
      where: { discordId: account.providerAccountId },
      include: { alliance: true },
    });
  
    if (!player || !player.allianceId) {
      return NextResponse.json({ message: 'You must be in an Alliance to access this resource.' }, { status: 403 });
    }

    const war = await prisma.war.findUnique({
        where: { id: warId },
        select: { allianceId: true },
    });

    if (!war || war.allianceId !== player.allianceId) {
        return NextResponse.json({ message: 'War not found or not part of your alliance.' }, { status: 404 });
    }

    const fights = await prisma.warFight.findMany({
      where: {
        warId: warId,
        battlegroup: bgNum,
      },
      include: {
        node: {
            select: {
                nodeNumber: true
            }
        }, // Only fetch nodeNumber, client handles static data
        player: { select: { id: true, ingameName: true, avatar: true } }, // Include player details
        prefightChampions: { 
            select: { 
                id: true, // This is the WarFightPrefight ID
                championId: true,
                player: { select: { id: true, ingameName: true, avatar: true } }
            } 
        },
      },
    });

    const champions = await getCachedChampions();
    const championMap = new Map(champions.map(c => [c.id, c]));

    // Map the result to match the interface
    const mappedFights = fights.map(f => {
        const attacker = f.attackerId ? championMap.get(f.attackerId) : null;
        const defender = f.defenderId ? championMap.get(f.defenderId) : null;

        return {
            ...f,
            attacker: attacker ? {
                id: attacker.id,
                name: attacker.name,
                images: attacker.images,
                class: attacker.class,
                tags: attacker.tags
            } : null,
            defender: defender ? {
                id: defender.id,
                name: defender.name,
                images: defender.images,
                class: defender.class,
                tags: defender.tags
            } : null,
            prefightChampions: f.prefightChampions.map(pf => {
                const champ = championMap.get(pf.championId);
                return {
                    id: pf.championId,
                    name: champ?.name,
                    images: champ?.images,
                    fightPrefightId: pf.id,
                    player: pf.player
                }
            })
        };
    });

    return NextResponse.json(mappedFights);
  } catch (error) {
    logger.error({ error }, "Error fetching war fights");
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

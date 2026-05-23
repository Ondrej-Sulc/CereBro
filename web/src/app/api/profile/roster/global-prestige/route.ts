import { NextRequest, NextResponse } from "next/server";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { buildGlobalPrestigeList, normalizeGlobalPrestigeListOptions } from "@/lib/global-prestige-list";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { defaultRosterPrestigeTargetRank } from "@/lib/roster-recommendation-service";
import { withRouteContext } from "@/lib/with-request-context";
import type { ChampionImages } from "@/types/champion";

export const GET = withRouteContext(async (req: NextRequest) => {
  const currentUser = await getUserPlayerWithAlliance();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetPlayerId = searchParams.get("playerId") || currentUser.id;

  if (targetPlayerId !== currentUser.id && !currentUser.isBotAdmin) {
    const targetPlayer = await prisma.player.findUnique({
      where: { id: targetPlayerId },
      select: { allianceId: true },
    });

    if (!targetPlayer || targetPlayer.allianceId !== currentUser.allianceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const roster = await prisma.roster.findMany({
      where: { playerId: targetPlayerId },
      select: {
        id: true,
        championId: true,
        stars: true,
        rank: true,
        sigLevel: true,
        ascensionLevel: true,
      },
    });
    const options = normalizeGlobalPrestigeListOptions(searchParams, {
      targetRank: defaultRosterPrestigeTargetRank(roster),
    }, "api");

    const [champions, prestigeRows] = await Promise.all([
      prisma.champion.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          class: true,
          images: true,
          obtainable: true,
          isPlayable: true,
          tags: { select: { name: true } },
        },
      }),
      prisma.championPrestige.findMany({
        where: { sig: { in: [0, 1, 99, 200] } },
        select: { championId: true, rarity: true, rank: true, sig: true, prestige: true },
      }),
    ]);

    return NextResponse.json(buildGlobalPrestigeList({
      champions: champions.map(champion => ({
        ...champion,
        images: champion.images as unknown as ChampionImages,
      })),
      roster,
      prestigeRows,
      options,
    }));
  } catch (error) {
    logger.error({ err: error, targetPlayerId }, "Failed to load global prestige list");
    return NextResponse.json({ error: "Failed to load global prestige list" }, { status: 500 });
  }
});

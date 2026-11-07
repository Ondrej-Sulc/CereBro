import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { clearCache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { withRouteContext } from "@/lib/with-request-context";
import { getChampionAscension } from "@cerebro/core/data/game-ascension";
import { normalizeRosterAscensionState, resolveRosterAscensionUpdate } from "@cerebro/core/domain/roster-ascension-state";
import { withChampionAscensionLimits } from "@/lib/champion-ascension-payload";

const addSchema = z.object({
  championId: z.number().int().min(1),
  stars: z.number().int().min(1).max(7),
  rank: z.number().int().min(1).max(6),
  sigLevel: z.number().int().min(0).max(200).optional().default(0),
  isAwakened: z.boolean().optional().default(false),
  isAscended: z.boolean().optional(),
  ascensionLevel: z.number().int().min(0).max(2147483647).optional(),
  targetPlayerId: z.string().optional(),
});

async function addChampionUpsert(playerId: string, data: z.infer<typeof addSchema>, maxLevel: number | null) {
    const current = await prisma.roster.findUnique({
      where: { playerId_championId_stars: { playerId, championId: data.championId, stars: data.stars } },
      select: { isAscended: true, ascensionLevel: true },
    });
    const ascension = resolveRosterAscensionUpdate({ isAscended: data.isAscended, ascensionLevel: data.ascensionLevel }, { current: current ?? undefined, maxLevel });
    if (!ascension.ok) throw new z.ZodError([{ code: "custom", path: ["ascensionLevel"], message: ascension.message }]);
    const updatesAscension = data.isAscended !== undefined || data.ascensionLevel !== undefined;
    return prisma.roster.upsert({
      where: {
        playerId_championId_stars: {
          playerId,
          championId: data.championId,
          stars: data.stars,
        },
      },
      update: {
        rank: data.rank,
        sigLevel: data.sigLevel,
        isAwakened: data.isAwakened,
        ...(updatesAscension ? ascension.value : {}),
      },
      create: {
        playerId,
        championId: data.championId,
        stars: data.stars,
        rank: data.rank,
        sigLevel: data.sigLevel,
        isAwakened: data.isAwakened,
        ...ascension.value,
      },
      include: {
        champion: {
          include: {
            tags: { select: { id: true, name: true } },
            abilities: {
              include: {
                ability: {
                  select: {
                    name: true,
                    categories: { select: { name: true } }
                  }
                },
                synergyChampions: {
                  include: { champion: { select: { name: true, images: true } } }
                }
              }
            }
          }
        },
      },
    });
}

export const POST = withRouteContext(async (req: Request) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = addSchema.parse(body);

    let effectivePlayerId = player.id;
    if (data.targetPlayerId && data.targetPlayerId !== player.id) {
      const targetPlayer = await prisma.player.findUnique({
        where: { id: data.targetPlayerId },
        select: { id: true, allianceId: true, ingameName: true },
      });
      if (!targetPlayer) {
        return NextResponse.json({ error: "Target player not found" }, { status: 404 });
      }
      const isOfficerSameAlliance =
        player.isOfficer &&
        player.allianceId !== null &&
        player.allianceId === targetPlayer.allianceId;
      if (!player.isBotAdmin && !isOfficerSameAlliance) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      logger.info(
        {
          actor: player.id,
          actorName: player.ingameName,
          target: targetPlayer.id,
          targetName: targetPlayer.ingameName,
          action: "add",
          championId: data.championId,
          stars: data.stars,
          rank: data.rank,
        },
        "Officer/admin roster add"
      );
      effectivePlayerId = data.targetPlayerId;
    }

    const champion = await prisma.champion.findUnique({ where: { id: data.championId }, select: { gameId: true } });
    if (!champion) return NextResponse.json({ error: "Champion not found" }, { status: 404 });
    const maxLevel = getChampionAscension(champion.gameId, data.stars)?.maxLevel ?? null;
    let newRoster;
    try {
        newRoster = await addChampionUpsert(effectivePlayerId, data, maxLevel);
    } catch (upsertError) {
        // Handle race condition where record might have been created between existence check and create in upsert
        if (upsertError instanceof Prisma.PrismaClientKnownRequestError && upsertError.code === 'P2002') {
             logger.warn({ playerId: player.id, championId: data.championId }, "Retrying champion add due to P2002 race condition");
             newRoster = await addChampionUpsert(effectivePlayerId, data, maxLevel);
        } else {
            throw upsertError;
        }
    }

    revalidatePath("/profile/roster");
    revalidatePath("/champions");
    if (effectivePlayerId !== player.id) {
      revalidatePath(`/player/${effectivePlayerId}/roster`);
    }
    if (player.allianceId) clearCache(`alliance-members-${player.allianceId}`);
    return NextResponse.json({ ...newRoster, ...normalizeRosterAscensionState(newRoster), champion: newRoster.champion ? withChampionAscensionLimits(newRoster.champion) : newRoster.champion });
  } catch (error) {
    logger.error({ error }, "Error adding champion");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

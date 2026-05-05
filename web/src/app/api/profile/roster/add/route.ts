import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { clearCache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { withRouteContext } from "@/lib/with-request-context";
import { maxAscensionLevelForRarity } from "@/lib/mcoc-prestige";

const addSchema = z.object({
  championId: z.number().int().min(1),
  stars: z.number().int().min(1).max(7),
  rank: z.number().int().min(1).max(6),
  sigLevel: z.number().int().min(0).max(200).optional().default(0),
  isAwakened: z.boolean().optional().default(false),
  isAscended: z.boolean().optional().default(false),
  ascensionLevel: z.number().int().min(0).max(5).optional().default(0),
  targetPlayerId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.ascensionLevel > maxAscensionLevelForRarity(data.stars)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ascensionLevel"],
      message: "Ascension level is only allowed for 7-star champions.",
    });
  }
});

async function addChampionUpsert(playerId: string, data: z.infer<typeof addSchema>) {
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
        isAscended: data.isAscended,
        ascensionLevel: data.ascensionLevel,
      },
      create: {
        playerId,
        championId: data.championId,
        stars: data.stars,
        rank: data.rank,
        sigLevel: data.sigLevel,
        isAwakened: data.isAwakened,
        isAscended: data.isAscended,
        ascensionLevel: data.ascensionLevel,
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

    let newRoster;
    try {
        newRoster = await addChampionUpsert(effectivePlayerId, data);
    } catch (upsertError) {
        // Handle race condition where record might have been created between existence check and create in upsert
        if (upsertError instanceof Prisma.PrismaClientKnownRequestError && upsertError.code === 'P2002') {
             logger.warn({ playerId: player.id, championId: data.championId }, "Retrying champion add due to P2002 race condition");
             newRoster = await addChampionUpsert(player.id, data);
        } else {
            throw upsertError;
        }
    }

    revalidatePath("/profile/roster");
    if (effectivePlayerId !== player.id) {
      revalidatePath(`/player/${effectivePlayerId}/roster`);
    }
    if (player.allianceId) clearCache(`alliance-members-${player.allianceId}`);
    return NextResponse.json(newRoster);
  } catch (error) {
    logger.error({ error }, "Error adding champion");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

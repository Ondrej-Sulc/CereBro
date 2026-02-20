import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@cerebro/core/services/loggerService";
import { Prisma } from "@prisma/client";

const addSchema = z.object({
  championId: z.number().int().min(1),
  stars: z.number().int().min(1).max(7),
  rank: z.number().int().min(1).max(6),
  sigLevel: z.number().int().min(0).max(200).optional().default(0),
  isAwakened: z.boolean().optional().default(false),
  isAscended: z.boolean().optional().default(false),
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
      },
      create: {
        playerId,
        championId: data.championId,
        stars: data.stars,
        rank: data.rank,
        sigLevel: data.sigLevel,
        isAwakened: data.isAwakened,
        isAscended: data.isAscended,
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

export async function POST(req: Request) {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = addSchema.parse(body);

    let newRoster;
    try {
        newRoster = await addChampionUpsert(player.id, data);
    } catch (upsertError) {
        // Handle race condition where record might have been created between existence check and create in upsert
        if (upsertError instanceof Prisma.PrismaClientKnownRequestError && upsertError.code === 'P2002') {
             logger.warn({ playerId: player.id, championId: data.championId }, "Retrying champion add due to P2002 race condition");
             newRoster = await addChampionUpsert(player.id, data);
        } else {
            throw upsertError;
        }
    }

    return NextResponse.json(newRoster);
  } catch (error) {
    logger.error({ error }, "Error adding champion");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

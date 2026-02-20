import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@cerebro/core/services/loggerService";

const addSchema = z.object({
  championId: z.number(),
  stars: z.number().min(1).max(7),
  rank: z.number().min(1).max(6),
  sigLevel: z.number().min(0).max(200).optional().default(0),
  isAwakened: z.boolean().optional().default(false),
  isAscended: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { championId, stars, rank, sigLevel, isAwakened, isAscended } = addSchema.parse(body);

    const newRoster = await prisma.roster.upsert({
      where: {
        playerId_championId_stars: {
          playerId: player.id,
          championId,
          stars,
        },
      },
      update: {
        rank,
        sigLevel,
        isAwakened,
        isAscended,
      },
      create: {
        playerId: player.id,
        championId,
        stars,
        rank,
        sigLevel,
        isAwakened,
        isAscended,
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

    return NextResponse.json(newRoster);
  } catch (error) {
    logger.error({ error }, "Error adding champion");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: (error as z.ZodError).issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { z } from "zod";
import { withRouteContext } from "@/lib/with-request-context";

const updateSchema = z.object({
  championPrestige: z.number().int().positive(),
});

export const POST = withRouteContext(async (req: Request) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { championPrestige } = updateSchema.parse(body);

    // Only update if it changed significantly (more than 1 point)
    if (Math.abs(championPrestige - (player.championPrestige || 0)) > 1) {
      logger.info({ playerId: player.id, old: player.championPrestige, new: championPrestige }, "Updating player prestige via POST");
      
      const newSummonerPrestige = (player.summonerPrestige === player.championPrestige || !player.summonerPrestige) 
        ? championPrestige + (player.relicPrestige || 0)
        : player.summonerPrestige;

      try {
        await prisma.$transaction([
          prisma.player.update({
            where: { id: player.id },
            data: { 
              championPrestige: championPrestige,
              summonerPrestige: newSummonerPrestige
            }
          }),
          prisma.prestigeLog.create({
            data: {
              playerId: player.id,
              championPrestige: championPrestige,
              summonerPrestige: newSummonerPrestige,
              relicPrestige: player.relicPrestige || 0
            }
          })
        ]);
      } catch (dbError) {
        logger.error({ playerId: player.id, error: dbError }, "Error in prestige update transaction");
        throw dbError; // Propagate to outer catch for 500 response
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error in update-prestige route");
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { clearCache } from "@/lib/cache";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

const reservationSchema = z.object({
  rosterId: z.string().min(1),
  reservedForAttack: z.boolean(),
});

export const PATCH = withRouteContext(async (req: Request) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = reservationSchema.parse(body);

    const rosterEntry = await prisma.roster.findUnique({
      where: { id: data.rosterId },
      include: {
        player: {
          select: {
            id: true,
            ingameName: true,
            allianceId: true,
          },
        },
      },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    const isOwner = rosterEntry.playerId === player.id;
    const canPlanSameAlliance =
      player.allianceId !== null &&
      player.allianceId === rosterEntry.player.allianceId &&
      canPlanAllianceWar(player, player.isBotAdmin);

    if (!isOwner && !player.isBotAdmin && !canPlanSameAlliance) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!isOwner) {
      logger.info(
        {
          actor: player.id,
          actorName: player.ingameName,
          target: rosterEntry.playerId,
          targetName: rosterEntry.player.ingameName,
          rosterId: rosterEntry.id,
          championId: rosterEntry.championId,
          stars: rosterEntry.stars,
          reservedForAttack: data.reservedForAttack,
        },
        "Planner/admin roster attack reservation update"
      );
    }

    const updatedRoster = await prisma.roster.update({
      where: { id: data.rosterId },
      data: { reservedForAttack: data.reservedForAttack },
    });

    revalidatePath("/profile/roster");
    revalidatePath(`/player/${rosterEntry.playerId}/roster`);
    if (rosterEntry.player.allianceId) {
      clearCache(`alliance-members-${rosterEntry.player.allianceId}`);
    }

    return NextResponse.json(updatedRoster);
  } catch (error) {
    logger.error({ error }, "Error updating roster attack reservation");
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

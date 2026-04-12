import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { clearCache } from "@/lib/cache";
import { withRouteContext } from "@/lib/with-request-context";

const updateSchema = z.object({
  id: z.string(),
  rank: z.number().min(1).max(10).optional(),
  isAwakened: z.boolean().optional(),
  isAscended: z.boolean().optional(),
  ascensionLevel: z.number().min(0).max(2).optional(),
  sigLevel: z.number().min(0).max(200).optional(),
});

const deleteSchema = z.object({
  id: z.string(),
});

export const PUT = withRouteContext(async (req: Request) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, rank, isAwakened, isAscended, ascensionLevel, sigLevel } = updateSchema.parse(body);

    const rosterEntry = await prisma.roster.findUnique({
      where: { id },
      include: { player: { select: { allianceId: true, ingameName: true } } },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    const isOwner = rosterEntry.playerId === player.id;
    const isOfficerSameAlliance =
      player.isOfficer &&
      player.allianceId !== null &&
      player.allianceId === rosterEntry.player.allianceId;
    if (!isOwner && !player.isBotAdmin && !isOfficerSameAlliance) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!isOwner) {
      logger.info(
        {
          actor: player.id,
          actorName: player.ingameName,
          target: rosterEntry.playerId,
          targetName: rosterEntry.player.ingameName,
          action: "edit",
          rosterId: id,
        },
        "Officer/admin roster edit"
      );
    }

    const updatedRoster = await prisma.roster.update({
      where: { id },
      data: {
        rank,
        isAwakened,
        isAscended,
        ascensionLevel,
        sigLevel,
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

    revalidatePath("/profile/roster");
    revalidatePath(`/player/${rosterEntry.playerId}/roster`);
    if (player.allianceId) clearCache(`alliance-members-${player.allianceId}`);
    if (rosterEntry.player.allianceId && rosterEntry.player.allianceId !== player.allianceId) {
      clearCache(`alliance-members-${rosterEntry.player.allianceId}`);
    }
    return NextResponse.json(updatedRoster);
  } catch (error) {
    logger.error({ error }, "Error updating roster");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: (error as z.ZodError).issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

export const DELETE = withRouteContext(async (req: Request) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = deleteSchema.parse(body);

    const rosterEntry = await prisma.roster.findUnique({
      where: { id },
      include: { player: { select: { allianceId: true, ingameName: true } } },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    const isOwner = rosterEntry.playerId === player.id;
    const isOfficerSameAlliance =
      player.isOfficer &&
      player.allianceId !== null &&
      player.allianceId === rosterEntry.player.allianceId;
    if (!isOwner && !player.isBotAdmin && !isOfficerSameAlliance) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!isOwner) {
      logger.info(
        {
          actor: player.id,
          actorName: player.ingameName,
          target: rosterEntry.playerId,
          targetName: rosterEntry.player.ingameName,
          action: "delete",
          rosterId: id,
        },
        "Officer/admin roster delete"
      );
    }

    const targetPlayerId = rosterEntry.playerId;
    const targetAllianceId = rosterEntry.player.allianceId;

    await prisma.roster.delete({
      where: { id },
    });

    revalidatePath("/profile/roster");
    revalidatePath(`/player/${targetPlayerId}/roster`);
    if (player.allianceId) clearCache(`alliance-members-${player.allianceId}`);
    if (targetAllianceId && targetAllianceId !== player.allianceId) {
      clearCache(`alliance-members-${targetAllianceId}`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error deleting roster");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: (error as z.ZodError).issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

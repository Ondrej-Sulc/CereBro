import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@cerebro/core/services/loggerService";

const updateSchema = z.object({
  id: z.string(),
  rank: z.number().min(1).max(10).optional(),
  isAwakened: z.boolean().optional(),
  isAscended: z.boolean().optional(),
  sigLevel: z.number().min(0).max(200).optional(),
});

const deleteSchema = z.object({
  id: z.string(),
});

export async function PUT(req: Request) {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, rank, isAwakened, isAscended, sigLevel } = updateSchema.parse(body);

    const rosterEntry = await prisma.roster.findUnique({
      where: { id },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    if (rosterEntry.playerId !== player.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedRoster = await prisma.roster.update({
      where: { id },
      data: {
        rank,
        isAwakened,
        isAscended,
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

    return NextResponse.json(updatedRoster);
  } catch (error) {
    logger.error({ error }, "Error updating roster");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: (error as z.ZodError).issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = deleteSchema.parse(body);

    const rosterEntry = await prisma.roster.findUnique({
      where: { id },
    });

    if (!rosterEntry) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    if (rosterEntry.playerId !== player.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.roster.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error deleting roster");
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: (error as z.ZodError).issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

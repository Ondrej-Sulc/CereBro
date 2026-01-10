import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@cerebro/core/services/loggerService";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  try {
    const players = await prisma.player.findMany({
      where: {
        ingameName: {
          contains: q,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        ingameName: true,
        avatar: true,
      },
      take: 20,
    });

    return NextResponse.json({ players });
  } catch (error) {
    logger.error({ error }, "Error searching players");
    return NextResponse.json({ error: "Failed to search players" }, { status: 500 });
  }
}
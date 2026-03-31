import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

export const GET = withRouteContext(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ players: [] });
  }

  try {
    const players = await prisma.player.findMany({
      where: {
        ingameName: {
          contains: query,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        ingameName: true,
        alliance: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
    });

    return NextResponse.json({ players });
  } catch (error) {
    logger.error({ error, query }, "Error searching players");
    return NextResponse.json({ players: [], error: "Search failed" }, { status: 500 });
  }
});

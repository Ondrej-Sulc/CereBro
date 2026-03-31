import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { auth } from "@/auth";
import { withRouteContext } from "@/lib/with-request-context";

export const GET = withRouteContext(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.botUser.findMany({
      where: {
        OR: [
          { discordId: { contains: query, mode: "insensitive" } },
          { id: { contains: query, mode: "insensitive" } },
          { profiles: { some: { ingameName: { contains: query, mode: "insensitive" } } } }
        ]
      },
      select: {
        id: true,
        discordId: true,
        avatar: true,
        profiles: {
          select: {
            id: true,
            ingameName: true
          }
        }
      },
      take: 10
    });

    return NextResponse.json(users);
  } catch (error) {
    logger.error({ error, query }, "Error searching users");
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
});

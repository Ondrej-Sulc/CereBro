import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

export const GET = withRouteContext(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ players: [], alliances: [] });
  }

  try {
    const [players, alliances] = await Promise.all([
      prisma.player.findMany({
        where: {
          ingameName: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          ingameName: true,
          avatar: true,
          championPrestige: true,
          alliance: {
            select: {
              id: true,
              name: true,
              tag: true,
            },
          },
          _count: {
            select: {
              roster: true,
            },
          },
        },
        orderBy: { ingameName: "asc" },
        take: 8,
      }),
      prisma.alliance.findMany({
        where: {
          AND: [
            { members: { some: {} } },
            {
              NOT: [
                { name: { equals: "GLOBAL", mode: "insensitive" } },
                { tag: { equals: "GLOBAL", mode: "insensitive" } },
              ],
            },
            {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { tag: { contains: query, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          tag: true,
          inviteOnly: true,
          _count: {
            select: {
              members: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: 8,
      }),
    ]);

    return NextResponse.json({ players, alliances });
  } catch (error) {
    logger.error({ error, query }, "Error searching directory suggestions");
    return NextResponse.json({ players: [], alliances: [], error: "Search failed" }, { status: 500 });
  }
});

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";
import { buildNonGlobalAllianceWhere, rankAllianceDirectoryMatch, rankPlayerDirectoryMatch } from "@/lib/directory-search";

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
        take: 24,
      }),
      prisma.alliance.findMany({
        where: {
          AND: [
            { members: { some: {} } },
            buildNonGlobalAllianceWhere(),
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
        take: 24,
      }),
    ]);

    return NextResponse.json({
      players: players
        .sort((a, b) => {
          const aRank = rankPlayerDirectoryMatch({
            query,
            ingameName: a.ingameName,
            allianceName: a.alliance?.name,
            allianceTag: a.alliance?.tag,
            rosterCount: a._count.roster,
            championPrestige: a.championPrestige,
          });
          const bRank = rankPlayerDirectoryMatch({
            query,
            ingameName: b.ingameName,
            allianceName: b.alliance?.name,
            allianceTag: b.alliance?.tag,
            rosterCount: b._count.roster,
            championPrestige: b.championPrestige,
          });
          return aRank - bRank || a.ingameName.localeCompare(b.ingameName, undefined, { sensitivity: "base" });
        })
        .slice(0, 8),
      alliances: alliances
        .sort((a, b) => {
          const aRank = rankAllianceDirectoryMatch({
            query,
            name: a.name,
            tag: a.tag,
            memberCount: a._count.members,
            inviteOnly: a.inviteOnly,
          });
          const bRank = rankAllianceDirectoryMatch({
            query,
            name: b.name,
            tag: b.tag,
            memberCount: b._count.members,
            inviteOnly: b.inviteOnly,
          });
          return aRank - bRank || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        })
        .slice(0, 8),
    });
  } catch (error) {
    logger.error({ error, query }, "Error searching directory suggestions");
    return NextResponse.json({ players: [], alliances: [], error: "Search failed" }, { status: 500 });
  }
});

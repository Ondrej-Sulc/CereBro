import { NextRequest, NextResponse } from "next/server";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { calculateRosterRecommendations } from "@/lib/roster-recommendation-service";
import { ChampionClass } from "@prisma/client";
import { ProfileRosterEntry } from "@/app/profile/roster/types";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

export const GET = withRouteContext(async (req: NextRequest) => {
  const currentUser = await getUserPlayerWithAlliance();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetPlayerId = searchParams.get("playerId") || currentUser.id;

  // Security check: if viewing someone else, must be in same alliance or be bot admin
  if (targetPlayerId !== currentUser.id && !currentUser.isBotAdmin) {
    const targetPlayer = await prisma.player.findUnique({
      where: { id: targetPlayerId },
      select: { allianceId: true }
    });

    if (!targetPlayer || targetPlayer.allianceId !== currentUser.allianceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Parse filters and options
  const targetRank = parseInt(searchParams.get("targetRank") || "0");
  const sigBudget = parseInt(searchParams.get("sigBudget") || "0");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "5", 10) || 5, 1), 100);

  const validClasses = Object.values(ChampionClass);
  const rankClassFilterRaw = searchParams.get("rankClassFilter") ? searchParams.get("rankClassFilter")!.split(',') : [];
  const sigClassFilterRaw = searchParams.get("sigClassFilter") ? searchParams.get("sigClassFilter")!.split(',') : [];

  const rankClassFilter = rankClassFilterRaw.filter((c): c is ChampionClass => validClasses.includes(c as ChampionClass));
  const sigClassFilter = sigClassFilterRaw.filter((c): c is ChampionClass => validClasses.includes(c as ChampionClass));
  const rankSagaFilter = searchParams.get("rankSagaFilter") === 'true';
  const sigSagaFilter = searchParams.get("sigSagaFilter") === 'true';
  const sigAwakenedOnly = searchParams.get("sigAwakenedOnly") === 'true';

  // Fetch roster
  const roster = await prisma.roster.findMany({
    where: { playerId: targetPlayerId },
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
      }
    },
    orderBy: [{ stars: "desc" }, { rank: "desc" }],
  });

  // Determine default target rank if not set
  let effectiveTargetRank = targetRank;
  if (effectiveTargetRank === 0) {
    const highest7StarRank = roster.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
    effectiveTargetRank = highest7StarRank > 0 ? highest7StarRank : 3;
  }

  const result = await calculateRosterRecommendations(roster as unknown as ProfileRosterEntry[], {
    targetRank: effectiveTargetRank,
    sigBudget,
    rankClassFilter,
    sigClassFilter,
    rankSagaFilter,
    sigSagaFilter,
    sigAwakenedOnly,
    limit
  });

  // If viewing someone else and not an officer/admin, strip sensitive insights
  const isOfficerOrAdmin = currentUser.isBotAdmin || (currentUser.isOfficer && currentUser.allianceId !== null);
  if (targetPlayerId !== currentUser.id && !isOfficerOrAdmin) {
    return NextResponse.json({
        top30Average: result.top30Average,
        prestigeMap: result.prestigeMap,
        recommendations: [],
        sigRecommendations: []
    });
  }

  return NextResponse.json(result);
});

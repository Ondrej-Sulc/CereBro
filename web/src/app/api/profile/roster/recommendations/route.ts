import { NextRequest, NextResponse } from "next/server";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { calculateRosterRecommendations } from "@/lib/roster-recommendation-service";
import { ChampionClass } from "@prisma/client";
import { ProfileRosterEntry } from "@/app/profile/roster/types";

export async function GET(req: NextRequest) {
  const player = await getUserPlayerWithAlliance();
  if (!player) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // Parse filters and options
  const targetRank = parseInt(searchParams.get("targetRank") || "0");
  const sigBudget = parseInt(searchParams.get("sigBudget") || "0");
  
  const validClasses = Object.values(ChampionClass);
  const rankClassFilterRaw = searchParams.get("rankClassFilter") ? searchParams.get("rankClassFilter")!.split(',') : [];
  const sigClassFilterRaw = searchParams.get("sigClassFilter") ? searchParams.get("sigClassFilter")!.split(',') : [];

  const rankClassFilter = rankClassFilterRaw.filter((c): c is ChampionClass => validClasses.includes(c as ChampionClass));
  const sigClassFilter = sigClassFilterRaw.filter((c): c is ChampionClass => validClasses.includes(c as ChampionClass));
  const rankSagaFilter = searchParams.get("rankSagaFilter") === 'true';
  const sigSagaFilter = searchParams.get("sigSagaFilter") === 'true';

  // Fetch roster
  const roster = await prisma.roster.findMany({
    where: { playerId: player.id },
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
      let maxRosterRank = 1;
      roster.forEach(r => {
          if (r.stars === 7 && r.rank > maxRosterRank) maxRosterRank = r.rank;
      });
      const highest7StarRank = roster.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
      effectiveTargetRank = highest7StarRank > 0 ? highest7StarRank : 3;
  }

  const result = await calculateRosterRecommendations(roster as unknown as ProfileRosterEntry[], {
      targetRank: effectiveTargetRank,
      sigBudget,
      rankClassFilter,
      sigClassFilter,
      rankSagaFilter,
      sigSagaFilter
  });

  return NextResponse.json(result);
}

import { redirect } from "next/navigation";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { RosterView } from "./roster-view";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";
import { ProfileRosterEntry } from "./types";
import { calculateRosterRecommendations } from "@/lib/roster-recommendation-service";
import logger from "@/lib/logger";

export const metadata: Metadata = {
  title: "My Roster | CereBro",
  description: "Manage and view your MCOC champion roster.",
};

export default async function RosterPage(props: {
  searchParams: Promise<{ targetRank?: string; sigBudget?: string; rankClassFilter?: string; sigClassFilter?: string; rankSagaFilter?: string; sigSagaFilter?: string }>;
}) {
  const searchParams = await props.searchParams;
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/discord-login?redirectTo=/profile/roster");
  }

  // Parallel fetch for data
  const [rosterEntries, allChampions, tags, abilityCategories, abilityLinks, immunityLinks] = await Promise.all([
      prisma.roster.findMany({
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
      }),
      getCachedChampions(),
      prisma.tag.findMany({ orderBy: { name: 'asc' } }),
      prisma.abilityCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.championAbilityLink.findMany({ where: { type: 'ABILITY' }, select: { abilityId: true }, distinct: ['abilityId'] }),
      prisma.championAbilityLink.findMany({ where: { type: 'IMMUNITY' }, select: { abilityId: true }, distinct: ['abilityId'] })
  ]);

  const abilities = await prisma.ability.findMany({ where: { id: { in: abilityLinks.map(l => l.abilityId) } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const immunities = await prisma.ability.findMany({ where: { id: { in: immunityLinks.map(l => l.abilityId) } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });

  // Parse initial filters for Client Component
  const validClasses = Object.values(ChampionClass);
  const rankClassFilterRaw = searchParams.rankClassFilter ? searchParams.rankClassFilter.split(',') : [];
  const sigClassFilterRaw = searchParams.sigClassFilter ? searchParams.sigClassFilter.split(',') : [];

  const rankClassFilter = rankClassFilterRaw.filter((c): c is ChampionClass => validClasses.includes(c as ChampionClass));
  const sigClassFilter = sigClassFilterRaw.filter((c): c is ChampionClass => validClasses.includes(c as ChampionClass));
  const rankSagaFilter = searchParams.rankSagaFilter === 'true';
  const sigSagaFilter = searchParams.sigSagaFilter === 'true';
  
  const targetRank = searchParams.targetRank ? parseInt(searchParams.targetRank) : 0; // 0 lets the client/api decide default
  const sigBudget = searchParams.sigBudget ? parseInt(searchParams.sigBudget) : 0;

  // Safely map and type-cast the roster entries to ensure JsonValue fields match our local interfaces
  const typedRosterEntries: ProfileRosterEntry[] = rosterEntries.map(entry => ({
    ...entry,
    champion: {
      ...entry.champion,
      images: entry.champion.images as unknown as ChampionImages,
      abilities: entry.champion.abilities.map(link => ({
        ...link,
        synergyChampions: link.synergyChampions.map(synergy => ({
          ...synergy,
          champion: {
            ...synergy.champion,
            images: synergy.champion.images as unknown as ChampionImages
          }
        }))
      }))
    }
  }));

  // Determine default target rank if not set
  let effectiveTargetRank = targetRank;
  if (effectiveTargetRank === 0) {
      const highest7StarRank = typedRosterEntries.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
      effectiveTargetRank = highest7StarRank > 0 ? highest7StarRank : 3;
  }

  const { prestigeMap, recommendations, sigRecommendations, top30Average } = await calculateRosterRecommendations(
    typedRosterEntries,
    {
      targetRank: effectiveTargetRank,
      sigBudget,
      rankClassFilter,
      sigClassFilter,
      rankSagaFilter,
      sigSagaFilter
    }
  );

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <RosterView 
        initialRoster={typedRosterEntries} 
        allChampions={allChampions}
        top30Average={top30Average || player.championPrestige || 0}
        prestigeMap={prestigeMap}
        recommendations={recommendations}
        sigRecommendations={sigRecommendations}
        simulationTargetRank={effectiveTargetRank}
        initialSigBudget={sigBudget}
        initialRankClassFilter={rankClassFilter}
        initialSigClassFilter={sigClassFilter}
        initialRankSagaFilter={rankSagaFilter}
        initialSigSagaFilter={sigSagaFilter}
        initialTags={tags}
        initialAbilityCategories={abilityCategories}
        initialAbilities={abilities}
        initialImmunities={immunities}
      />
    </div>
  );
}
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance, getUserProfiles } from "@/lib/auth-helpers";
import { RosterView } from "./roster-view";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ChampionImages } from "@/types/champion";
import { PrestigeInsightTab, ProfileRosterEntry } from "./types";
import { loadRosterPrestigeInsightSnapshot } from "@/lib/roster-recommendation-service";
import { normalizeGlobalPrestigeListOptions } from "@/lib/global-prestige-list";

export const metadata: Metadata = {
  title: "My Champions | CereBro",
  description: "Manage and view your MCOC champions.",
};

export default async function RosterPage(props: {
  searchParams: Promise<{
    targetRank?: string;
    sigBudget?: string;
    rankClassFilter?: string;
    sigClassFilter?: string;
    rankSagaFilter?: string;
    sigSagaFilter?: string;
    limit?: string;
    insights?: string;
    sigAwakenedOnly?: string;
    insightsTab?: string;
    globalRarity?: string;
    globalRank?: string;
    globalSig?: string;
    globalAscension?: string;
    globalClassFilter?: string;
    globalOwnership?: string;
    globalSaga?: string;
    globalSearch?: string;
    globalLimit?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const player = await getUserPlayerWithAlliance();
  const profiles = await getUserProfiles();

  if (!player) {
    redirect("/api/auth/discord-login?redirectTo=/profile/roster");
  }

  // ... (rest of data fetching logic remains same)
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
                    iconUrl: true,
                    gameGlossaryTermId: true,
                    description: true,
                    gameGlossaryTerm: { select: { raw: true } },
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

  const {
    options: insightOptions,
    insights: { prestigeMap, recommendations, sigRecommendations, potentialRecommendations, top30Average, top30Cutoff },
  } = await loadRosterPrestigeInsightSnapshot(typedRosterEntries, searchParams);
  const initialGlobalPrestigeOptions = normalizeGlobalPrestigeListOptions(searchParams, {
    targetRank: insightOptions.targetRank,
  });
  const showInsights = searchParams.insights === 'true';
  const initialInsightTab = normalizePrestigeInsightTab(searchParams.insightsTab);

  const reqHeaders = await headers();
  const host = reqHeaders.get("host") ?? "localhost:3000";
  const protocol = reqHeaders.get("x-forwarded-proto") ?? "http";
  const shareUrl = `${protocol}://${host}/player/${player.id}/roster`;

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <RosterView
        key={player.id}
        initialRoster={typedRosterEntries}
        allChampions={allChampions}
        player={player}
        profiles={profiles}
        shareUrl={shareUrl}
        top30Average={top30Average || player.championPrestige || 0}
        top30Cutoff={top30Cutoff}
        prestigeMap={prestigeMap}
        recommendations={recommendations}
        sigRecommendations={sigRecommendations}
        potentialRecommendations={potentialRecommendations}
        simulationTargetRank={insightOptions.targetRank}
        initialSigBudget={insightOptions.sigBudget}
        initialRankClassFilter={insightOptions.rankClassFilter}
        initialSigClassFilter={insightOptions.sigClassFilter}
        initialRankSagaFilter={insightOptions.rankSagaFilter}
        initialSigSagaFilter={insightOptions.sigSagaFilter}
        initialSigAwakenedOnly={insightOptions.sigAwakenedOnly ?? false}
        initialTags={tags}
        initialAbilityCategories={abilityCategories}
        initialAbilities={abilities}
        initialImmunities={immunities}
        initialLimit={insightOptions.limit ?? 5}
        initialShowInsights={showInsights}
        initialInsightTab={initialInsightTab}
        initialGlobalPrestigeOptions={initialGlobalPrestigeOptions}
      />
    </div>
  );
}

function normalizePrestigeInsightTab(value: string | undefined): PrestigeInsightTab {
  if (value === "rank" || value === "sig" || value === "global") return value;
  return "potential";
}

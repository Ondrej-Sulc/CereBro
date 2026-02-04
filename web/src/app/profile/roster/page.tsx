import { redirect } from "next/navigation";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { RosterView } from "./roster-view";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";
import { ProfileRosterEntry } from "./types";
import logger from "@/lib/logger";

export const metadata: Metadata = {
  title: "My Roster | CereBro",
  description: "Manage and view your MCOC champion roster.",
};

interface Recommendation {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    fromRank: number;
    toRank: number;
    prestigeGain: number;
    accountGain: number;
}

interface SigRecommendation {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    rank: number;
    fromSig: number;
    toSig: number;
    prestigeGain: number;
    accountGain: number;
    prestigePerSig: number;
}

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

  // Use stored prestige as initial value
  const top30Average = player.championPrestige || 0;
  
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

  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            My Roster
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your champions, update stats, and track your progress.
          </p>
        </div>
        <Link href="/profile/update">
          <Button className="bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-900/20 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Update Roster
          </Button>
        </Link>
      </div>

      <RosterView 
        initialRoster={rosterEntries as unknown as ProfileRosterEntry[]} 
        allChampions={allChampions}
        top30Average={top30Average}
        prestigeMap={{}} // Empty initially, fetched client-side
        recommendations={[]} // Empty initially
        sigRecommendations={[]} // Empty initially
        simulationTargetRank={targetRank}
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
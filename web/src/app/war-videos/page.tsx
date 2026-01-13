import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Play, Calendar, User, Shield, Swords, CircleDot, EyeOff, Filter, Skull } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { ChampionClass, WarFight, Champion, War, Player, WarNode, WarVideo, Alliance, Tag, WarTactic, WarMapType } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

import { SearchFilters } from "@/components/SearchFilters";
import { UploadFightButton } from "@/components/UploadFightButton";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface WarFightWithRelations extends WarFight {
  attacker: (Champion & { tags: Tag[] }) | null;
  defender: (Champion & { tags: Tag[] }) | null;
  node: WarNode;
  war: War & { alliance: Alliance };
  player: Player | null;
  prefightChampions: Pick<Champion, 'id' | 'name' | 'images' | 'class'>[];
  video: (WarVideo & { submittedBy: Player }) | null;
}

interface WarVideosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WarVideosPage({ searchParams }: WarVideosPageProps) {
  const awaitedSearchParams = await searchParams; // Await the promise
  const resolvedSearchParams = awaitedSearchParams;
  
  // Helper to safely get a single string value from searchParams
  const getSingleParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const query = getSingleParam("q") || "";
  const attacker = getSingleParam("attacker") || "";
  const defender = getSingleParam("defender") || "";
  const node = getSingleParam("node") ? parseInt(getSingleParam("node") as string) : undefined;
  const warNumber = getSingleParam("war") ? parseInt(getSingleParam("war") as string) : undefined;
  const warTierFilter = getSingleParam("tier") ? parseInt(getSingleParam("tier") as string) : undefined;
  const mapTypeParam = getSingleParam("map");
  const mapType: WarMapType = mapTypeParam === "BIG_THING" ? "BIG_THING" : "STANDARD";
  
  const seasonParam = resolvedSearchParams.season;
  const selectedSeasons = (Array.isArray(seasonParam) ? seasonParam : [seasonParam])
    .filter((s): s is string => !!s)
    .map(s => parseInt(s));

  const tier = getSingleParam("tier") ? parseInt(getSingleParam("tier") as string) : undefined;
  const player = getSingleParam("player");
  const alliance = getSingleParam("alliance");
  const battlegroup = getSingleParam("battlegroup") ? parseInt(getSingleParam("battlegroup") as string) : undefined;
  const hasVideo = getSingleParam("hasVideo") === 'true';

  // Fetch champions for filters
  const champions = await getCachedChampions();
  
  // TODO: Fetch a Set of champion IDs that have associated WarFight records (as attacker or defender) to pass to SearchFilters as `activeChampionIds` for smarter filtering.
  
  // Fetch available seasons
  const rawSeasons = await prisma.war.findMany({
    distinct: ['season'],
    select: { season: true },
    orderBy: { season: 'desc' }
  });
  const availableSeasons = rawSeasons.map(s => s.season);

  // Fetch all tactics
  const allTactics = await prisma.warTactic.findMany({
    include: { attackTag: true, defenseTag: true }
  });

  // Authentication & Current User Check
  const currentUser = await getUserPlayerWithAlliance();

  if (currentUser) {
    logger.info({ userId: currentUser.id, allianceId: currentUser.allianceId }, "User accessing War Archive page");
  }

  const rawFights = await prisma.warFight.findMany({
    where: {
      AND: [
        { war: { status: 'FINISHED' } },
        { war: { mapType: mapType } },
        { attacker: { isNot: null } },
        { defender: { isNot: null } },
        { player: { isNot: null } },
        {
            OR: [
                {
                    video: {
                        status: "PUBLISHED",
                        visibility: "public"
                    }
                },
                ...(currentUser?.allianceId ? [{
                    war: { allianceId: currentUser.allianceId }
                }] : [])
            ]
        },
        query ? {
          OR: [
            { video: { description: { contains: query, mode: "insensitive" } } },
            { player: { ingameName: { contains: query, mode: "insensitive" } } },
            { attacker: { name: { contains: query, mode: "insensitive" } } },
            { defender: { name: { contains: query, mode: "insensitive" } } },
          ]
        } : {},
        attacker ? { attacker: { name: { contains: attacker, mode: "insensitive" } } } : {},
        defender ? { defender: { name: { contains: defender, mode: "insensitive" } } } : {},
        node ? { node: { nodeNumber: node } } : {},
        warNumber !== undefined ? { war: { warNumber: warNumber === 0 ? null : warNumber } } : {},
        warTierFilter ? { war: { warTier: warTierFilter } } : {},
        selectedSeasons.length > 0 ? { war: { season: { in: selectedSeasons } } } : {},
        tier ? { war: { warTier: tier } } : {},
        player ? { player: { ingameName: { contains: player, mode: "insensitive" } } } : {},
        alliance ? { war: { alliance: { name: { contains: alliance, mode: "insensitive" } } } } : {},
        battlegroup !== undefined ? { battlegroup: battlegroup } : {},
        hasVideo ? { videoId: { not: null } } : {},
      ]
    },
    include: {
      attacker: { include: { tags: true } },
      defender: { include: { tags: true } },
      node: true,
      war: { include: { alliance: true } },
      player: true,
      prefightChampions: { 
        select: { 
            champion: { select: { id: true, name: true, images: true, class: true } }
        } 
      },
      video: {
        include: { submittedBy: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Map fights to flatten prefightChampions
  const fights: WarFightWithRelations[] = rawFights.map(f => ({
      ...f,
      prefightChampions: f.prefightChampions.map(p => p.champion)
  }));

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">War Archive</h1>
              <p className="text-slate-400">Browse and search community uploaded war videos and fight logs.</p>
            </div>
          </div>
        </div>

        <SearchFilters champions={champions as unknown as (Champion & { group?: string })[]} availableSeasons={availableSeasons} currentUser={currentUser} />
      </div>

      {/* Fights Content */}
      <div className="space-y-6">
        {/* Mobile View (Cards) - Hidden on md+ */}
        <div className="grid grid-cols-1 gap-2 md:hidden">
            {fights.map((fight) => {
                const activeTactic = allTactics.find(t => 
                    t.season === fight.war.season && 
                    (!t.minTier || t.minTier <= fight.war.warTier) && 
                    (!t.maxTier || t.maxTier >= fight.war.warTier)
                );
                const isAttackerTactic = activeTactic?.attackTag && fight.attacker?.tags?.some(t => t.name === activeTactic.attackTag!.name);
                const isDefenderTactic = activeTactic?.defenseTag && fight.defender?.tags?.some(t => t.name === activeTactic.defenseTag!.name);
                
                return (
            <div 
                key={fight.id} 
                className={cn(
                    "group relative flex flex-col rounded-lg overflow-hidden transition-all duration-300",
                    fight.death > 0 ? "bg-red-950/20 border border-red-900/30" : "bg-slate-900/40 border border-slate-800/60",
                    fight.video ? "hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10" : "opacity-90"
                )}
            >
                <Link 
                    href={fight.video ? `/war-videos/${fight.video.id}` : '#'}
                    className={cn("flex-1 flex flex-col", !fight.video && "pointer-events-none")}
                >
                    {/* Header / Meta */}
                    <div className={cn("px-3 py-2 border-b flex justify-between items-center", fight.death > 0 ? "border-red-900/30 bg-red-950/30" : "border-slate-800/60 bg-slate-950/30")}>
                        <div className="flex gap-1.5 items-center">
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[9px] h-4.5 px-1.5">
                                S{fight.war.season}
                            </Badge>
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[9px] h-4.5 px-1.5">
                                W{fight.war.warNumber || '-'}
                            </Badge>
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[9px] h-4.5 px-1.5">
                                T{fight.war.warTier}
                            </Badge>
                            <span className="text-[9px] text-slate-400 font-mono truncate max-w-[100px]" title={fight.war.alliance.name}>
                                {fight.war.alliance.name}
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(fight.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                        </span>
                    </div>

                    {/* Matchup Content */}
                    <div className="p-2.5 flex-1 flex flex-col gap-2 items-center justify-center relative">
                    {/* Video Indicator Background */}
                    {fight.video && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-950/60 z-10">
                            <Play className="h-10 w-10 text-sky-400" fill="currentColor" />
                        </div>
                    )}

                    <div className="flex items-center justify-between w-full gap-3">
                            {/* Attacker */}
                            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                {fight.attacker ? (
                                <div className="relative">
                                    <div className={cn("absolute inset-0 rounded-full blur-md opacity-40", getChampionClassColors(fight.attacker.class as ChampionClass).bg)} />
                                    <Image 
                                        src={getChampionImageUrl(fight.attacker.images as unknown as ChampionImages, '128', 'primary')} 
                                        alt={fight.attacker.name}
                                        width={44} height={44}
                                        sizes="48px"
                                        className={cn("relative rounded-full ring-1.5", getChampionClassColors(fight.attacker.class as ChampionClass).border)}
                                    />
                                    {isAttackerTactic && (
                                        <div className="absolute -top-1 -left-1 bg-emerald-950/90 rounded-full border border-emerald-500 flex items-center justify-center w-4 h-4 shadow-md shadow-black z-10">
                                            <Swords className="w-2.5 h-2.5 text-emerald-400" />
                                        </div>
                                    )}
                                </div>
                                ) : <div className="w-11 h-11 bg-slate-800 rounded-full" />}
                                <div className="flex items-center gap-1 justify-center w-full">
                                    <span className={cn("text-xs font-bold text-center leading-tight truncate px-1 max-w-[85%]", fight.attacker ? getChampionClassColors(fight.attacker.class as ChampionClass).text : "")}>{fight.attacker?.name || '?'}</span>
                                    {fight.death > 0 && (
                                        <Skull className="w-3 h-3 text-red-500 shrink-0" />
                                    )}
                                </div>
                            </div>

                            {/* VS / Node */}
                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                <div className="h-5 w-px bg-slate-700/30" />
                                <Badge variant="secondary" className="bg-amber-900/10 text-amber-500 border-amber-500/20 font-mono text-sm px-1.5 h-5 whitespace-nowrap">
                                    {fight.node.nodeNumber}
                                </Badge>
                                <div className="h-5 w-px bg-slate-700/30" />
                            </div>

                            {/* Defender */}
                            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                                {fight.defender ? (
                                <div className="relative">
                                    <div className={cn("absolute inset-0 rounded-full blur-md opacity-40", getChampionClassColors(fight.defender.class as ChampionClass).bg)} />
                                    <Image 
                                        src={getChampionImageUrl(fight.defender.images as unknown as ChampionImages, '128', 'primary')} 
                                        alt={fight.defender.name}
                                        width={44} height={44}
                                        sizes="48px"
                                        className={cn("relative rounded-full ring-1.5", getChampionClassColors(fight.defender.class as ChampionClass).border)}
                                    />
                                    {isDefenderTactic && (
                                        <div className="absolute -top-1 -left-1 bg-red-950/90 rounded-full border border-red-500 flex items-center justify-center w-4 h-4 shadow-md shadow-black z-10">
                                            <Shield className="w-2.5 h-2.5 text-red-400" />
                                        </div>
                                    )}
                                </div>
                                ) : <div className="w-11 h-11 bg-slate-800 rounded-full" />}
                                <span className={cn("text-xs font-bold text-center leading-tight truncate w-full px-1", fight.defender ? getChampionClassColors(fight.defender.class as ChampionClass).text : "")}>{fight.defender?.name || '?'}</span>
                            </div>
                    </div>
                    {fight.prefightChampions.length > 0 && (
                        <div className="flex items-center justify-center gap-1.5 mt-1.5 px-2 py-0.5 bg-slate-950/40 rounded-full border border-purple-500/30">
                            <span className="text-[10px] text-purple-300 font-medium">Prefights:</span>
                            <div className="flex -space-x-1 overflow-hidden">
                                                                        {fight.prefightChampions.map((champ) => (
                                                                            <Image
                                                                                key={champ.id}
                                                                                src={getChampionImageUrl(champ.images as unknown as ChampionImages, '64', 'primary')}
                                                                                alt={champ.name}                                        width={16}
                                        height={16}
                                        unoptimized
                                        className="relative inline-block h-4 w-4 rounded-full ring-1 ring-purple-400/50"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    </div>
                </Link>

                {/* Footer */}
                <div className="px-3 py-2 bg-slate-950/30 border-t border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="text-[11px] font-medium truncate">{fight.player?.ingameName || 'Unknown'}</span>
                    </div>
                    <div className="shrink-0 ml-2">
                        {fight.video ? (
                            <div className="inline-flex items-center justify-center rounded-md h-6 px-2.5 text-[10px] bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-600 transition-all duration-200">
                                <Play className="h-2.5 w-2.5 mr-1" /> Video
                            </div>
                        ) : (
                            (currentUser && (
                                fight.playerId === currentUser.id ||
                                (currentUser.isOfficer && currentUser.allianceId === fight.war.allianceId) ||
                                currentUser.isBotAdmin
                            )) ? (
                                <UploadFightButton fightId={fight.id} />
                            ) : (
                                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <EyeOff className="h-3 w-3" /> Log Only
                                </span>
                            )
                        )}
                    </div>
                </div>
            </div>
            ); })}
        </div>

        {/* Desktop View (Table) - Hidden on sm/mobile */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/20">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-800/60">
                    <tr><th className="px-4 py-3 w-[160px]">War Info</th><th className="px-4 py-3">Alliance</th><th className="px-4 py-3 w-[100px]">Node</th><th className="px-4 py-3">Attacker</th><th className="px-4 py-3">Defender</th><th className="px-4 py-3 w-[120px]">Prefights</th><th className="px-4 py-3">Player</th><th className="px-4 py-3 text-right">View</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                    {fights.map((fight) => {
                        const activeTactic = allTactics.find(t => 
                            t.season === fight.war.season && 
                            (!t.minTier || t.minTier <= fight.war.warTier) && 
                            (!t.maxTier || t.maxTier >= fight.war.warTier)
                        );
                        const isAttackerTactic = activeTactic?.attackTag && fight.attacker?.tags?.some(t => t.name === activeTactic.attackTag!.name);
                        const isDefenderTactic = activeTactic?.defenseTag && fight.defender?.tags?.some(t => t.name === activeTactic.defenseTag!.name);

                        return (
                        <tr 
                            key={fight.id} 
                            className={cn(
                                "group transition-colors",
                                fight.death > 0 ? "bg-red-950/10 hover:bg-red-900/20" : "hover:bg-slate-800/30",
                                fight.video ? "cursor-pointer" : "cursor-default"
                            )}
                        >
                            <td className="px-4 py-3 align-middle">
                                <Link 
                                    href={fight.video ? `/war-videos/${fight.video.id}` : '#'} 
                                    className={cn("block", !fight.video && "pointer-events-none")}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            <Badge variant="outline" className="border-slate-700 text-slate-300 text-[11px] h-5 px-2 py-0.5">
                                                S{fight.war.season}
                                            </Badge>
                                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[11px] h-5 px-2 py-0.5">
                                                W{fight.war.warNumber || '-'}
                                            </Badge>
                                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[11px] h-5 px-2 py-0.5">
                                                T{fight.war.warTier}
                                            </Badge>
                                        </div>
                                    </div>
                                </Link>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-slate-300 font-medium text-xs truncate max-w-[120px]" title={fight.war.alliance.name}>
                                        {fight.war.alliance.name}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <Link 
                                    href={fight.video ? `/war-videos/${fight.video.id}` : '#'} 
                                    className={cn("block", !fight.video && "pointer-events-none")}
                                >
                                    <Badge variant="secondary" className="bg-amber-900/20 text-amber-500 border-amber-500/20 font-mono text-sm whitespace-nowrap">
                                        {fight.node.nodeNumber}
                                    </Badge>
                                </Link>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <Link 
                                    href={fight.video ? `/war-videos/${fight.video.id}` : '#'} 
                                    className={cn("block", !fight.video && "pointer-events-none")}
                                >
                                    <div className="flex items-center gap-3">
                                        {fight.attacker ? (
                                        <>
                                            <div className="relative flex-shrink-0">
                                                <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", getChampionClassColors(fight.attacker.class as ChampionClass).bg)} />
                                                <Image 
                                                    src={getChampionImageUrl(fight.attacker.images as unknown as ChampionImages, '128', 'primary')} 
                                                    alt={fight.attacker.name}
                                                    width={36} height={36}
                                                    sizes="48px"
                                                    className={cn("relative rounded-full ring-1", getChampionClassColors(fight.attacker.class as ChampionClass).border)}
                                                />
                                                {isAttackerTactic && (
                                                    <div className="absolute -top-1 -left-1 bg-emerald-950/90 rounded-full border border-emerald-500 flex items-center justify-center w-4 h-4 shadow-lg shadow-black z-10">
                                                        <Swords className="w-2 h-2 text-emerald-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn("font-bold truncate", getChampionClassColors(fight.attacker.class as ChampionClass).text)}>
                                                    {fight.attacker.name}
                                                </span>
                                                {fight.death > 0 && (
                                                    <span className="text-[10px] text-red-400 flex items-center gap-1 font-medium">
                                                        <Skull className="w-3 h-3" /> 
                                                        Death {fight.death > 1 ? `(${fight.death})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                        ) : <span className="text-slate-500">?</span>}
                                    </div>
                                </Link>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <Link 
                                    href={fight.video ? `/war-videos/${fight.video.id}` : '#'} 
                                    className={cn("block", !fight.video && "pointer-events-none")}
                                >
                                    <div className="flex items-center gap-3">
                                        {fight.defender ? (
                                        <>
                                            <div className="relative flex-shrink-0">
                                                <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", getChampionClassColors(fight.defender.class as ChampionClass).bg)} />
                                                <Image 
                                                    src={getChampionImageUrl(fight.defender.images as unknown as ChampionImages, '128', 'primary')} 
                                                    alt={fight.defender.name}
                                                    width={36} height={36}
                                                    sizes="48px"
                                                    className={cn("relative rounded-full ring-1", getChampionClassColors(fight.defender.class as ChampionClass).border)}
                                                />
                                                {isDefenderTactic && (
                                                    <div className="absolute -top-1 -left-1 bg-red-950/90 rounded-full border border-red-500 flex items-center justify-center w-4 h-4 shadow-lg shadow-black z-10">
                                                        <Shield className="w-2 h-2 text-red-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className={cn("font-bold truncate", getChampionClassColors(fight.defender.class as ChampionClass).text)}>
                                                {fight.defender.name}
                                            </span>
                                        </>
                                        ) : <span className="text-slate-500">?</span>}
                                    </div>
                                </Link>
                            </td>
                            <td className="px-4 py-3 align-middle">
                                {fight.prefightChampions.length > 0 ? (
                                    <div className="flex -space-x-1 overflow-hidden">
                                        {fight.prefightChampions.map((champ) => (
                                            <Image
                                                key={champ.id}
                                                src={getChampionImageUrl(champ.images as unknown as ChampionImages, '64', 'primary')}
                                                alt={champ.name}
                                                width={28}
                                                height={28}
                                                unoptimized
                                                className="relative inline-block h-7 w-7 rounded-full ring-1 ring-purple-400/50"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-600">-</span>
                                )}
                            </td>
                            <td className="px-4 py-3 align-middle">
                                <Link 
                                    href={fight.video ? `/war-videos/${fight.video.id}` : '#'} 
                                    className={cn("block", !fight.video && "pointer-events-none")}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-300">{fight.player?.ingameName || 'Unknown'}</span>
                                        {(fight.battlegroup ?? 0) > 0 && (
                                            <span className="text-[10px] text-slate-500">BG {fight.battlegroup}</span>
                                        )}
                                    </div>
                                </Link>
                            </td>
                            <td className="px-4 py-3 align-middle text-right">
                                {fight.video ? (
                                    <Link href={`/war-videos/${fight.video.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-600 transition-all duration-200 shadow-md shadow-sky-500/10 hover:shadow-sky-500/30">
                                            <Play className="h-3 w-3 mr-1.5" /> Watch Video
                                        </Button>
                                    </Link>
                                ) : (
                                    (currentUser && (
                                        fight.playerId === currentUser.id ||
                                        (currentUser.isOfficer && currentUser.allianceId === fight.war.allianceId) ||
                                        currentUser.isBotAdmin
                                    )) ? (
                                        <UploadFightButton fightId={fight.id} />
                                    ) : (
                                        <div className="flex justify-end">
                                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-800/50 text-slate-600">
                                                <EyeOff className="h-4 w-4" />
                                            </span>
                                        </div>
                                    )
                                )}
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
            
            {fights.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                    <p>No fights found matching your search.</p>
                </div>
            )}
            {fights.length >= 50 && (
                <div className="py-4 text-center text-slate-500 text-sm italic">
                    <p>Showing the first {fights.length} fights. Please refine your search for more results.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

function getYouTubeID(url: string | null) {
   if (!url) return null;
   const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
   const match = url.match(regExp);
   return (match&&match[7].length==11)? match[7] : null;
}
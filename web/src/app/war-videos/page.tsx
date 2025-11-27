import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Play, Calendar, User, Shield, Swords, CircleDot, EyeOff, Filter } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionClass, WarFight, Champion, War, Player, WarNode, WarVideo } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

import { SearchFilters } from "@/components/SearchFilters";

export const dynamic = 'force-dynamic';

interface WarFightWithRelations extends WarFight {
  attacker: Champion | null;
  defender: Champion | null;
  node: WarNode;
  war: War;
  player: Player | null;
  prefightChampions: Pick<Champion, 'id' | 'name' | 'images' | 'class'>[];
  video: (WarVideo & { submittedBy: Player }) | null;
}

interface WarVideosPageProps {
  searchParams: Record<string, string | string[] | undefined>;
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
  const warNumber = getSingleParam("war") ? parseInt(getSingleParam("war") as string) : undefined; // Added this line
  const warTierFilter = getSingleParam("tier") ? parseInt(getSingleParam("tier") as string) : undefined; // Renamed to avoid conflict
  
  const seasonParam = resolvedSearchParams.season;
  const selectedSeasons = (Array.isArray(seasonParam) ? seasonParam : [seasonParam])
    .filter((s): s is string => !!s)
    .map(s => parseInt(s));

  const tier = getSingleParam("tier") ? parseInt(getSingleParam("tier") as string) : undefined;
  const player = getSingleParam("player");
  const hasVideo = getSingleParam("hasVideo") === 'true';

  // Fetch champions for filters
  const champions = await prisma.champion.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, images: true }
  });
  
  // Fetch available seasons
  const rawSeasons = await prisma.war.findMany({
    distinct: ['season'],
    select: { season: true },
    orderBy: { season: 'desc' }
  });
  const availableSeasons = rawSeasons.map(s => s.season);

  // Authentication & Alliance Check
  const session = await auth();
  let userAllianceId: string | null = null;

  if (session?.user?.id) {
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'discord' }
    });
    if (account?.providerAccountId) {
      const dbPlayer = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId }
      });
      userAllianceId = dbPlayer?.allianceId || null;
    }
  }

  const fights: WarFightWithRelations[] = await prisma.warFight.findMany({
    where: {
      AND: [
        {
            OR: [
                {
                    video: {
                        status: "PUBLISHED",
                        visibility: "public"
                    }
                },
                ...(userAllianceId ? [{
                    war: { allianceId: userAllianceId }
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
        warNumber ? { war: { warNumber: warNumber } } : {}, // Added this line
        warTierFilter ? { war: { warTier: warTierFilter } } : {}, // Added this line
        selectedSeasons.length > 0 ? { war: { season: { in: selectedSeasons } } } : {},
        tier ? { war: { warTier: tier } } : {},
        player ? { player: { ingameName: { contains: player, mode: "insensitive" } } } : {},
        hasVideo ? { videoId: { not: null } } : {},
      ]
    },
    include: {
      attacker: true,
      defender: true,
      node: true,
      war: true,
      player: true,
      prefightChampions: { // Added this line
        select: { id: true, name: true, images: true, class: true } // Select necessary fields
      },
      video: {
        include: { submittedBy: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

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
            {session?.user && (
              <Link href="/war-videos/upload/init">
                <Button className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
                  <Play className="h-4 w-4" /> Upload Video
                </Button>
              </Link>
            )}
          </div>
        </div>

        <SearchFilters champions={champions as any} availableSeasons={availableSeasons} />
      </div>

      {/* Fights Content */}
      <div className="space-y-6">
        {/* Mobile View (Cards) - Hidden on md+ */}
        <div className="grid grid-cols-1 gap-6 md:hidden">
            {fights.map((fight) => (
            <Link 
                href={fight.video ? `/war-videos/${fight.video.id}` : '#'} 
                key={fight.id} 
                className={cn(
                    "group relative flex flex-col bg-slate-900/40 border border-slate-800/60 rounded-xl overflow-hidden transition-all duration-300",
                    fight.video ? "hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 cursor-pointer" : "cursor-default opacity-80"
                )}
            >
                {/* Header / Meta */}
                <div className="px-4 py-3 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/30">
                    <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] h-5">
                            S{fight.war.season}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] h-5">
                            W{fight.war.warNumber || '-'}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] h-5">
                            T{fight.war.warTier}
                        </Badge>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                        {new Date(fight.createdAt).toLocaleDateString()}
                    </span>
                </div>

                {/* Matchup Content */}
                <div className="p-4 flex-1 flex flex-col gap-4 items-center justify-center relative">
                {/* Video Indicator Background */}
                {fight.video && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-950/60 z-10">
                        <Play className="h-12 w-12 text-sky-400" fill="currentColor" />
                    </div>
                )}

                <div className="flex items-center justify-between w-full gap-4">
                        {/* Attacker */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                            {fight.attacker ? (
                            <div className="relative">
                                <div className={cn("absolute inset-0 rounded-full blur-md opacity-40", getChampionClassColors(fight.attacker.class as ChampionClass).bg)} />
                                <Image 
                                    src={getChampionImageUrl(fight.attacker.images as any, '128', 'primary')} 
                                    alt={fight.attacker.name}
                                    width={56} height={56}
                                    className={cn("relative rounded-full ring-2", getChampionClassColors(fight.attacker.class as ChampionClass).border)}
                                />
                            </div>
                            ) : <div className="w-14 h-14 bg-slate-800 rounded-full" />}
                            <span className="text-sm font-bold text-center leading-tight truncate w-full">{fight.attacker?.name || '?'}</span>
                        </div>

                        {/* VS / Node */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="h-8 w-px bg-slate-700/50" />
                            <Badge variant="secondary" className="bg-amber-900/20 text-amber-500 border-amber-500/20 font-mono text-xs whitespace-nowrap">
                                Node {fight.node.nodeNumber}
                            </Badge>
                            <div className="h-8 w-px bg-slate-700/50" />
                        </div>

                        {/* Defender */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                            {fight.defender ? (
                            <div className="relative">
                                <div className={cn("absolute inset-0 rounded-full blur-md opacity-40", getChampionClassColors(fight.defender.class as ChampionClass).bg)} />
                                <Image 
                                    src={getChampionImageUrl(fight.defender.images as any, '128', 'primary')} 
                                    alt={fight.defender.name}
                                    width={56} height={56}
                                    className={cn("relative rounded-full ring-2", getChampionClassColors(fight.defender.class as ChampionClass).border)}
                                />
                            </div>
                            ) : <div className="w-14 h-14 bg-slate-800 rounded-full" />}
                            <span className="text-sm font-bold text-center leading-tight truncate w-full">{fight.defender?.name || '?'}</span>
                        </div>
                </div>
                {fight.prefightChampions.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-2 px-2 py-1 bg-slate-950/40 rounded-full border border-purple-500/30 shadow-inner shadow-purple-900/20">
                        <span className="text-xs text-purple-300 font-medium">Prefights:</span>
                        <div className="flex -space-x-1 overflow-hidden">
                            {fight.prefightChampions.map((champ) => (
                                <Image
                                    key={champ.id}
                                    src={getChampionImageUrl(champ.images as any, '64', 'primary')}
                                    alt={champ.name}
                                    width={20}
                                    height={20}
                                    className="relative inline-block h-5 w-5 rounded-full ring-1 ring-purple-400/50"
                                />
                            ))}
                        </div>
                    </div>
                )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-950/30 border-t border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <User className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium truncate max-w-[120px]">{fight.player?.ingameName || 'Unknown'}</span>
                    </div>
                    {fight.video ? (
                        <Link href={`/war-videos/${fight.video.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-3 text-xs bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-600 transition-all duration-200 shadow-md shadow-sky-500/10 hover:shadow-sky-500/30">
                                <Play className="h-3 w-3 mr-1.5" /> Video
                            </Button>
                        </Link>
                    ) : (
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                            <EyeOff className="h-3 w-3" /> Log Only
                        </span>
                    )}
                </div>
            </Link>
            ))}
        </div>

        {/* Desktop View (Table) - Hidden on sm/mobile */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/20">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-800/60">
                    <tr>
                        <th className="px-4 py-3 w-[160px]">War Info</th>
                        <th className="px-4 py-3 w-[100px]">Node</th>
                        <th className="px-4 py-3">Attacker</th>
                        <th className="px-4 py-3">Defender</th>
                        <th className="px-4 py-3 w-[120px]">Prefights</th> {/* Added Prefights column header */}
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3 text-right">View</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                    {fights.map((fight) => (
                        <tr 
                            key={fight.id} 
                            className={cn(
                                "group transition-colors hover:bg-slate-800/30",
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
                                                    src={getChampionImageUrl(fight.attacker.images as any, '128', 'primary')} 
                                                    alt={fight.attacker.name}
                                                    width={36} height={36}
                                                    className={cn("relative rounded-full ring-1", getChampionClassColors(fight.attacker.class as ChampionClass).border)}
                                                />
                                            </div>
                                            <span className={cn("font-bold truncate", getChampionClassColors(fight.attacker.class as ChampionClass).text)}>
                                                {fight.attacker.name}
                                            </span>
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
                                                    src={getChampionImageUrl(fight.defender.images as any, '128', 'primary')} 
                                                    alt={fight.defender.name}
                                                    width={36} height={36}
                                                    className={cn("relative rounded-full ring-1", getChampionClassColors(fight.defender.class as ChampionClass).border)}
                                                />
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
                                                src={getChampionImageUrl(champ.images as any, '64', 'primary')}
                                                alt={champ.name}
                                                width={28}
                                                height={28}
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
                                        {fight.battlegroup && (
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
                                    <div className="flex justify-end">
                                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-800/50 text-slate-600">
                                            <EyeOff className="h-4 w-4" />
                                        </span>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
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

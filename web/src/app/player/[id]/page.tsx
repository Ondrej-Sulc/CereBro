import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlansForProfile } from "@/app/actions/quests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ScrollText, Play, Skull, Trophy, Video, Swords, Shield, TrendingUp, Layers, Clock, ChevronRight, CheckCircle2, Users, Repeat2, Map as MapIcon, ArrowRight, Image as ImageIcon, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ChampionAvatar } from "@/components/champion-avatar";
import { ChampionImages } from "@/types/champion";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { ChampionClass } from "@prisma/client";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { cache } from "react";
import { getYoutubeVideoId } from "@/lib/youtube";
import { isPlayerSupporter } from "@/lib/support-status";

interface PlayerProfilePageProps {
    params: Promise<{ id: string }>;
}

const getPlayerProfile = cache(async (id: string) => {
    return prisma.player.findUnique({
        where: { id },
        include: {
            alliance: { select: { id: true, name: true } }
        }
    });
});

export async function generateMetadata({ params }: PlayerProfilePageProps): Promise<Metadata> {
    const { id } = await params;
    const player = await getPlayerProfile(id);

    if (!player) {
        return {
            title: "Player Profile - CereBro",
            description:
                "View this player's top champions, quest plans, recent war videos, and recent fights.",
        };
    }

    return {
        title: `${player.ingameName} - Player Profile - CereBro`,
        description: player.alliance?.name
            ? `View ${player.ingameName}'s top champions, quest plans, recent war videos, and alliance activity for ${player.alliance.name}.`
            : `View ${player.ingameName}'s top champions, quest plans, recent war videos, and recent fights.`,
    };
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
    const { id } = await params;

    const player = await getPlayerProfile(id);

    if (!player) notFound();

    const currentUser = await getUserPlayerWithAlliance();

    const [questPlans, roster, recentVideos, recentFights, rosterTotal, rosterByStars, rosterAscendedCount, videoTotal, fightAggregate, uniqueWarIds, supporter] = await Promise.all([
        getPlayerQuestPlansForProfile(id),
        prisma.roster.findMany({
            where: { playerId: id },
            include: { champion: { include: { prestigeData: true } } },
            orderBy: [
                { stars: 'desc' },
                { rank: 'desc' },
                { sigLevel: 'desc' },
                { powerRating: 'desc' }
            ],
            take: 10
        }),
        prisma.warVideo.findMany({
            where: {
                submittedById: id,
                status: "PUBLISHED",
                OR: [
                    { visibility: "public" },
                    ...(currentUser?.allianceId ? [{
                        fights: { some: { war: { allianceId: currentUser.allianceId } } }
                    }] : [])
                ]
            },
            include: {
                fights: {
                    include: {
                        war: { include: { alliance: true } },
                        attacker: true,
                        defender: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 4
        }),
        prisma.warFight.findMany({
            where: {
                playerId: id,
                OR: [
                    { video: { status: "PUBLISHED", visibility: "public" } },
                    ...(currentUser?.allianceId ? [{
                        war: { allianceId: currentUser.allianceId }
                    }] : [])
                ]
            },
            include: {
                attacker: true,
                defender: true,
                war: { include: { alliance: true } },
                node: true,
                video: true
            },
            orderBy: { createdAt: 'desc' },
            take: 15
        }),
        prisma.roster.count({ where: { playerId: id } }),
        prisma.roster.groupBy({
            by: ['stars'],
            where: { playerId: id },
            _count: { id: true },
            orderBy: { stars: 'desc' }
        }),
        prisma.roster.count({ where: { playerId: id, isAscended: true } }),
        prisma.warVideo.count({ where: { submittedById: id, status: 'PUBLISHED' } }),
        prisma.warFight.aggregate({
            where: { playerId: id },
            _count: { id: true },
            _sum: { death: true }
        }),
        prisma.warFight.groupBy({ by: ['warId'], where: { playerId: id } }),
        isPlayerSupporter(player),
    ]);

    const totalFights = fightAggregate._count.id;
    const totalDeaths = fightAggregate._sum.death ?? 0;
    const totalWars = uniqueWarIds.length;
    const soloRate = totalFights > 0 ? Math.round(((totalFights - totalDeaths) / totalFights) * 100) : 0;
    const stars7Count = rosterByStars.find(g => g.stars === 7)?._count.id ?? 0;
    const stars6PlusCount = rosterByStars.filter(g => g.stars >= 6).reduce((s, g) => s + g._count.id, 0);

    const lastFightDate = recentFights[0]?.createdAt ?? null;
    const lastVideoDate = recentVideos[0]?.createdAt ?? null;
    const lastActiveDate = lastFightDate && lastVideoDate
        ? new Date(Math.max(lastFightDate.getTime(), lastVideoDate.getTime()))
        : lastFightDate ?? lastVideoDate;
    const currentTime = new Date().getTime();

    const formatRelativeDate = (date: Date): string => {
        const days = Math.floor((currentTime - date.getTime()) / 86_400_000);
        if (days === 0) return "Active today";
        if (days === 1) return "Active yesterday";
        if (days < 30) return `Active ${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `Active ${months}mo ago`;
        return `Active ${Math.floor(months / 12)}y ago`;
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8">
            {/* Profile Header */}
            <div className="relative bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500/40 via-purple-500/20 to-transparent" />
                <div className="relative p-5 md:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <Avatar className="h-20 w-20 md:h-24 md:w-24 border-2 border-slate-700 ring-4 ring-slate-900 shadow-2xl shrink-0">
                        <AvatarImage src={player.avatar || undefined} />
                        <AvatarFallback className="text-2xl bg-slate-800 font-black">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none">{player.ingameName}</h1>
                        <div className="flex flex-wrap items-center gap-2.5 mt-3">
                            {player.alliance && (
                                <Link href={`/alliance/${player.alliance.id}`} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-sky-400 transition-colors font-semibold">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {player.alliance.name}
                                </Link>
                            )}
                            {player.isOfficer && (
                                <Badge className="bg-amber-950/50 border border-amber-700/50 text-amber-400 text-[10px] font-black uppercase tracking-wide px-2">
                                    Officer
                                </Badge>
                            )}
                            {supporter && (
                                <Badge className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wide px-2">
                                    Supporter
                                </Badge>
                            )}
                            {player.battlegroup && (
                                <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] font-black uppercase">
                                    BG {player.battlegroup}
                                </Badge>
                            )}
                            {lastActiveDate && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    {formatRelativeDate(lastActiveDate)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {/* Prestige */}
                {player.championPrestige && (
                    <div className="col-span-2 sm:col-span-1 bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-amber-500/70">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Prestige</span>
                        </div>
                        <div className="text-3xl font-black font-mono text-amber-100 leading-none">{player.championPrestige.toLocaleString('en-US')}</div>
                        <div className="text-[10px] text-amber-700 font-semibold">Top 30 avg</div>
                    </div>
                )}

                {/* Roster */}
                <div className="bg-purple-950/20 border border-purple-900/30 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-purple-400/70">
                        <Layers className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Roster</span>
                    </div>
                    <div className="text-3xl font-black font-mono text-purple-100 leading-none">{rosterTotal.toLocaleString()}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-auto">
                        {stars7Count > 0 && (
                            <span className="text-[10px] font-bold text-purple-400">{stars7Count} × 7★</span>
                        )}
                        <span className="text-[10px] font-bold text-yellow-500/80">{stars6PlusCount} × 6★+</span>
                    </div>
                </div>

                {/* Wars */}
                {totalWars > 0 && (
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-amber-400/70">
                            <Shield className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Wars</span>
                        </div>
                        <div className="text-3xl font-black font-mono text-slate-200 leading-none">{totalWars}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{totalFights} total fights</div>
                    </div>
                )}

                {/* Solo Rate */}
                {totalFights > 0 && (
                    <div className={cn(
                        "border rounded-xl p-4 flex flex-col gap-2",
                        soloRate >= 80 ? "bg-emerald-950/20 border-emerald-900/30" :
                        soloRate >= 60 ? "bg-amber-950/20 border-amber-900/30" :
                                         "bg-red-950/20 border-red-900/30"
                    )}>
                        <div className={cn(
                            "flex items-center gap-1.5",
                            soloRate >= 80 ? "text-emerald-500/70" :
                            soloRate >= 60 ? "text-amber-500/70" : "text-red-500/70"
                        )}>
                            <Swords className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Solo Rate</span>
                        </div>
                        <div className={cn(
                            "text-3xl font-black font-mono leading-none",
                            soloRate >= 80 ? "text-emerald-400" :
                            soloRate >= 60 ? "text-amber-400" : "text-red-400"
                        )}>{soloRate}%</div>
                        {totalDeaths > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-red-400/80 font-semibold">
                                <Skull className="w-3 h-3" /> {totalDeaths} death{totalDeaths > 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                )}

                {/* Videos */}
                {videoTotal > 0 && (
                    <div className="bg-red-950/10 border border-red-900/20 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-red-400/70">
                            <Video className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Videos</span>
                        </div>
                        <div className="text-3xl font-black font-mono text-red-100 leading-none">{videoTotal}</div>
                        <div className="text-[10px] text-red-900/80 font-semibold">submitted</div>
                    </div>
                )}
            </div>

            {/* Top Roster Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 bg-purple-500 rounded-full" />
                    <h2 className="text-sm font-black text-purple-400 uppercase tracking-[0.2em]">Top Champions</h2>
                    {roster.length > 0 && (
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Top {roster.length}</span>
                    )}
                    <Link
                        href={`/player/${id}/roster`}
                        className="ml-auto flex items-center gap-1.5 text-xs bg-purple-950/40 border border-purple-800/40 hover:border-purple-600/60 hover:bg-purple-950/60 text-purple-300 hover:text-purple-200 px-3 py-1.5 rounded-lg transition-all font-black uppercase tracking-wide"
                    >
                        Full Roster
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
                {roster.length > 0 ? (
                    <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
                        {roster.map(r => {
                            const prestige = r.champion.prestigeData
                                .filter(p => p.rarity === r.stars && p.rank === r.rank && p.sig <= r.sigLevel)
                                .sort((a, b) => b.sig - a.sig)[0]?.prestige;
                            return (
                                <div key={r.id} className="flex flex-col items-center gap-1.5">
                                    <ChampionAvatar
                                        name={r.champion.name}
                                        images={r.champion.images as unknown as ChampionImages}
                                        championClass={r.champion.class}
                                        stars={r.stars}
                                        rank={r.rank}
                                        isAwakened={r.isAwakened}
                                        isAscended={r.isAscended}
                                        ascensionLevel={r.ascensionLevel || undefined}
                                        sigLevel={r.sigLevel}
                                        size="lg"
                                        className="w-full h-auto aspect-square"
                                    />
                                    <div className="text-center w-full px-0.5">
                                        <p className="text-[9px] text-slate-400 font-semibold truncate leading-tight">{r.champion.name}</p>
                                        {prestige && (
                                            <p className="text-[10px] font-black font-mono text-amber-400 leading-tight">{prestige.toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-purple-950/10 border border-purple-900/20 rounded-2xl">
                        <Layers className="w-8 h-8 text-purple-500/30 mb-2" />
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No Roster Available</p>
                    </div>
                )}
            </div>

            {/* Recent War Fights — most active content, shown first */}
            {recentFights.length > 0 && (() => {
                const warGroups: { war: typeof recentFights[0]['war']; fights: typeof recentFights }[] = [];
                const warIndexMap: Record<string, number> = {};
                for (const fight of recentFights) {
                    if (warIndexMap[fight.war.id] === undefined) {
                        warIndexMap[fight.war.id] = warGroups.length;
                        warGroups.push({ war: fight.war, fights: [] });
                    }
                    warGroups[warIndexMap[fight.war.id]].fights.push(fight);
                }
                return (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-amber-500 rounded-full" />
                            <h2 className="text-sm font-black text-amber-400 uppercase tracking-[0.2em]">Recent War Fights</h2>
                            <Link href={`/war-videos?player=${encodeURIComponent(player.ingameName)}`} className="text-xs text-slate-500 hover:text-sky-400 ml-auto transition-colors">View All in Archive</Link>
                        </div>
                        <div className="space-y-3">
                            {warGroups.map(({ war, fights: warFights }) => {
                                const warDeaths = warFights.reduce((s, f) => s + f.death, 0);
                                return (
                                    <Card key={war.id} className="bg-slate-950/40 border-slate-800/60 overflow-hidden">
                                        <div className="py-3 px-4 border-b border-slate-800/40 bg-slate-900/40 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-amber-500 shrink-0">
                                                    {war.warNumber || '-'}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">S{war.season} · T{war.warTier}</span>
                                                    <span className="text-sm font-black uppercase italic text-slate-200 tracking-tight truncate">{war.alliance.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase leading-none mb-0.5">Fights</span>
                                                    <span className="text-sm font-mono font-black text-slate-300">{warFights.length}</span>
                                                </div>
                                                {warDeaths > 0 ? (
                                                    <div className="flex items-center gap-1.5 text-red-400 text-xs font-black uppercase italic">
                                                        <Skull className="w-3.5 h-3.5" />
                                                        {warDeaths} Death{warDeaths > 1 ? 's' : ''}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase italic">
                                                        <Trophy className="w-3.5 h-3.5" />
                                                        Solo
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="divide-y divide-slate-800/30">
                                            {warFights.map(fight => {
                                                const isDeath = fight.death > 0;
                                                const attackerImages = fight.attacker?.images as unknown as ChampionImages | undefined;
                                                const defenderImages = fight.defender?.images as unknown as ChampionImages | undefined;
                                                const attackerColors = getChampionClassColors(fight.attacker?.class as ChampionClass);
                                                const defenderColors = getChampionClassColors(fight.defender?.class as ChampionClass);
                                                return (
                                                    <div key={fight.id} className="flex items-center justify-between gap-3 py-2.5 px-4 hover:bg-slate-800/20 transition-colors">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-slate-500 shrink-0">
                                                                {fight.node.nodeNumber}
                                                            </div>
                                                            <div className="flex items-center bg-slate-900/80 rounded-full pl-1.5 pr-4 py-1.5 border border-slate-800 shadow-inner min-w-0">
                                                                <div className="relative shrink-0">
                                                                    <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", attackerColors.bg)} />
                                                                    <Avatar className={cn("h-9 w-9 border-none bg-slate-950 shadow-md relative", attackerColors.border)}>
                                                                        {attackerImages && <AvatarImage src={getChampionImageUrlOrPlaceholder(attackerImages, "64")} />}
                                                                        <AvatarFallback className="text-xs font-black">{fight.attacker?.name.substring(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                                                                    </Avatar>
                                                                </div>
                                                                <span className="text-[9px] font-black text-slate-600 uppercase mx-3 shrink-0">VS</span>
                                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                                    <div className="relative shrink-0">
                                                                        <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", defenderColors.bg)} />
                                                                        <Avatar className={cn("h-9 w-9 border-none bg-slate-950 shadow-md relative", defenderColors.border)}>
                                                                            {defenderImages && <AvatarImage src={getChampionImageUrlOrPlaceholder(defenderImages, "64")} />}
                                                                            <AvatarFallback className="text-xs font-black">{fight.defender?.name.substring(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                                                                        </Avatar>
                                                                    </div>
                                                                    <span className={cn("text-sm font-black uppercase italic tracking-tighter whitespace-nowrap pr-2", defenderColors.text)}>
                                                                        {fight.defender?.name || '?'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 shrink-0">
                                                            {isDeath ? (
                                                                <div className="flex items-center gap-1 text-red-400 text-xs font-black uppercase italic">
                                                                    <Skull className="w-3 h-3" /> Death
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-emerald-400 text-xs font-black uppercase italic">
                                                                    <Trophy className="w-3 h-3" /> Solo
                                                                </div>
                                                            )}
                                                            {fight.video && (
                                                                <Link
                                                                    href={`/war-videos/${fight.video.id}`}
                                                                    className="p-1.5 bg-sky-600/20 border border-sky-600/50 rounded-full hover:bg-sky-600 text-sky-300 hover:text-white transition-all shadow-md"
                                                                    title="Watch Video"
                                                                >
                                                                    <Video className="w-3.5 h-3.5" />
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Videos + Quest Plans */}
            {(recentVideos.length > 0 || questPlans.length > 0) && (
            <div className={cn("grid grid-cols-1 gap-8", recentVideos.length > 0 && questPlans.length > 0 ? "lg:grid-cols-2" : "")}>
                {/* Recent War Videos */}
                {recentVideos.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-red-500 rounded-full" />
                            <h2 className="text-sm font-black text-red-400 uppercase tracking-[0.2em]">Recent Videos</h2>
                            <Link href={`/war-videos?player=${encodeURIComponent(player.ingameName)}`} className="text-xs text-slate-500 hover:text-sky-400 ml-auto transition-colors">View All</Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {recentVideos.map(video => {
                                const war = video.fights[0]?.war;
                                const fighters = video.fights.map(f => f.attacker).filter(Boolean);
                                const defenders = video.fights.map(f => f.defender).filter(Boolean);
                                
                                const uniqueFighters = Array.from(new Map(fighters.map(f => [f!.id, f])).values());
                                const uniqueDefenders = Array.from(new Map(defenders.map(f => [f!.id, f])).values());
                                
                                const maxVisible = 4;
                                const visibleFighters = uniqueFighters.slice(0, maxVisible);
                                const extraFighters = uniqueFighters.length - maxVisible;
                                
                                const visibleDefenders = uniqueDefenders.slice(0, maxVisible);
                                const extraDefenders = uniqueDefenders.length - maxVisible;

                                const youtubeId = getYoutubeVideoId(video.url);
                                return (
                                    <Link key={video.id} href={`/war-videos/${video.id}`} className="block h-full">
                                        <Card className="bg-gradient-to-b from-slate-900 to-[#05090f] transition-all cursor-pointer group overflow-hidden flex flex-col h-full relative before:absolute before:inset-0 before:bg-gradient-to-b before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity border-slate-800 hover:border-red-700/50 hover:shadow-[0_0_30px_rgba(220,38,38,0.1)] before:from-red-500/5">
                                            {/* Video Thumbnail Area */}
                                            <div className="relative h-32 w-full overflow-hidden bg-slate-950 border-b border-slate-800 shrink-0">
                                                {youtubeId ? (
                                                    <img 
                                                        src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                                                        alt="Thumbnail"
                                                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                        <Video className="w-16 h-16 text-red-500" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                                
                                                {/* Play Button Overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-12 h-12 rounded-full bg-red-600/80 backdrop-blur-sm border border-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)] group-hover:scale-110 transition-transform duration-300">
                                                        <Play className="w-5 h-5 text-white ml-1" fill="currentColor" />
                                                    </div>
                                                </div>

                                                {/* War Badge Top Left */}
                                                {war && (
                                                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-red-500/30 shadow-xl">
                                                        <Shield className="w-3 h-3 text-red-400" />
                                                        <span className="text-[9px] font-black text-red-100 uppercase tracking-widest">
                                                            S{war.season} • {war.warNumber ? `W${war.warNumber}` : 'O'} • T{war.warTier}
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                {/* Fights Badge Bottom Right */}
                                                <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-xl">
                                                    <Swords className="w-3 h-3 text-slate-300" />
                                                    <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight">{video.fights.length} {video.fights.length === 1 ? 'Fight' : 'Fights'}</span>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <CardContent className="p-4 flex flex-col flex-1 gap-3">
                                                {war && (
                                                    <h3 className="text-sm font-black group-hover:text-red-400 transition-colors line-clamp-1 uppercase tracking-tight leading-tight text-slate-200 mb-1">
                                                        {war.alliance.name}
                                                    </h3>
                                                )}

                                                {(uniqueFighters.length > 0 || uniqueDefenders.length > 0) && (
                                                    <div className="flex items-center justify-between gap-2 bg-slate-950/50 rounded-lg p-1.5 border border-slate-800/50 shadow-inner">
                                                        {uniqueFighters.length > 0 && (
                                                            <div className="flex gap-1.5 items-center flex-wrap">
                                                                {visibleFighters.map((fighter, i) => (
                                                                    <div key={`a-${i}`} className="relative shrink-0">
                                                                        <Avatar className="h-7 w-7 border border-slate-700 bg-slate-900 shadow-md hover:scale-110 transition-transform z-10 hover:z-20">
                                                                            {fighter!.images && <AvatarImage src={getChampionImageUrlOrPlaceholder(fighter!.images as unknown as ChampionImages, "64")} />}
                                                                            <AvatarFallback className="text-[9px] font-black">{fighter!.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                                        </Avatar>
                                                                    </div>
                                                                ))}
                                                                {extraFighters > 0 && (
                                                                    <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-md z-10 shrink-0">
                                                                        <span className="text-[9px] font-black text-slate-300">+{extraFighters}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {uniqueFighters.length > 0 && uniqueDefenders.length > 0 && (
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1 shrink-0">VS</span>
                                                        )}

                                                        {uniqueDefenders.length > 0 && (
                                                            <div className="flex gap-1.5 items-center flex-wrap justify-end">
                                                                {visibleDefenders.map((defender, i) => (
                                                                    <div key={`d-${i}`} className="relative shrink-0">
                                                                        <Avatar className="h-7 w-7 border border-slate-700 bg-slate-900 shadow-md hover:scale-110 transition-transform z-10 hover:z-20">
                                                                            {defender!.images && <AvatarImage src={getChampionImageUrlOrPlaceholder(defender!.images as unknown as ChampionImages, "64")} />}
                                                                            <AvatarFallback className="text-[9px] font-black">{defender!.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                                        </Avatar>
                                                                    </div>
                                                                ))}
                                                                {extraDefenders > 0 && (
                                                                    <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-md z-10 shrink-0">
                                                                        <span className="text-[9px] font-black text-slate-300">+{extraDefenders}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer */}
                                                <div className="mt-auto pt-3 border-t border-slate-900/50 flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-red-500 transition-colors">
                                                        <Clock className="w-3 h-3" />
                                                        <span className="text-[9px] font-bold uppercase tracking-wider">{new Date(video.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="h-7 w-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:bg-red-600 group-hover:border-red-500 group-hover:scale-110 transition-all shadow-inner group-hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                                        <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-white" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Quest Plans Section */}
                {questPlans.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-sky-500 rounded-full" />
                        <h2 className="text-sm font-black text-sky-400 uppercase tracking-[0.2em]">Quest Plans</h2>
                        <Badge variant="secondary" className="text-[10px] h-4 ml-1">{questPlans.length}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {questPlans.slice(0, 4).map(plan => {
                            const isCompleted = plan.encounters.length >= plan.questPlan.encounters.length && plan.questPlan.encounters.length > 0;
                            return (
                            <Link key={plan.id} href={`/player/${id}/quests/${plan.questPlan.id}`} className="block h-full">
                                <Card className={cn(
                                    "bg-gradient-to-b from-slate-900 to-[#05090f] transition-all cursor-pointer group overflow-hidden flex flex-col h-full relative before:absolute before:inset-0 before:bg-gradient-to-b before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
                                    isCompleted
                                        ? "border-emerald-800/50 hover:border-emerald-700/50 hover:shadow-[0_0_30px_rgba(52,211,153,0.08)] before:from-emerald-500/5"
                                        : "border-slate-800 hover:border-sky-700/50 hover:shadow-[0_0_30px_rgba(2,132,199,0.1)] before:from-sky-500/5"
                                )}>
                                    {/* Banner */}
                                    <div className="relative h-32 w-full overflow-hidden bg-slate-900 border-b border-slate-800 shrink-0">
                                        {plan.questPlan.bannerUrl ? (
                                            <Image
                                                src={plan.questPlan.bannerUrl.replace(/#/g, '%23')}
                                                alt={plan.questPlan.title}
                                                fill
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                                className={cn(
                                                    "transition-transform duration-700 group-hover:scale-105",
                                                    plan.questPlan.bannerFit === "contain" ? "object-contain" : "object-cover",
                                                    plan.questPlan.bannerPosition === "top" ? "object-top" : plan.questPlan.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                                )}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                                <ImageIcon className="w-12 h-12 text-slate-800 opacity-30" />
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-90" />

                                        {/* Completion badge */}
                                        {isCompleted && (
                                            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/60 shadow-xl">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tight">Completed</span>
                                            </div>
                                        )}

                                        <div className="absolute bottom-2.5 right-3 flex items-center gap-2 z-10">
                                            {plan.questPlan.teamLimit !== null ? (
                                                <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-xl">
                                                    <Users className="w-3 h-3 text-sky-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">Team of {plan.questPlan.teamLimit}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-xl">
                                                    <Repeat2 className="w-3 h-3 text-sky-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">Swap</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-xl">
                                                <Swords className="w-3 h-3 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                <span className="text-[10px] font-black uppercase tracking-tight">{plan.questPlan.encounters.length} Fights</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <CardContent className="p-4 flex flex-col flex-1 gap-3">
                                        <div className="space-y-1.5">
                                            {plan.questPlan.category && (
                                                <Badge variant="outline" className="text-[9px] uppercase font-bold border-slate-700 text-slate-400">
                                                    {plan.questPlan.category.name}
                                                </Badge>
                                            )}
                                            <h3 className="text-base font-black group-hover:text-sky-400 transition-colors line-clamp-2 uppercase tracking-tight leading-tight">
                                                {plan.questPlan.title}
                                            </h3>
                                        </div>

                                        {/* Restrictions */}
                                        {(plan.questPlan.minStarLevel || plan.questPlan.maxStarLevel || (plan.questPlan.requiredClasses && plan.questPlan.requiredClasses.length > 0)) && (
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {(plan.questPlan.minStarLevel || plan.questPlan.maxStarLevel) && (
                                                        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                                                            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                                            <span className="text-[9px] font-black text-amber-400 leading-none">
                                                                {plan.questPlan.minStarLevel && plan.questPlan.maxStarLevel ? `${plan.questPlan.minStarLevel}–${plan.questPlan.maxStarLevel}★` : plan.questPlan.minStarLevel ? `${plan.questPlan.minStarLevel}★+` : `Up to ${plan.questPlan.maxStarLevel}★`}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {plan.questPlan.requiredClasses && plan.questPlan.requiredClasses.length > 0 && (
                                                        <div className="flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 rounded-full px-2 py-0.5">
                                                            {plan.questPlan.requiredClasses.map(cls => (
                                                                <div key={cls} className="relative w-3 h-3 shrink-0">
                                                                    <Image
                                                                        src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`}
                                                                        alt={cls}
                                                                        fill
                                                                        className="object-contain"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="mt-auto pt-3 border-t border-slate-900/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-sky-500 group-hover:translate-x-1 transition-all">
                                                    <MapIcon className="w-3 h-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Open Plan</span>
                                                </div>
                                                {plan.encounters.length > 0 && (
                                                    isCompleted ? (
                                                        <Badge className="text-[9px] h-4 bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 font-black uppercase tracking-wider px-1.5">
                                                            ✓ Completed
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-[9px] h-4 bg-sky-950/30 border border-sky-900/50 text-sky-400 font-bold px-1.5">
                                                            {plan.encounters.length} / {plan.questPlan.encounters.length} picked
                                                        </Badge>
                                                    )
                                                )}
                                            </div>
                                            <div className="h-7 w-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:bg-sky-600 group-hover:border-sky-500 group-hover:scale-110 transition-all shadow-inner group-hover:shadow-[0_0_15px_rgba(2,132,199,0.5)]">
                                                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-white" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                            );
                        })}
                    </div>
                </div>
                )}
            </div>
            )}

        </div>
    );
}


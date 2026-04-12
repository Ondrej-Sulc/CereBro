import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlansForProfile } from "@/app/actions/quests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ScrollText, Play, Skull, Trophy, Video } from "lucide-react";
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

    const [questPlans, roster, recentVideos, recentFights, rosterTotal, rosterByStars, rosterAscendedCount, videoTotal, fightAggregate, uniqueWarIds] = await Promise.all([
        getPlayerQuestPlansForProfile(id),
        prisma.roster.findMany({
            where: { playerId: id },
            include: { champion: true },
            orderBy: [
                { stars: 'desc' },
                { rank: 'desc' },
                { sigLevel: 'desc' },
                { powerRating: 'desc' }
            ],
            take: 12
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
                    take: 3,
                    include: {
                        war: { include: { alliance: true } },
                        attacker: true,
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
        prisma.warFight.groupBy({ by: ['warId'], where: { playerId: id } })
    ]);

    const totalFights = fightAggregate._count.id;
    const totalDeaths = fightAggregate._sum.death ?? 0;
    const totalWars = uniqueWarIds.length;
    const soloRate = totalFights > 0 ? Math.round(((totalFights - totalDeaths) / totalFights) * 100) : 0;
    const stars7Count = rosterByStars.find(g => g.stars === 7)?._count.id ?? 0;
    const stars6PlusCount = rosterByStars.filter(g => g.stars >= 6).reduce((s, g) => s + g._count.id, 0);

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-12">
            {/* Profile Header */}
            <div>
                <div className="flex items-center gap-4 mb-2">
                    <Avatar className="h-16 w-16 md:h-20 md:w-20 border-2 border-slate-700 shadow-xl">
                        <AvatarImage src={player.avatar || undefined} />
                        <AvatarFallback className="text-xl bg-slate-800 font-bold">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white">{player.ingameName}</h1>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {player.alliance && (
                                <Link href={`/alliance/${player.alliance.id}`} className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-sky-400 transition-colors">
                                    <MapPin className="w-4 h-4" />
                                    <span className="font-semibold">{player.alliance.name}</span>
                                </Link>
                            )}
                            {player.championPrestige && (
                                <Badge variant="outline" className="text-xs py-0.5 border-slate-700 text-slate-300 bg-slate-900/50">
                                    Prestige: {player.championPrestige.toLocaleString('en-US')}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Overview Strip */}
            <div className="flex flex-col sm:flex-row border border-slate-800/60 rounded-xl overflow-hidden bg-slate-900/30 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60">
                {/* Roster Stats */}
                <div className="flex items-center gap-5 px-5 py-3.5 flex-1 min-w-0">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest shrink-0">Roster</span>
                    <div className="flex gap-5 flex-wrap">
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase">Total</div>
                            <div className="text-base font-black font-mono text-slate-200">{rosterTotal.toLocaleString()}</div>
                        </div>
                        {stars7Count > 0 && (
                            <div>
                                <div className="text-[10px] text-slate-500 font-black uppercase">7★</div>
                                <div className="text-base font-black font-mono text-purple-400">{stars7Count}</div>
                            </div>
                        )}
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase">6★+</div>
                            <div className="text-base font-black font-mono text-yellow-500">{stars6PlusCount}</div>
                        </div>
                        {rosterAscendedCount > 0 && (
                            <div>
                                <div className="text-[10px] text-slate-500 font-black uppercase">Ascended</div>
                                <div className="text-base font-black font-mono text-purple-300">{rosterAscendedCount}</div>
                            </div>
                        )}
                    </div>
                </div>
                {/* War Stats */}
                {totalFights > 0 && (
                    <div className="flex items-center gap-5 px-5 py-3.5 flex-1 min-w-0">
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest shrink-0">Wars</span>
                        <div className="flex gap-5 flex-wrap">
                            <div>
                                <div className="text-[10px] text-slate-500 font-black uppercase">Wars</div>
                                <div className="text-base font-black font-mono text-slate-200">{totalWars}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 font-black uppercase">Fights</div>
                                <div className="text-base font-black font-mono text-slate-200">{totalFights}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 font-black uppercase">Solo Rate</div>
                                <div className={cn(
                                    "text-base font-black font-mono",
                                    soloRate >= 80 ? "text-emerald-400" : soloRate >= 60 ? "text-amber-400" : "text-red-400"
                                )}>{soloRate}%</div>
                            </div>
                            {totalDeaths > 0 && (
                                <div>
                                    <div className="text-[10px] text-slate-500 font-black uppercase">Deaths</div>
                                    <div className="text-base font-black font-mono text-red-400">{totalDeaths}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Video Stats */}
                {videoTotal > 0 && (
                    <div className="flex items-center gap-5 px-5 py-3.5">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest shrink-0">Videos</span>
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase">Submitted</div>
                            <div className="text-base font-black font-mono text-slate-200">{videoTotal}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Top Roster Section */}
            {roster.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-purple-500 rounded-full" />
                        <h2 className="text-sm font-black text-purple-400 uppercase tracking-[0.2em]">Top Champions</h2>
                        <Link href={`/player/${id}/roster`} className="text-xs text-slate-500 hover:text-sky-400 ml-auto transition-colors">View Full Roster</Link>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {roster.map(r => (
                            <ChampionAvatar
                                key={r.id}
                                name={r.champion.name}
                                images={r.champion.images as unknown as ChampionImages}
                                championClass={r.champion.class}
                                stars={r.stars}
                                rank={r.rank}
                                isAwakened={r.isAwakened}
                                isAscended={r.isAscended}
                                sigLevel={r.sigLevel}
                                size="lg"
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                return (
                                    <Link key={video.id} href={`/war-videos/${video.id}`}>
                                        <Card className="bg-slate-900/50 border-slate-800 hover:border-red-900/50 transition-all hover:shadow-lg hover:shadow-red-900/10 cursor-pointer overflow-hidden h-full flex flex-col">
                                            <div className="p-3 flex-1 bg-slate-950/60 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center shrink-0">
                                                        <Play className="w-3.5 h-3.5 text-red-400 ml-0.5" fill="currentColor" />
                                                    </div>
                                                    {war && (
                                                        <Badge variant="outline" className="border-red-900/50 text-red-400 bg-red-950/20 text-[10px]">
                                                            S{war.season} W{war.warNumber || '-'} T{war.warTier}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {fighters.length > 0 && (
                                                    <div className="flex gap-1.5">
                                                        {fighters.map((fighter, i) => (
                                                            <ChampionAvatar
                                                                key={i}
                                                                name={fighter!.name}
                                                                images={fighter!.images as unknown as ChampionImages}
                                                                championClass={fighter!.class}
                                                                size="sm"
                                                                showStars={false}
                                                                showRank={false}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {war && (
                                                    <p className="text-xs text-slate-400 font-medium truncate leading-none">{war.alliance.name}</p>
                                                )}
                                            </div>
                                            <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
                                                <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                                                <span className="text-sky-400 font-medium flex items-center gap-1">
                                                    <Play className="w-3 h-3" /> Watch
                                                </span>
                                            </div>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Quest Plans Section */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-sky-500 rounded-full" />
                        <h2 className="text-sm font-black text-sky-400 uppercase tracking-[0.2em]">Quest Plans</h2>
                        <Badge variant="secondary" className="text-[10px] h-4 ml-1">{questPlans.length}</Badge>
                    </div>

                    {questPlans.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                            <ScrollText className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">No quest plans yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {questPlans.slice(0, 4).map(plan => (
                                <Link key={plan.id} href={`/player/${id}/quests/${plan.questPlan.id}`}>
                                    <Card className="bg-slate-900/50 border-slate-800 hover:border-sky-800/50 transition-all hover:shadow-lg hover:shadow-sky-500/5 cursor-pointer group overflow-hidden h-full flex flex-col">
                                        {plan.questPlan.bannerUrl ? (
                                            <div className="relative h-24 overflow-hidden shrink-0">
                                                <Image
                                                    src={plan.questPlan.bannerUrl.replace(/#/g, '%23')}
                                                    alt={plan.questPlan.title}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                    style={{
                                                        objectFit: (plan.questPlan.bannerFit as "cover" | "contain") || "cover",
                                                        objectPosition: plan.questPlan.bannerPosition || "center"
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                            </div>
                                        ) : (
                                            <div className="h-24 bg-slate-950/50 shrink-0 flex items-center justify-center">
                                                <ScrollText className="w-8 h-8 text-slate-800" />
                                            </div>
                                        )}
                                        <CardContent className="p-3 flex-1 flex flex-col justify-between">
                                            <div>
                                                {plan.questPlan.category && (
                                                    <Badge variant="outline" className="text-[9px] uppercase font-bold border-slate-700 text-slate-400 mb-1.5">
                                                        {plan.questPlan.category.name}
                                                    </Badge>
                                                )}
                                                <h3 className="font-bold text-sm text-slate-200 group-hover:text-sky-400 transition-colors line-clamp-2">
                                                    {plan.questPlan.title}
                                                </h3>
                                            </div>
                                            <div className="mt-3">
                                                <Badge variant="secondary" className="text-[10px] h-5 bg-sky-950/30 border-sky-900/50 text-sky-400">
                                                    {plan.encounters.length} / {plan.questPlan.encounters.length} picked
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Fights Section */}
            {recentFights.length > 0 && (() => {
                // Group fights by war, preserving newest-first order
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
                                const totalDeaths = warFights.reduce((s, f) => s + f.death, 0);
                                return (
                                    <Card key={war.id} className="bg-slate-950/40 border-slate-800/60 overflow-hidden">
                                        {/* War header */}
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
                                                {totalDeaths > 0 ? (
                                                    <div className="flex items-center gap-1.5 text-red-400 text-xs font-black uppercase italic">
                                                        <Skull className="w-3.5 h-3.5" />
                                                        {totalDeaths} Death{totalDeaths > 1 ? 's' : ''}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase italic">
                                                        <Trophy className="w-3.5 h-3.5" />
                                                        Solo
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Fight rows */}
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
                                                        {/* Node */}
                                                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-slate-500 shrink-0">
                                                            {fight.node.nodeNumber}
                                                        </div>

                                                        {/* Champion pill */}
                                                        <div className="flex items-center bg-slate-900/80 rounded-full pl-1.5 pr-4 py-1.5 border border-slate-800 shadow-inner min-w-0">
                                                            {/* Attacker */}
                                                            <div className="relative shrink-0">
                                                                <div className={cn("absolute inset-0 rounded-full blur-sm opacity-40", attackerColors.bg)} />
                                                                <Avatar className={cn("h-9 w-9 border-none bg-slate-950 shadow-md relative", attackerColors.border)}>
                                                                    {attackerImages && <AvatarImage src={getChampionImageUrlOrPlaceholder(attackerImages, "64")} />}
                                                                    <AvatarFallback className="text-xs font-black">{fight.attacker?.name.substring(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                                                                </Avatar>
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-600 uppercase mx-3 shrink-0">VS</span>
                                                            {/* Defender */}
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
                                                        </div>{/* end left group */}

                                                        {/* Result + video */}
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
        </div>
    );
}


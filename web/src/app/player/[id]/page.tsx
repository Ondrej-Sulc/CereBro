import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlansForProfile } from "@/app/actions/quests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ScrollText, Play, History, Swords, Shield, Skull } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ChampionAvatar } from "@/components/champion-avatar";
import { ChampionImages } from "@/types/champion";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { ChampionClass } from "@prisma/client";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

interface PlayerProfilePageProps {
    params: Promise<{ id: string }>;
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
    const { id } = await params;

    const player = await prisma.player.findUnique({
        where: { id },
        include: {
            alliance: { select: { id: true, name: true } }
        }
    });

    if (!player) notFound();

    const currentUser = await getUserPlayerWithAlliance();

    const questPlans = await getPlayerQuestPlansForProfile(id);

    const roster = await prisma.roster.findMany({
        where: { playerId: id },
        include: { champion: true },
        orderBy: [
            { stars: 'desc' },
            { rank: 'desc' },
            { sigLevel: 'desc' },
            { powerRating: 'desc' }
        ],
        take: 12
    });

    const recentVideos = await prisma.warVideo.findMany({
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
                take: 1,
                include: { war: { include: { alliance: true } } }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 4
    });

    const recentFights = await prisma.warFight.findMany({
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
        take: 6
    });

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

            {/* Top Roster Section */}
            {roster.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-purple-500 rounded-full" />
                        <h2 className="text-sm font-black text-purple-400 uppercase tracking-[0.2em]">Top Champions</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {roster.map(r => (
                            <div key={r.id} className="relative group">
                                <ChampionAvatar
                                    name={r.champion.name}
                                    images={r.champion.images as unknown as ChampionImages}
                                    championClass={r.champion.class}
                                    stars={r.stars}
                                    rank={r.rank}
                                    isAwakened={r.isAwakened}
                                    sigLevel={r.sigLevel}
                                    size="lg"
                                />
                                {r.isAscended && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full border border-slate-950 shadow-sm" title="Ascended" />
                                )}
                            </div>
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
                                return (
                                    <Link key={video.id} href={`/war-videos/${video.id}`}>
                                        <Card className="bg-slate-900/50 border-slate-800 hover:border-red-900/50 transition-all hover:shadow-lg hover:shadow-red-900/10 cursor-pointer overflow-hidden h-full flex flex-col">
                                            <div className="p-4 flex-1 flex flex-col justify-center items-center relative min-h-[100px] bg-slate-950/50 group">
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <Play className="w-10 h-10 text-red-500/80" fill="currentColor" />
                                                </div>
                                                {war ? (
                                                    <div className="text-center space-y-1">
                                                        <Badge variant="outline" className="border-red-900/50 text-red-400 bg-red-950/20 text-[10px]">
                                                            S{war.season} W{war.warNumber || '-'} T{war.warTier}
                                                        </Badge>
                                                        <p className="text-xs text-slate-400 font-mono mt-2">{war.alliance.name}</p>
                                                    </div>
                                                ) : (
                                                    <Play className="w-8 h-8 text-slate-700" />
                                                )}
                                            </div>
                                            <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                                                <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                                                <span className="font-medium text-slate-300">Watch</span>
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
                                                    src={plan.questPlan.bannerUrl}
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
            {recentFights.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-1 bg-amber-500 rounded-full" />
                        <h2 className="text-sm font-black text-amber-400 uppercase tracking-[0.2em]">Recent War Fights</h2>
                        <Link href={`/war-videos?player=${encodeURIComponent(player.ingameName)}`} className="text-xs text-slate-500 hover:text-sky-400 ml-auto transition-colors">View All in Archive</Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {recentFights.map(fight => {
                            const isDeath = fight.death > 0;
                            return (
                                <Card key={fight.id} className={cn(
                                    "bg-slate-900/50 border overflow-hidden",
                                    isDeath ? "border-red-900/30" : "border-slate-800"
                                )}>
                                    <div className={cn(
                                        "px-3 py-1.5 border-b text-[10px] font-mono flex justify-between items-center",
                                        isDeath ? "border-red-900/30 bg-red-950/20" : "border-slate-800/60 bg-slate-950/50"
                                    )}>
                                        <span className="text-slate-400">S{fight.war.season} W{fight.war.warNumber || '-'} T{fight.war.warTier}</span>
                                        <span className="text-slate-500">{new Date(fight.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="p-3 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {fight.attacker ? (
                                                <div className="relative shrink-0">
                                                    <ChampionAvatar 
                                                        name={fight.attacker.name} 
                                                        images={fight.attacker.images as unknown as ChampionImages}
                                                        championClass={fight.attacker.class}
                                                        size="sm"
                                                        showStars={false}
                                                        showRank={false}
                                                    />
                                                </div>
                                            ) : <div className="w-8 h-8 rounded bg-slate-800 shrink-0" />}
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn("text-xs font-bold truncate", fight.attacker ? getChampionClassColors(fight.attacker.class as ChampionClass).text : "text-slate-400")}>
                                                    {fight.attacker?.name || '?'}
                                                </span>
                                                {isDeath && (
                                                    <span className="text-[9px] text-red-400 flex items-center gap-0.5">
                                                        <Skull className="w-2.5 h-2.5" /> Death
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center shrink-0">
                                            <span className="text-[9px] text-slate-500 mb-0.5">Node</span>
                                            <Badge variant="secondary" className="h-5 px-1.5 bg-amber-900/10 text-amber-500 border-amber-500/20 font-mono text-xs">
                                                {fight.node.nodeNumber}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn("text-xs font-bold truncate", fight.defender ? getChampionClassColors(fight.defender.class as ChampionClass).text : "text-slate-400")}>
                                                    {fight.defender?.name || '?'}
                                                </span>
                                            </div>
                                            {fight.defender ? (
                                                <div className="relative shrink-0">
                                                    <ChampionAvatar 
                                                        name={fight.defender.name} 
                                                        images={fight.defender.images as unknown as ChampionImages}
                                                        championClass={fight.defender.class}
                                                        size="sm"
                                                        showStars={false}
                                                        showRank={false}
                                                    />
                                                </div>
                                            ) : <div className="w-8 h-8 rounded bg-slate-800 shrink-0" />}
                                        </div>
                                    </div>
                                    {fight.video && (
                                        <div className="px-3 py-2 bg-slate-950/40 border-t border-slate-800/60 flex justify-end">
                                            <Link href={`/war-videos/${fight.video.id}`} className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors">
                                                <Play className="w-3 h-3" /> Watch Video
                                            </Link>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}


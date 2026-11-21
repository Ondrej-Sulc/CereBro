import { getFightRecordings, getVideoFights, fightHasVisibleRecording, canViewFightRecording } from '@cerebro/core/domain/war-recordings';
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlansForProfile } from "@/app/actions/quest-plan-sharing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Play, Skull, Trophy, Video, Swords, Shield, Layers, Clock, CheckCircle2, Users, Repeat2, Map as MapIcon, ArrowRight, Image as ImageIcon, Star, Heart, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ChampionAvatar } from "@/components/champion-avatar";
import { ChampionImages } from "@/types/champion";
import { getChampionImageUrlOrPlaceholder, isChampionImages } from "@/lib/championHelper";
import { projectMcocPrestige } from "@/lib/mcoc-prestige";
import { normalizeRosterAscensionState } from "@cerebro/core/domain/roster-ascension-state";
import { cn } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { cache } from "react";
import { getYoutubeVideoId } from "@/lib/youtube";
import { isPlayerSupporter } from "@/lib/support-status";
import { canManageAllianceMembers } from "@/lib/alliance-permissions";
import { InvitePlayerButton } from "./invite-player-button";
import {
    canViewPlayerWarInsights,
    getAvailablePlayerWarInsightSeasons,
    getPlayerWarInsights,
    normalizePlayerWarInsightScope,
} from "@/lib/player-war-insights";
import { PlayerWarInsightsSection } from "./player-war-insights-section";
import { PlayerProfileMetric, PlayerProfileSectionHeading, profileActionClass, profilePrimaryActionClass } from "@/components/player-profile-ui";

interface PlayerProfilePageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{
        warSeason?: string | string[];
    }>;
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

export default async function PlayerProfilePage({ params, searchParams }: PlayerProfilePageProps) {
    const { id } = await params;
    const resolvedSearchParams = await searchParams;

    const player = await getPlayerProfile(id);

    if (!player) notFound();

    const currentUser = await getUserPlayerWithAlliance();

    const canInvitePlayer = Boolean(
        currentUser?.allianceId &&
        !player.allianceId &&
        currentUser.id !== player.id &&
        canManageAllianceMembers(currentUser, currentUser.isBotAdmin)
    );

    const canViewWarInsights = canViewPlayerWarInsights({
        viewer: currentUser,
        target: player,
    });

    const warInsightsPromise = canViewWarInsights
        ? (async () => {
            const availableSeasons = await getAvailablePlayerWarInsightSeasons({
                playerId: id,
            });

            if (availableSeasons.length === 0) return null;

            const scope = normalizePlayerWarInsightScope(resolvedSearchParams.warSeason, availableSeasons);
            return getPlayerWarInsights({
                playerId: id,
                scope,
            });
        })()
        : Promise.resolve(null);

    const eligibleWarFightWhere = {
        playerId: id,
        war: {
            status: { not: "PLANNING" },
            warNumber: { not: null },
            season: { not: 0 },
        },
    } satisfies Prisma.WarFightWhereInput;

    const [questPlans, roster, rawRecentVideos, rawRecentFights, rosterTotal, rosterByStars, videoTotal, fightAggregate, uniqueWarIds, supporter, pendingInvite, warInsights] = await Promise.all([
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
                        OR: [
                          { fights: { some: { war: { allianceId: currentUser.allianceId } } } },
                          { fightLinks: { some: { fight: { war: { allianceId: currentUser.allianceId } } } } },
                        ]
                    }] : [])
                ]
            },
            include: {
                fights: { include: { war: { include: { alliance: true } }, attacker: true, defender: true } },
                fightLinks: { include: { fight: { include: { war: { include: { alliance: true } }, attacker: true, defender: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: 4
        }),
        prisma.warFight.findMany({
            where: {
                playerId: id,
                OR: [
                    fightHasVisibleRecording(currentUser),
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
                video: true,
                recordings: { include: { video: true } }
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
        prisma.warVideo.count({ where: { submittedById: id, status: 'PUBLISHED' } }),
        prisma.warFight.aggregate({
            where: eligibleWarFightWhere,
            _count: { id: true },
            _sum: { death: true }
        }),
        prisma.warFight.groupBy({ by: ['warId'], where: eligibleWarFightWhere }),
        isPlayerSupporter(player),
        canInvitePlayer && currentUser?.allianceId ? prisma.allianceMembershipRequest.findFirst({
            where: {
                allianceId: currentUser.allianceId,
                playerId: id,
                status: "PENDING",
                type: "INVITE",
            },
            select: { id: true },
        }) : Promise.resolve(null),
        warInsightsPromise,
    ]);

    const recentVideos = rawRecentVideos.map(video => ({ ...video, fights: getVideoFights(video) }));
    const recentFights = rawRecentFights.map(fight => ({ ...fight,
      videos: getFightRecordings(fight).filter(video => canViewFightRecording(video, fight.war.allianceId, currentUser)),
      video: getFightRecordings(fight).find(video => canViewFightRecording(video, fight.war.allianceId, currentUser)) || null,
    }));

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

    const stats = [
        ...(player.championPrestige != null ? [{
            label: "Champion prestige",
            value: player.championPrestige.toLocaleString("en-US"),
            description: "Top 30 average",
        }] : []),
        {
            label: "Champions",
            value: rosterTotal.toLocaleString("en-US"),
            description: stars6PlusCount > 0 ? (stars7Count > 0 ? stars7Count + " seven-star · " : "") + stars6PlusCount + " six-star or higher" : undefined,
        },
        ...(totalFights > 0 ? [{
            label: "War solo rate",
            value: soloRate + "%",
            description: totalWars + " wars · " + totalFights + " fights" + (totalDeaths ? " · " + totalDeaths + (totalDeaths === 1 ? " death" : " deaths") : ""),
        }] : []),
        ...(videoTotal > 0 ? [{
            label: "War videos",
            value: videoTotal.toLocaleString("en-US"),
            description: "Published recordings",
        }] : []),
    ];
    const archiveHref = "/war-videos?player=" + encodeURIComponent(player.ingameName);
    const featuredChampion = roster.find(entry => isChampionImages(entry.champion.images))?.champion;
    const profileSections = [
        { label: "Champions", href: "#top-champions" },
        ...(recentFights.length || recentVideos.length ? [{ label: "War activity", href: recentFights.length ? "#recent-war-fights" : "#recent-war-videos" }] : []),
        ...(questPlans.length ? [{ label: "Quest plans", href: "#shared-quest-plans" }] : []),
    ];

    return (
        <div className="mx-auto max-w-[1240px] space-y-6 px-4 pb-12 pt-5 sm:space-y-8 sm:px-6 sm:pt-7 lg:px-8">
            <header className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0a131c] sm:rounded-3xl">
                <div className="relative isolate flex min-h-[13rem] items-center overflow-hidden bg-[radial-gradient(ellipse_at_88%_40%,#18424a,transparent_62%),linear-gradient(120deg,#0a1922,#061119)] px-4 py-5 sm:min-h-[15.5rem] sm:px-8 sm:py-7">
                    {featuredChampion && (
                        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-12 -z-10 w-[80%] [mask-image:linear-gradient(to_right,transparent,black_28%)] sm:-right-8 sm:w-[58%]">
                            <Image
                                src={getChampionImageUrlOrPlaceholder(featuredChampion.images, "full", "hero")}
                                alt=""
                                fill
                                sizes="(min-width: 1024px) 650px, (min-width: 640px) 60vw, 80vw"
                                className="object-cover object-[55%_28%] opacity-75 sm:object-[65%_10%] sm:opacity-90"
                                loading="eager"
                            />
                        </div>
                    )}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(6,17,25,0.98)_0%,rgba(6,17,25,0.9)_35%,rgba(6,17,25,0.27)_73%,rgba(6,17,25,0.04)_100%),linear-gradient(0deg,rgba(6,17,25,0.75),transparent_70%)]" />
                    <div className="min-w-0 max-w-lg flex-1 space-y-4">
                        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
                            <Avatar className="size-12 shrink-0 rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100 sm:size-16 sm:rounded-2xl">
                                <AvatarImage src={player.avatar || undefined} alt="" />
                                <AvatarFallback className="rounded-xl bg-cyan-300/10 text-base font-semibold sm:rounded-2xl sm:text-xl">{player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Player profile</p>
                                <h1 className="mt-0.5 break-words text-[1.75rem] font-bold leading-tight tracking-tight text-white sm:text-5xl">{player.ingameName}</h1>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-300 sm:text-sm">
                            {player.alliance && (
                                <Link href={"/alliance/" + player.alliance.id} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm font-medium text-cyan-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                                    <span className="break-words">{player.alliance.name}</span>
                                </Link>
                            )}
                            {player.battlegroup ? <span className="rounded-md border border-white/15 bg-slate-950/45 px-1.5 py-0.5 text-xs font-medium">BG {player.battlegroup}</span> : null}
                            {player.isOfficer && <span className="text-xs font-medium text-amber-200">Officer</span>}
                            {supporter && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-200"><Heart className="size-3" aria-hidden="true" /> Supporter</span>}
                            {lastActiveDate && <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-slate-300"><Clock className="size-3" aria-hidden="true" /> {formatRelativeDate(lastActiveDate)}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={"/player/" + id + "/roster"} className={cn(profilePrimaryActionClass, "bg-cyan-300 text-slate-950 hover:bg-cyan-200 focus-visible:ring-cyan-200")}>
                                <Layers className="size-4" aria-hidden="true" /> Full roster
                            </Link>
                            {canInvitePlayer && <InvitePlayerButton playerId={player.id} initialPending={Boolean(pendingInvite)} />}
                        </div>
                    </div>
                    {featuredChampion && (
                        <p className="absolute bottom-4 right-5 hidden items-center gap-2 rounded-full border border-white/15 bg-slate-950/65 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-sm sm:inline-flex">
                            <Star className="size-3 text-cyan-200" aria-hidden="true" /> {featuredChampion.name}
                        </p>
                    )}
                </div>
                <dl className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
                    {stats.map(({ label, value, description }, index) => (
                        <PlayerProfileMetric
                            key={label}
                            label={label}
                            value={value}
                            description={description}
                            className={cn("bg-[#0a131c] sm:px-6", index === stats.length - 1 && stats.length % 2 === 1 && "col-span-2 sm:col-span-1")}
                        />
                    ))}
                </dl>
            </header>

            {profileSections.length > 1 && (
                <nav aria-label="Profile sections" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-800 px-1 sm:gap-x-6">
                    {profileSections.map(({ label, href }) => (
                        <a key={href} href={href} className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-xs font-medium text-slate-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:text-sm">
                            {label} <ArrowUpRight className="size-3 text-slate-500" aria-hidden="true" />
                        </a>
                    ))}
                </nav>
            )}

            <div className={cn("grid items-start gap-6", recentFights.length > 0 && "lg:grid-cols-[minmax(0,1.9fr)_minmax(19rem,1fr)]")}>
                <section aria-labelledby="top-champions" className="min-w-0">
                    <PlayerProfileSectionHeading title="Top champions" id="top-champions" />
                    {roster.length > 0 ? (
                        <ul aria-label="Top champion cards" tabIndex={0} className={cn("grid auto-cols-[minmax(6.5rem,30%)] grid-flow-col snap-x snap-proximity gap-2.5 overflow-x-auto rounded-lg pb-2 [scrollbar-color:#475569_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-5 sm:pb-0", !recentFights.length && "lg:grid-cols-10")}>
                            {roster.map(r => {
                                const prestige = projectMcocPrestige({
                                    prestigeData: r.champion.prestigeData,
                                    stat: { rarity: r.stars, rank: r.rank, prestige: null },
                                    sigLevel: r.sigLevel,
                                    ascensionLevel: normalizeRosterAscensionState(r).ascensionLevel,
                                });
                                return (
                                    <li key={r.id} className="flex min-w-0 snap-start flex-col gap-2 rounded-xl border border-slate-800 bg-[#0a131c] p-1.5 sm:p-2">
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
                                            className="aspect-square h-auto w-full rounded-lg"
                                        />
                                        <div className="w-full px-0.5 pb-0.5 text-center">
                                            <p title={r.champion.name} className="line-clamp-2 break-words text-xs font-semibold leading-tight text-slate-100">{r.champion.name}</p>
                                            {prestige && (
                                                <p className="mt-1 text-xs font-medium tabular-nums text-cyan-100">{prestige.toLocaleString("en-US")}</p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-5">
                            <Layers className="size-5 text-indigo-300" aria-hidden="true" />
                            <p className="text-sm text-slate-400">No champions have been added to this roster yet.</p>
                        </div>
                    )}
                </section>

                {recentFights.length > 0 && (() => {
                    const fightsByWar = new Map<string, typeof recentFights>();
                    for (const fight of recentFights) {
                        const warFights = fightsByWar.get(fight.war.id) ?? [];
                        warFights.push(fight);
                        fightsByWar.set(fight.war.id, warFights);
                    }

                    return (
                        <section aria-labelledby="recent-war-fights" className="min-w-0">
                            <PlayerProfileSectionHeading
                                title="Recent war fights"
                                id="recent-war-fights"
                                action={<Link href={archiveHref} className={cn(profileActionClass, "min-h-9 px-2.5 text-xs")}>War archive <ArrowUpRight className="size-3" aria-hidden="true" /></Link>}
                            />
                            <div className="space-y-3">
                                {[...fightsByWar.values()].map(warFights => {
                                    const { war } = warFights[0];
                                    const deaths = warFights.reduce((count, fight) => count + fight.death, 0);
                                    return (
                                        <section key={war.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-3 sm:px-4">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                                                        <Shield className="size-4" aria-hidden="true" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <h3 className="break-words text-sm font-semibold text-slate-100">{war.alliance.name}</h3>
                                                        <p className="text-xs text-slate-400">Season {war.season}{war.warNumber ? " · War " + war.warNumber : ""} · Tier {war.warTier}</p>
                                                    </div>
                                                </div>
                                                <p className="ml-auto flex shrink-0 items-center gap-2 text-xs text-slate-300">
                                                    <span>{warFights.length} {warFights.length === 1 ? "fight" : "fights"}</span>
                                                    <span className={deaths > 0 ? "text-amber-300" : "text-emerald-300"}>{deaths > 0 ? deaths + (deaths === 1 ? " death" : " deaths") : "All solo"}</span>
                                                </p>
                                            </div>
                                            <ul className="divide-y divide-slate-800/75">
                                                {warFights.map(fight => (
                                                    <li key={fight.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-800/40">
                                                        <div className="grid min-w-9 justify-items-center rounded-lg border border-slate-800 bg-slate-950/60 px-1.5 py-1 text-slate-400">
                                                            <span className="text-[9px] uppercase tracking-wide">Node</span>
                                                            <span className="text-sm font-semibold tabular-nums text-slate-200">{fight.node.nodeNumber}</span>
                                                        </div>
                                                        <div className="grid min-w-0 gap-1.5">
                                                            {([["Attacker", fight.attacker], ["Defender", fight.defender]] as const).map(([side, champion]) => (
                                                                <div key={side} className="flex min-w-0 items-center gap-2">
                                                                    <Avatar className="size-7 shrink-0 rounded-lg border border-slate-700">
                                                                        {champion && <AvatarImage src={getChampionImageUrlOrPlaceholder(champion.images, "64")} alt="" />}
                                                                        <AvatarFallback className="rounded-lg text-[10px]">{champion?.name.slice(0, 2).toUpperCase() ?? "?"}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span title={champion?.name} className="min-w-0 break-words text-xs font-medium text-slate-200 [overflow-wrap:anywhere]">
                                                                        <span className="sr-only">{side}: </span>{champion?.name || "Unknown"}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1.5">
                                                            <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium", fight.death > 0 ? "text-amber-300" : "text-emerald-300")}>
                                                                {fight.death > 0 ? <Skull className="size-3" aria-hidden="true" /> : <Trophy className="size-3" aria-hidden="true" />}
                                                                {fight.death > 0 ? fight.death + (fight.death === 1 ? " death" : " deaths") : "Solo"}
                                                            </span>
                                                            {fight.video ? (
                                                                <Link href={"/war-videos/" + fight.video.id} aria-label={"Watch fight on node " + fight.node.nodeNumber} className="grid size-9 place-items-center rounded-lg border border-indigo-400/25 bg-indigo-400/10 text-indigo-200 transition-colors hover:bg-indigo-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                                                                    <Play className="size-4" aria-hidden="true" />
                                                                </Link>
                                                            ) : null}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })()}
            </div>

            {warInsights && <PlayerWarInsightsSection playerName={player.ingameName} insights={warInsights} />}

            {/* Videos + Quest Plans */}
            {(recentVideos.length > 0 || questPlans.length > 0) && (
            <div className={cn("grid grid-cols-1 gap-8", recentVideos.length > 0 && questPlans.length > 0 ? "lg:grid-cols-2" : "")}>
                {/* Recent War Videos */}
                {recentVideos.length > 0 && (
                    <section aria-labelledby="recent-war-videos">
                        <PlayerProfileSectionHeading title="Recent war videos" id="recent-war-videos" action={!recentFights.length && (
                            <Link href={archiveHref} className={profileActionClass}>War archive <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
                        )} />
                        <div className={cn("grid grid-cols-1 gap-4", recentVideos.length > 1 && "sm:grid-cols-2")}>
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
                                    <Link key={video.id} href={`/war-videos/${video.id}`} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                        <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border-slate-800 bg-slate-900/50 transition-colors hover:border-indigo-400/40">
                                            {/* Video Thumbnail Area */}
                                            <div className="relative h-32 w-full overflow-hidden bg-slate-950 border-b border-slate-800 shrink-0">
                                                {youtubeId ? (
                                                    <Image
                                                        src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                                                        alt=""
                                                        fill
                                                        unoptimized
                                                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                        <Video className="size-16 text-indigo-300" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                                {/* Play Button Overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="flex size-11 items-center justify-center rounded-full border border-indigo-300/30 bg-indigo-500/80 backdrop-blur-sm transition-colors group-hover:bg-indigo-400">
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
                                                    <h3 className="line-clamp-1 text-sm font-semibold leading-tight text-slate-200 transition-colors group-hover:text-indigo-200">
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
                    </section>
                )}

                {/* Quest Plans Section */}
                {questPlans.length > 0 && (
                <section aria-labelledby="shared-quest-plans">
                    <PlayerProfileSectionHeading title="Quest plans" id="shared-quest-plans" detail={questPlans.length > 4 ? "4 of " + questPlans.length : undefined} />

                    <div className={cn("grid grid-cols-1 gap-4", questPlans.length > 1 && "sm:grid-cols-2")}>
                        {questPlans.slice(0, 4).map(plan => {
                            const isCompleted = plan.encounters.length >= plan.questPlan.encounters.length && plan.questPlan.encounters.length > 0;
                            return (
                            <Link key={plan.id} href={`/player/${id}/quests/${plan.questPlan.id}`} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                <Card className={cn(
                                    "group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/50 transition-colors",
                                    isCompleted
                                        ? "border-emerald-800/50 hover:border-emerald-400/40"
                                        : "border-slate-800 hover:border-indigo-400/40"
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
                                            <h3 className="line-clamp-2 text-base font-semibold leading-tight text-slate-100 transition-colors group-hover:text-indigo-200">
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
                </section>
                )}
            </div>
            )}

        </div>
    );
}

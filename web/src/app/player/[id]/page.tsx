import { getFightRecordings, getVideoFights, fightHasVisibleRecording, canViewFightRecording } from '@cerebro/core/domain/war-recordings';
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlansForProfile } from "@/app/actions/quest-plan-sharing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Play, Skull, Trophy, Shield, Layers, Clock, ChevronRight, Map as MapIcon, ArrowRight, Star, Heart, ArrowUpRight } from "lucide-react";
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
import { TopChampionsGallery } from "./top-champions-gallery";
import { PlayerProfileMetric, PlayerProfileSectionHeading, profileActionClass, profilePrimaryActionClass } from "@/components/player-profile-ui";

interface PlayerProfilePageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{
        warSeason?: string | string[];
    }>;
}

const profileCollectionRowClass = "group grid min-h-[4.625rem] grid-cols-[4.875rem_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-1 py-2.5 transition-colors hover:bg-slate-900/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:min-h-20 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-3";
const profileCollectionThumbnailClass = "relative grid h-[3.1875rem] place-items-center overflow-hidden rounded-lg bg-slate-900 text-slate-400 sm:h-14";
const profileCollectionTitleClass = "break-words text-sm font-semibold leading-snug text-slate-100 transition-colors group-hover:text-cyan-200";

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

            <div className={cn("grid items-start gap-6", recentFights.length > 0 && "lg:grid-cols-[minmax(0,1.62fr)_minmax(21rem,1fr)] lg:gap-7")}>
                <section aria-labelledby="top-champions" className="min-w-0">
                    <PlayerProfileSectionHeading title="Top champions" id="top-champions" />
                    {roster.length > 0 ? (
                        <TopChampionsGallery count={roster.length} className={!recentFights.length ? "lg:grid-cols-10" : undefined}>
                            {roster.map(r => {
                                const prestige = projectMcocPrestige({
                                    prestigeData: r.champion.prestigeData,
                                    stat: { rarity: r.stars, rank: r.rank, prestige: null },
                                    sigLevel: r.sigLevel,
                                    ascensionLevel: normalizeRosterAscensionState(r).ascensionLevel,
                                });
                                return (
                                    <li key={r.id} className="flex min-w-0 flex-col gap-1.5">
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
                                            className="aspect-square h-auto w-full rounded-lg border-white/15 shadow-none"
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
                        </TopChampionsGallery>
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
                            <div className="space-y-2.5">
                                {[...fightsByWar.values()].map(warFights => {
                                    const { war } = warFights[0];
                                    const deaths = warFights.reduce((count, fight) => count + fight.death, 0);
                                    return (
                                        <section key={war.id}>
                                            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 pt-1">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <Shield className="ml-1.5 size-4 shrink-0 text-cyan-200/80" aria-hidden="true" />
                                                    <div className="min-w-0">
                                                        <h3 className="break-words text-sm font-semibold leading-snug text-slate-100">{war.alliance.name}</h3>
                                                        <p className="text-[11px] text-slate-400">Season {war.season}{war.warNumber ? " · War " + war.warNumber : ""} · Tier {war.warTier}</p>
                                                    </div>
                                                </div>
                                                <p className="flex shrink-0 flex-wrap justify-end gap-x-2 text-right text-[11px] text-slate-400">
                                                    <span>{warFights.length} {warFights.length === 1 ? "fight" : "fights"}</span>
                                                    {deaths > 0 && <span className="text-amber-300">{deaths} {deaths === 1 ? "death" : "deaths"}</span>}
                                                </p>
                                            </div>
                                            <ul className="divide-y divide-slate-800/75">
                                                {warFights.map(fight => (
                                                    <li key={fight.id} className="grid min-h-12 grid-cols-[1.875rem_minmax(0,1fr)_3.5rem] items-center gap-2 py-1.5 transition-colors hover:bg-slate-800/30">
                                                        <div className="grid justify-items-center text-slate-400">
                                                            <span className="text-[9px] uppercase tracking-wide">Node</span>
                                                            <span className="text-sm font-semibold tabular-nums text-slate-200">{fight.node.nodeNumber}</span>
                                                        </div>
                                                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-1.5">
                                                            <ArrowRight className="col-start-2 row-start-1 size-3 text-slate-500" aria-hidden="true" />
                                                            {([["Attacker", fight.attacker], ["Defender", fight.defender]] as const).map(([side, champion]) => (
                                                                <div key={side} className={cn(
                                                                    "row-start-1 flex min-w-0 items-center gap-1 sm:gap-1.5",
                                                                    side === "Attacker" ? "col-start-1 font-semibold text-slate-100" : "col-start-3 font-medium text-slate-300"
                                                                )}>
                                                                    <Avatar className="size-5 shrink-0 rounded-md border border-slate-700 max-[359px]:size-4 sm:size-6">
                                                                        {champion && <AvatarImage src={getChampionImageUrlOrPlaceholder(champion.images, "64")} alt="" />}
                                                                        <AvatarFallback className="rounded-md text-[9px]">{champion?.name.slice(0, 2).toUpperCase() ?? "?"}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span title={champion?.name} className="min-w-0 text-[11px] leading-tight [overflow-wrap:anywhere]">
                                                                        <span className="sr-only">{side}: </span>{champion?.name || "Unknown"}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className={cn("inline-flex items-center justify-end gap-1 text-right text-[11px] font-medium leading-none", fight.death > 0 ? "text-amber-300" : "text-emerald-300")}>
                                                                {fight.death > 0 ? <Skull className="size-3 shrink-0" aria-hidden="true" /> : <Trophy className="size-3 shrink-0" aria-hidden="true" />}
                                                                {fight.death > 0 ? fight.death + (fight.death === 1 ? " death" : " deaths") : "Solo"}
                                                            </span>
                                                            {fight.video ? (
                                                                <Link href={"/war-videos/" + fight.video.id} aria-label={"Watch fight on node " + fight.node.nodeNumber} className="grid size-8 place-items-center rounded-md bg-indigo-400/10 text-indigo-200 transition-colors hover:bg-indigo-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                                                                    <Play className="size-3.5" aria-hidden="true" />
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

            {(recentVideos.length > 0 || questPlans.length > 0) && (
                <div className={cn("grid items-start gap-8", recentVideos.length > 0 && questPlans.length > 0 && "lg:grid-cols-2")}>
                    {recentVideos.length > 0 && (
                        <section aria-labelledby="recent-war-videos" className="min-w-0">
                            <PlayerProfileSectionHeading title="Recent war videos" id="recent-war-videos" action={!recentFights.length && (
                                <Link href={archiveHref} className={profileActionClass}>War archive <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
                            )} />
                            <ul className="divide-y divide-slate-800/90">
                                {recentVideos.map(video => {
                                    const war = video.fights[0]?.war;
                                    const fightCount = video.fights.length;
                                    const youtubeId = getYoutubeVideoId(video.url);
                                    const [attackers, defenders] = (["attacker", "defender"] as const).map(side =>
                                        [...new Map(video.fights.flatMap(fight => {
                                            const champion = fight[side];
                                            return champion ? [[champion.id, champion.name] as const] : [];
                                        })).values()]
                                    );
                                    const matchup = [attackers, defenders]
                                        .filter(names => names.length > 0)
                                        .map(names => names[0] + (names.length > 1 ? " +" + (names.length - 1) : ""))
                                        .join(" → ");
                                    const fullMatchup = [
                                        attackers.length > 0 && "Attackers: " + attackers.join(", "),
                                        defenders.length > 0 && "Defenders: " + defenders.join(", "),
                                    ].filter(Boolean).join(". ");
                                    const videoDetails = [
                                        war && `S${war.season} · ${war.warNumber ? "W" + war.warNumber : "Off-season"} · T${war.warTier}`,
                                        fightCount + (fightCount === 1 ? " fight" : " fights"),
                                    ].filter(Boolean).join(" · ");

                                    return (
                                        <li key={video.id}>
                                            <Link href={`/war-videos/${video.id}`} className={profileCollectionRowClass}>
                                                <span className={profileCollectionThumbnailClass} aria-hidden="true">
                                                    {youtubeId && (
                                                        <Image
                                                            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                                                            alt=""
                                                            fill
                                                            unoptimized
                                                            className="object-cover opacity-85 transition-opacity group-hover:opacity-100"
                                                        />
                                                    )}
                                                    <span className="relative grid size-7 place-items-center rounded-full bg-slate-950/80 text-white">
                                                        <Play className="ml-0.5 size-3.5 fill-current" />
                                                    </span>
                                                </span>
                                                <div className="min-w-0 space-y-0.5">
                                                    <h3 className={profileCollectionTitleClass}>{war?.alliance.name ?? "War recording"}</h3>
                                                    {matchup && (
                                                        <p className="break-words text-xs leading-snug text-slate-300" title={fullMatchup}>
                                                            <span aria-hidden="true">{matchup}</span>
                                                            <span className="sr-only">{fullMatchup}</span>
                                                        </p>
                                                    )}
                                                    <p className="break-words text-[11px] leading-snug text-slate-400 sm:text-xs">
                                                        {videoDetails} · <time dateTime={video.createdAt.toISOString()}>{video.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>
                                                    </p>
                                                </div>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    {questPlans.length > 0 && (
                        <section aria-labelledby="shared-quest-plans" className="min-w-0">
                            <PlayerProfileSectionHeading title="Quest plans" id="shared-quest-plans" detail={questPlans.length > 4 ? "4 of " + questPlans.length : undefined} />
                            <ul className="divide-y divide-slate-800/90">
                                {questPlans.slice(0, 4).map(plan => {
                                    const quest = plan.questPlan;
                                    const fightCount = quest.encounters.length;
                                    const picked = plan.encounters.length;
                                    const isCompleted = fightCount > 0 && picked >= fightCount;
                                    const minStars = quest.minStarLevel;
                                    const maxStars = quest.maxStarLevel;
                                    const stars = minStars && maxStars ? `${minStars}–${maxStars}★` :
                                        minStars ? `${minStars}★+` : maxStars ? `Up to ${maxStars}★` : null;
                                    const details = [
                                        fightCount + (fightCount === 1 ? " fight" : " fights"),
                                        quest.teamLimit === null ? "Swap" : "Team of " + quest.teamLimit,
                                        stars,
                                    ].filter(Boolean).join(" · ");

                                    return (
                                        <li key={plan.id}>
                                            <Link href={`/player/${id}/quests/${quest.id}`} className={profileCollectionRowClass}>
                                                <span className={profileCollectionThumbnailClass} aria-hidden="true">
                                                    {quest.bannerUrl ? (
                                                        <Image
                                                            src={quest.bannerUrl.replace(/#/g, "%23")}
                                                            alt=""
                                                            fill
                                                            sizes="(min-width: 640px) 96px, 78px"
                                                            className={cn(
                                                                quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                                                                quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                                            )}
                                                        />
                                                    ) : <MapIcon className="size-5" />}
                                                </span>
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                        <div className="min-w-0 space-y-0.5">
                                                            <h3 className={profileCollectionTitleClass}>{quest.title}</h3>
                                                            {quest.category && <p className="break-words text-xs leading-snug text-slate-400">{quest.category.name}</p>}
                                                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-snug text-slate-400 sm:text-xs">
                                                                <span>{details}</span>
                                                                {quest.requiredClasses?.map(cls => (
                                                                    <Image key={cls} src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} width={12} height={12} title={cls} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {picked > 0 && (
                                                            <span className={cn("shrink-0 whitespace-nowrap text-xs font-medium tabular-nums", isCompleted ? "text-emerald-300" : "text-cyan-200")}>
                                                                {isCompleted ? "Completed" : `${picked} / ${fightCount} picked`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="size-3.5 shrink-0 text-slate-500 group-hover:text-cyan-200" aria-hidden="true" />
                                                </div>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

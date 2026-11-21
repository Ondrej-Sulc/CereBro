import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getRoster, type RosterWithChampion } from "@cerebro/core/services/rosterService";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import type { ChampionClass } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { PrestigeHistoryChart } from "./prestige-chart";
import { ArrowUpRight, ChevronDown, Globe, Heart, LayoutGrid, MapPin, Star, TrendingUp, Upload } from "lucide-react";
import logger from "@/lib/logger";

import { ProfileManager } from "./components/profile-manager";
import { RelicPrestigeEditor } from "./components/relic-prestige-editor";
import { ManageSubscriptionButton } from "./components/manage-subscription-button";
import { isPlayerSupporter } from "@/lib/support-status";
import { cn } from "@/lib/utils";
import { PlayerProfileMetric, PlayerProfileSectionHeading, profileActionClass, profilePrimaryActionClass } from "@/components/player-profile-ui";

export const metadata: Metadata = {
  title: "My Profile - CereBro",
  description:
    "View your active profile, prestige history, and roster summary in one place.",
};

const CLASS_ICONS: Record<Exclude<ChampionClass, 'SUPERIOR'>, string> = {
    SCIENCE: "/assets/icons/Science.png",
    SKILL: "/assets/icons/Skill.png",
    MYSTIC: "/assets/icons/Mystic.png",
    COSMIC: "/assets/icons/Cosmic.png",
    TECH: "/assets/icons/Tech.png",
    MUTANT: "/assets/icons/Mutant.png",
};
const CLASS_ORDER = ["SCIENCE", "SKILL", "MUTANT", "TECH", "COSMIC", "MYSTIC"] as const;

export default async function ProfilePage() {
    const player = await getUserPlayerWithAlliance();

    if (!player) {
        redirect("/api/auth/discord-login?redirectTo=/profile");
    }

    logger.info({ userId: player.id }, "User accessing Profile page");

    const [rosterResult, prestigeHistory, allProfiles, supporterDonation, supporter] = await Promise.all([
        getRoster(player.id, null, null, null),
        prisma.prestigeLog.findMany({
            where: { playerId: player.id },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true, championPrestige: true, summonerPrestige: true, relicPrestige: true },
        }),
        prisma.player.findMany({
            where: { discordId: player.discordId },
            include: { 
                alliance: true,
                roster: {
                    select: { updatedAt: true },
                    orderBy: { updatedAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { ingameName: 'asc' }
        }),
        prisma.supportDonation.findFirst({
            where: {
                discordId: player.discordId,
                stripeCustomerId: { not: null },
            },
            select: { stripeCustomerId: true, stripeSubscriptionId: true },
            orderBy: { createdAt: "desc" },
        }),
        isPlayerSupporter(player),
    ]);

    const roster = typeof rosterResult === "string" ? [] : rosterResult;

    // Roster Analysis
    const byStar = roster.reduce((acc, entry) => {
        if (!acc[entry.stars]) acc[entry.stars] = [];
        acc[entry.stars].push(entry);
        return acc;
    }, {} as Record<number, RosterWithChampion[]>);

    const starLevels = Object.keys(byStar)
        .map(Number)
        .sort((a, b) => b - a);
    const latestSnapshot = prestigeHistory.at(-1);

    return (
        <div className="mx-auto max-w-[1240px] space-y-6 px-4 pb-12 pt-5 sm:space-y-8 sm:px-6 sm:pt-7 lg:px-8">
            <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
                    <Avatar className="size-12 shrink-0 rounded-xl border border-indigo-300/25 bg-indigo-400/10 text-indigo-100 sm:size-14 sm:rounded-2xl">
                        <AvatarImage src={player.avatar || undefined} alt="" />
                        <AvatarFallback className="rounded-xl bg-indigo-400/15 font-semibold sm:rounded-2xl sm:text-lg">{player.ingameName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200">My profile</p>
                            {player.isActive && <span className="text-xs font-medium text-emerald-200">Active</span>}
                        </div>
                        <h1 className="mt-0.5 break-words text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:text-4xl">{player.ingameName}</h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            {player.alliance ? (
                                <Link href={"/alliance/" + player.alliance.id} className="inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-indigo-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                                    <MapPin className="size-3 shrink-0" aria-hidden="true" /> <span className="break-words">{player.alliance.name}</span>
                                </Link>
                            ) : <span>No alliance</span>}
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Globe className="size-3 shrink-0" aria-hidden="true" /> <span className="break-words">{player.timezone || "Timezone not set"}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link href="/profile/update" className={profilePrimaryActionClass}><Upload className="size-4" aria-hidden="true" /> Update roster</Link>
                    <Link href={"/player/" + player.id} className={profileActionClass}>Public profile <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
                </div>
            </header>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.46fr)] lg:gap-7">
                <section aria-labelledby="profile-prestige-heading" className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45 lg:col-start-1 lg:row-start-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3.5 sm:px-5 sm:py-4">
                        <div className="flex items-center gap-2.5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-indigo-400/20 bg-indigo-400/10 text-indigo-200"><TrendingUp className="size-4" aria-hidden="true" /></span>
                            <div>
                                <h2 id="profile-prestige-heading" className="text-base font-semibold text-white sm:text-lg">Prestige</h2>
                                <p className="mt-0.5 text-xs text-slate-400">Current values and history</p>
                            </div>
                        </div>
                        {latestSnapshot && (
                            <p className="text-xs text-slate-400">Last recorded{" "}
                                <time dateTime={latestSnapshot.createdAt.toISOString()} className="font-medium text-slate-200">
                                    {latestSnapshot.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                                </time>
                            </p>
                        )}
                    </div>
                    <dl className="grid grid-cols-3 gap-px border-y border-slate-800 bg-slate-800/75">
                        <PlayerProfileMetric label="Summoner prestige" value={player.summonerPrestige?.toLocaleString("en-US") ?? "—"} />
                        <PlayerProfileMetric label="Champion prestige" value={player.championPrestige?.toLocaleString("en-US") ?? "—"} />
                        <RelicPrestigeEditor key={player.id} profileId={player.id} initialValue={player.relicPrestige} automatic={player.relicPrestigeFromInventory} />
                    </dl>
                    {prestigeHistory.length >= 3 ? (
                        <PrestigeHistoryChart data={prestigeHistory} embedded className="border-0 bg-transparent shadow-none" />
                    ) : (
                        <div className="px-4 py-5 sm:px-5">
                            <p className="text-sm font-medium text-slate-200">Prestige history needs at least three recorded updates.</p>
                            <p className="mt-1 text-xs text-slate-400">Sync your roster to record your progress.</p>
                        </div>
                    )}
                </section>

                <section aria-labelledby="profile-roster-breakdown" className="min-w-0 lg:col-start-1 lg:row-start-2">
                    <PlayerProfileSectionHeading
                        title="Roster breakdown"
                        detail={roster.length ? roster.length.toLocaleString("en-US") + " builds" : undefined}
                        id="profile-roster-breakdown"
                        action={<Link href="/profile/roster" className={cn(profileActionClass, "min-h-9 px-2.5 text-xs sm:min-h-10 sm:px-3.5 sm:text-sm")}><LayoutGrid className="size-4" aria-hidden="true" /> Full roster</Link>}
                    />

                    {roster.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-5">
                            <p className="text-sm text-slate-300">Your roster is empty. Upload screenshots to add your champions.</p>
                            <Link href="/profile/update" className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-indigo-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                                Upload screenshots <ArrowUpRight className="size-3.5" aria-hidden="true" />
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {starLevels.map(stars => {
                                const champions = byStar[stars].filter(entry => entry.champion.class !== "SUPERIOR");
                                const countsByRank = new Map<number, Map<ChampionClass, number>>();
                                const classTotals = new Map<ChampionClass, number>();
                                for (const { rank, champion } of champions) {
                                    const counts = countsByRank.get(rank) ?? new Map<ChampionClass, number>();
                                    counts.set(champion.class, (counts.get(champion.class) ?? 0) + 1);
                                    countsByRank.set(rank, counts);
                                    classTotals.set(champion.class, (classTotals.get(champion.class) ?? 0) + 1);
                                }

                                return (
                                    <details key={stars} open={stars === starLevels[0]} className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
                                        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 sm:px-4 [&::-webkit-details-marker]:hidden">
                                            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-200"><Star className="size-4" aria-hidden="true" /></span>
                                            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-100">{stars}-star champions</span>
                                            <span className="shrink-0 text-xs tabular-nums text-slate-400">{champions.length.toLocaleString("en-US")}</span>
                                            <ChevronDown className="size-4 shrink-0 text-slate-400 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
                                        </summary>
                                        <table aria-label={stars + "-star champions by rank and class"} className="w-full table-fixed border-t border-slate-800 text-center text-xs tabular-nums sm:text-sm">
                                            <thead className="bg-slate-950/45 text-slate-400">
                                                <tr>
                                                    <th scope="col" className="px-1 py-2.5 font-medium">Rank</th>
                                                    {CLASS_ORDER.map(cls => (
                                                        <th key={cls} scope="col" className="px-1 py-2.5">
                                                            <Image src={CLASS_ICONS[cls]} alt={cls.toLowerCase()} title={cls.toLowerCase()} width={18} height={18} className="mx-auto size-4 sm:size-[18px]" />
                                                        </th>
                                                    ))}
                                                    <th scope="col" className="px-1 py-2.5 font-medium">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/75">
                                                {[...countsByRank.entries()].sort(([a], [b]) => b - a).map(([rank, counts]) => (
                                                    <tr key={rank}>
                                                        <th scope="row" className="py-2.5 font-medium text-slate-300">R{rank}</th>
                                                        {CLASS_ORDER.map(cls => (
                                                            <td key={cls} className={counts.has(cls) ? getChampionClassColors(cls).text : "text-slate-600"}>{counts.get(cls) ?? "—"}</td>
                                                        ))}
                                                        <td className="font-semibold text-slate-200">{[...counts.values()].reduce((total, count) => total + count, 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="border-t border-slate-800 bg-slate-950/35 font-semibold">
                                                <tr>
                                                    <th scope="row" className="py-2.5 font-medium text-slate-400">Total</th>
                                                    {CLASS_ORDER.map(cls => (
                                                        <td key={cls} className={classTotals.has(cls) ? getChampionClassColors(cls).text : "text-slate-600"}>{classTotals.get(cls) ?? "—"}</td>
                                                    ))}
                                                    <td className="text-slate-100">{champions.length}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </details>
                                );
                            })}
                        </div>
                    )}
                </section>

                <aside aria-label="Profile management and support" className="min-w-0 space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <ProfileManager profiles={allProfiles} activeProfileId={player.id} />

                    {supporter && (
                        <section aria-labelledby="profile-supporter" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                            <div className="flex items-start gap-3">
                                <Heart className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
                                <div>
                                    <h2 id="profile-supporter" className="text-sm font-semibold text-amber-100">CereBro supporter</h2>
                                    <p className="mt-0.5 text-xs text-slate-400">{supporterDonation?.stripeSubscriptionId ? "Thank you for supporting CereBro every month." : "Thank you for your contribution."}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {supporterDonation?.stripeSubscriptionId && <ManageSubscriptionButton />}
                                <Button asChild variant="ghost" className="text-amber-200 hover:bg-amber-400/10 hover:text-amber-100"><Link href="/support">Support again</Link></Button>
                            </div>
                        </section>
                    )}
                </aside>
            </div>
        </div>
    );
}

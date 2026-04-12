import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { RosterView } from "@/app/profile/roster/roster-view";
import { Button } from "@/components/ui/button";
import { ChampionImages } from "@/types/champion";
import { ProfileRosterEntry } from "@/app/profile/roster/types";
import { UploadSection } from "./upload-section";
import { cache } from "react";

interface PlayerRosterPageProps {
    params: Promise<{ id: string }>;
}

const getTargetPlayer = cache(async (id: string) => {
    return prisma.player.findUnique({
        where: { id },
        include: { alliance: true },
    });
});

export async function generateMetadata({ params }: PlayerRosterPageProps): Promise<Metadata> {
    const { id } = await params;
    const player = await getTargetPlayer(id);
    if (!player) return { title: "Roster - CereBro" };
    return {
        title: `${player.ingameName}'s Roster - CereBro`,
        description: `View ${player.ingameName}'s full champion roster.`,
    };
}

export default async function PlayerRosterPage({ params }: PlayerRosterPageProps) {
    const { id } = await params;

    const [targetPlayer, currentUser] = await Promise.all([
        getTargetPlayer(id),
        getUserPlayerWithAlliance(),
    ]);

    if (!targetPlayer) notFound();

    const isOfficerSameAlliance =
        currentUser?.isOfficer === true &&
        currentUser.allianceId !== null &&
        currentUser.allianceId === targetPlayer.allianceId;

    const canEdit =
        currentUser?.id === targetPlayer.id ||
        currentUser?.isBotAdmin === true ||
        isOfficerSameAlliance;

    // targetPlayerId is only set when viewing someone else's roster (for edit API calls)
    const targetPlayerId = currentUser?.id !== targetPlayer.id ? targetPlayer.id : undefined;

    const [rosterEntries, allChampions, tags, abilityCategories, abilityLinks, immunityLinks] = await Promise.all([
        prisma.roster.findMany({
            where: { playerId: targetPlayer.id },
            include: {
                champion: {
                    include: {
                        tags: { select: { id: true, name: true } },
                        abilities: {
                            include: {
                                ability: {
                                    select: {
                                        name: true,
                                        categories: { select: { name: true } },
                                    },
                                },
                                synergyChampions: {
                                    include: { champion: { select: { name: true, images: true } } },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: [{ stars: "desc" }, { rank: "desc" }],
        }),
        getCachedChampions(),
        prisma.tag.findMany({ orderBy: { name: "asc" } }),
        prisma.abilityCategory.findMany({ orderBy: { name: "asc" } }),
        prisma.championAbilityLink.findMany({ where: { type: "ABILITY" }, select: { abilityId: true }, distinct: ["abilityId"] }),
        prisma.championAbilityLink.findMany({ where: { type: "IMMUNITY" }, select: { abilityId: true }, distinct: ["abilityId"] }),
    ]);

    const abilities = await prisma.ability.findMany({ where: { id: { in: abilityLinks.map(l => l.abilityId) } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const immunities = await prisma.ability.findMany({ where: { id: { in: immunityLinks.map(l => l.abilityId) } }, select: { id: true, name: true }, orderBy: { name: "asc" } });

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
                        images: synergy.champion.images as unknown as ChampionImages,
                    },
                })),
            })),
        },
    }));

    const reqHeaders = await headers();
    const host = reqHeaders.get("host") ?? "localhost:3000";
    const protocol = reqHeaders.get("x-forwarded-proto") ?? "http";
    const shareUrl = `${protocol}://${host}/player/${targetPlayer.id}/roster`;

    // Determine default target rank for RosterView (prestige insights are hidden for other players)
    const highest7StarRank = typedRosterEntries.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
    const effectiveTargetRank = highest7StarRank > 0 ? highest7StarRank : 3;

    return (
        <div className="container mx-auto p-4 sm:p-8 space-y-6">
            {/* Back navigation */}
            <div className="flex items-center gap-3">
                <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-slate-400 hover:text-slate-200 -ml-2">
                    <Link href={`/player/${targetPlayer.id}`}>
                        <ArrowLeft className="w-4 h-4" />
                        Back to Profile
                    </Link>
                </Button>
            </div>

            {/* Officer/admin upload section */}
            {canEdit && targetPlayerId && (
                <UploadSection targetPlayerId={targetPlayerId} playerName={targetPlayer.ingameName} />
            )}

            <RosterView
                key={targetPlayer.id}
                initialRoster={typedRosterEntries}
                allChampions={allChampions}
                player={targetPlayer}
                profiles={[]}
                top30Average={targetPlayer.championPrestige ?? 0}
                prestigeMap={{}}
                simulationTargetRank={effectiveTargetRank}
                initialRankClassFilter={[]}
                initialSigClassFilter={[]}
                initialRankSagaFilter={false}
                initialSigSagaFilter={false}
                initialSigAwakenedOnly={false}
                initialTags={tags}
                initialAbilityCategories={abilityCategories}
                initialAbilities={abilities}
                initialImmunities={immunities}
                initialLimit={5}
                canEdit={canEdit}
                targetPlayerId={targetPlayerId}
                shareUrl={shareUrl}
            />
        </div>
    );
}


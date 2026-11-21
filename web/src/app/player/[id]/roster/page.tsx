import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCachedAllChampions } from "@/lib/data/champions";
import { attachResistances, getResistanceIndex } from "@/lib/data/champion-resistances";
import { rosterKitOptions } from "@/lib/roster-kit-options";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { RosterView } from "@/app/profile/roster/roster-view";
import { ChampionImages } from "@/types/champion";
import { PrestigeInsightTab, ProfileRosterEntry } from "@/app/profile/roster/types";
import { UploadSection } from "./upload-section";
import { loadRosterPrestigeInsightSnapshot } from "@/lib/roster-recommendation-service";
import { normalizeGlobalPrestigeListOptions } from "@/lib/global-prestige-list";
import { cache } from "react";
import { getRosterScreenshotQuota } from "@cerebro/core/services/rosterScreenshotQuotaService";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { withChampionAscensionEligibility, withChampionAscensionLimits } from "@/lib/champion-ascension-payload";
import { normalizeRosterAscensionState } from "@cerebro/core/domain/roster-ascension-state";

interface PlayerRosterPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{
        insights?: string;
        insightsTab?: string;
        globalRarity?: string;
        globalRank?: string;
        globalSig?: string;
        globalAscension?: string;
        globalClassFilter?: string;
        globalOwnership?: string;
        globalSaga?: string;
        globalSearch?: string;
        globalLimit?: string;
    }>;
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
    if (!player) return { title: "Champions - CereBro" };
    return {
        title: `${player.ingameName}'s Champions - CereBro`,
        description: `View ${player.ingameName}'s champions.`,
    };
}

export default async function PlayerRosterPage({ params, searchParams }: PlayerRosterPageProps) {
    const { id } = await params;
    const resolvedSearchParams = await searchParams;

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
    const canManageAttackReservations =
        currentUser?.id === targetPlayer.id ||
        currentUser?.isBotAdmin === true ||
        (
            currentUser !== null &&
            currentUser.allianceId !== null &&
            currentUser.allianceId === targetPlayer.allianceId &&
            canPlanAllianceWar(currentUser, currentUser.isBotAdmin)
        );

    // targetPlayerId is only set when viewing someone else's roster (for edit API calls)
    const targetPlayerId = currentUser?.id !== targetPlayer.id ? targetPlayer.id : undefined;

    const [rosterEntries, allChampions, tags, abilityCategories] = await Promise.all([
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
                                        iconUrl: true,
                                        gameGlossaryTermId: true,
                                        description: true,
                                        gameGlossaryTerm: { select: { raw: true } },
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
        getCachedAllChampions(),
        prisma.tag.findMany({ orderBy: { name: "asc" } }),
        prisma.abilityCategory.findMany({ orderBy: { name: "asc" } }),
    ]);

    const { abilities, immunities } = rosterKitOptions(allChampions.flatMap(champion => champion.abilities ?? []));
    const resistanceIndex = await getResistanceIndex();

    const typedRosterEntries: ProfileRosterEntry[] = rosterEntries.map(entry => ({
        ...entry,
        ...normalizeRosterAscensionState(entry),
        reservedForAttack: canManageAttackReservations ? entry.reservedForAttack : false,
        champion: {
            ...withChampionAscensionEligibility(withChampionAscensionLimits(entry.champion)),
            images: entry.champion.images as unknown as ChampionImages,
            abilities: attachResistances(entry.champion.abilities, resistanceIndex).map(link => ({
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

    // Calculate prestige map and top 30 average on the server to ensure correct sorting by default
    const {
        options: insightOptions,
        insights: { prestigeMap, top30Average, top30Cutoff },
    } = await loadRosterPrestigeInsightSnapshot(typedRosterEntries, {});
    const initialGlobalPrestigeOptions = normalizeGlobalPrestigeListOptions(resolvedSearchParams, {
        targetRank: insightOptions.targetRank,
    });
    const showInsights = resolvedSearchParams.insights === "true";
    const initialInsightTab = normalizePrestigeInsightTab(resolvedSearchParams.insightsTab);

    const quota = currentUser
        ? await getRosterScreenshotQuota(
            {
                playerId: currentUser.id,
                botUserId: currentUser.botUserId,
                discordId: currentUser.discordId,
                allianceId: currentUser.allianceId,
            },
            0,
            { prisma }
        )
        : null;

    return (
        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7 lg:px-8">
            <RosterView
                key={targetPlayer.id}
                initialRoster={typedRosterEntries}
                allChampions={allChampions.map(withChampionAscensionLimits)}
                player={targetPlayer}
                profiles={[]}
                top30Average={top30Average}
                top30Cutoff={top30Cutoff}
                prestigeMap={prestigeMap}
                simulationTargetRank={insightOptions.targetRank}
                initialRankClassFilter={insightOptions.rankClassFilter}
                initialSigClassFilter={insightOptions.sigClassFilter}
                initialRankSagaFilter={insightOptions.rankSagaFilter}
                initialSigSagaFilter={insightOptions.sigSagaFilter}
                initialSigAwakenedOnly={insightOptions.sigAwakenedOnly ?? false}
                initialTags={tags}
                initialAbilityCategories={abilityCategories}
                initialAbilities={abilities}
                initialImmunities={immunities}
                initialLimit={insightOptions.limit ?? 5}
                initialShowInsights={showInsights}
                initialInsightTab={initialInsightTab}
                initialGlobalPrestigeOptions={initialGlobalPrestigeOptions}
                canEdit={canEdit}
                targetPlayerId={targetPlayerId}
                shareUrl={shareUrl}
                canManageAttackReservations={canManageAttackReservations}
                profileTools={canEdit && targetPlayerId && (
                    <UploadSection
                        targetPlayerId={targetPlayerId}
                        playerName={targetPlayer.ingameName}
                        quota={quota ? {
                            limit: quota.limit,
                            used: quota.used,
                            remaining: quota.remaining,
                            resetAt: quota.resetAt,
                            supportUrl: quota.supportUrl,
                            unlimitedReason: quota.unlimitedReason,
                        } : null}
                    />
                )}
            />
        </div>
    );
}

function normalizePrestigeInsightTab(value: string | undefined): PrestigeInsightTab {
    if (value === "rank" || value === "sig" || value === "global") return value;
    return "potential";
}

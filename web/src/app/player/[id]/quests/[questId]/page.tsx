import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlanForViewing } from "@/app/actions/quests";
import { ReadOnlyPlanShell } from "@/components/planning/read-only-plan-shell";
import { QuestPlanStatus } from "@prisma/client";
import { cache } from "react";

interface PlayerQuestViewPageProps {
    params: Promise<{ id: string; questId: string }>;
}

const getPlayerQuestPlan = cache(async (playerId: string, questId: string) => {
    const playerQuestPlan = await prisma.playerQuestPlan.findFirst({
        where: {
            playerId,
            questPlanId: questId,
            questPlan: { status: QuestPlanStatus.VISIBLE }
        },
        select: { id: true }
    });

    if (!playerQuestPlan) {
        return null;
    }

    return getPlayerQuestPlanForViewing(playerQuestPlan.id);
});

export async function generateMetadata({ params }: PlayerQuestViewPageProps): Promise<Metadata> {
    const { id: playerId, questId } = await params;
    const plan = await getPlayerQuestPlan(playerId, questId);

    if (!plan) {
        return {
            title: "Player Quest Plan - CereBro",
            description:
                "View this player's read-only quest plan and selected counters for each encounter.",
        };
    }

    return {
        title: `${plan.player.ingameName}'s ${plan.questPlan.title} Plan - CereBro`,
        description: `View ${plan.player.ingameName}'s read-only plan for ${plan.questPlan.title}, including selected counters for each encounter.`,
    };
}

export default async function PlayerQuestViewPage({ params }: PlayerQuestViewPageProps) {
    const { id: playerId, questId } = await params;

    const plan = await getPlayerQuestPlan(playerId, questId);
    if (!plan) notFound();

    return (
        <ReadOnlyPlanShell
            plan={plan}
            quest={plan.questPlan}
            player={plan.player}
            backLinkHref={`/player/${playerId}`}
            backLinkText={`Back to ${plan.player.ingameName}'s Profile`}
            subtitle="View-only"
            attributionHref={`/player/${playerId}`}
        />
    );
}

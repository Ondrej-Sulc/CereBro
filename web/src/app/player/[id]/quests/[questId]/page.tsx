import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlanForViewing } from "@/app/actions/quests";
import { ReadOnlyPlanShell } from "@/components/planning/read-only-plan-shell";
import { QuestPlanStatus } from "@prisma/client";

interface PlayerQuestViewPageProps {
    params: Promise<{ id: string; questId: string }>;
}

export default async function PlayerQuestViewPage({ params }: PlayerQuestViewPageProps) {
    const { id: playerId, questId } = await params;

    // Find the player's plan for this quest
    const playerQuestPlan = await prisma.playerQuestPlan.findFirst({
        where: {
            playerId,
            questPlanId: questId,
            questPlan: { status: QuestPlanStatus.VISIBLE }
        },
        select: { id: true }
    });

    if (!playerQuestPlan) notFound();

    const plan = await getPlayerQuestPlanForViewing(playerQuestPlan.id);
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

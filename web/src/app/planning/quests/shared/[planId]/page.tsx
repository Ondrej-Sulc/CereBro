import { notFound } from "next/navigation";
import { getPlayerQuestPlanForViewing } from "@/app/actions/quests";
import { ReadOnlyPlanShell } from "@/components/planning/read-only-plan-shell";

interface SharedPlanPageProps {
    params: Promise<{ planId: string }>;
}

export default async function SharedPlanPage({ params }: SharedPlanPageProps) {
    const { planId } = await params;

    const plan = await getPlayerQuestPlanForViewing(planId);
    if (!plan) notFound();

    return (
        <ReadOnlyPlanShell
            plan={plan}
            quest={plan.questPlan}
            player={plan.player}
            backLinkHref="/planning/quests"
            backLinkText="Back to Quest Planner"
            subtitle="Shared Quest Plan"
        />
    );
}

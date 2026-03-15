import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerQuestPlanForViewing } from "@/app/actions/quests";
import { ReadOnlyPlanShell } from "@/components/planning/read-only-plan-shell";
import { cache } from "react";

interface SharedPlanPageProps {
    params: Promise<{ planId: string }>;
}

const getSharedPlan = cache(async (planId: string) => getPlayerQuestPlanForViewing(planId));

export async function generateMetadata({ params }: SharedPlanPageProps): Promise<Metadata> {
    const { planId } = await params;
    const plan = await getSharedPlan(planId);

    if (!plan) {
        return {
            title: "Shared Quest Plan - CereBro",
            description: "View a shared read-only quest plan with selected counters and encounter picks.",
        };
    }

    return {
        title: `${plan.questPlan.title} - Shared Quest Plan - CereBro`,
        description: `View ${plan.player.ingameName}'s shared quest plan with selected counters for each encounter.`,
    };
}

export default async function SharedPlanPage({ params }: SharedPlanPageProps) {
    const { planId } = await params;

    const plan = await getSharedPlan(planId);
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

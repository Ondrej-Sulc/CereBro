import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import QuestListClient from "@/components/planning/quest-list-client";
import { QuestWithRelations } from "@/types/quests";
import { QuestPlanStatus } from "@prisma/client";
import { getQuestPlans, getQuestCategories } from "@/app/actions/quests";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

export const metadata: Metadata = {
  title: "Quest Planner - CereBro",
  description:
    "Browse published quest plans, guides, and counters to prepare your next run.",
};

export default async function QuestsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/api/auth/discord-login?redirectTo=/planning/quests");
    }

    const player = await getUserPlayerWithAlliance();

    // Use cached action with player ID for progress tracking
    const quests = await getQuestPlans(undefined, QuestPlanStatus.VISIBLE, player?.id);
    const categories = await getQuestCategories();

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">Quest Planner</h1>
                <p className="text-lg text-slate-400 mt-2">Plan your path, pick your counters, and conquer content.</p>
            </div>
            <QuestListClient initialQuests={quests} categories={categories} />
        </div>
    );
}

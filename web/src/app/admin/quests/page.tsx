import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminQuestManagerClient from "@/components/admin/quests/admin-quest-manager-client";
import { QuestWithRelations } from "@/types/quests";
import { ensureAdmin } from "../actions";
import { getQuestPlans, getQuestCategories } from "@/app/actions/quests";

export const metadata: Metadata = {
  title: "Quest Planner Management - CereBro",
  description:
    "Create and manage standardized quest counters, categories, and guides for the alliance.",
};

export default async function AdminQuestsPage() {
    await ensureAdmin("MANAGE_QUESTS");

    const quests = await getQuestPlans();
    const categories = await getQuestCategories();

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">
                    Quest Planner Management
                </h1>
                <p className="text-slate-400">Create and manage standardized quest counters and guides for the alliance.</p>
            </div>

            <AdminQuestManagerClient initialQuests={quests} categories={categories} />
        </div>
    );
}

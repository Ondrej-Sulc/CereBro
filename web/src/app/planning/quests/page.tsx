import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import QuestListClient from "@/components/planning/quest-list-client";

export default async function QuestsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/api/auth/discord-login?redirectTo=/planning/quests");
    }

    // Fetch all quest plans
    const quests = await prisma.questPlan.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            category: true,
            creator: true,
            encounters: {
                select: { id: true } // Just need count for summary
            }
        }
    });

    const categories = await prisma.questCategory.findMany({
        orderBy: { order: 'asc' }
    });

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

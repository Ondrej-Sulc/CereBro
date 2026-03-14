import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import QuestListClient from "@/components/planning/quest-list-client";
import { QuestWithRelations } from "@/components/planning/quest-list-client";
import { QuestPlanStatus } from "@prisma/client";

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

    // Fetch quest plans - only show VISIBLE ones
    const rawQuests = await prisma.questPlan.findMany({
        where: { status: QuestPlanStatus.VISIBLE },
        orderBy: { createdAt: 'desc' },
        include: {
            category: true,
            creator: true,
            creators: {
                include: {
                    profiles: true
                }
            },
            requiredTags: true,
            encounters: {
                select: { id: true } // Just need count for summary
            }
        }
    });

    // Map creators to User data to get their names and images
    const quests = await Promise.all(rawQuests.map(async (quest) => {
        const creatorsWithUsers = await Promise.all((quest.creators || []).map(async (creator) => {
            const user = await prisma.user.findFirst({
                where: {
                    accounts: {
                        some: {
                            provider: "discord",
                            providerAccountId: creator.discordId
                        }
                    }
                }
            });

            // Find best name: User name -> Active profile -> First profile -> "Unknown"
            const profileName = creator.profiles.find(p => p.isActive)?.ingameName || 
                              creator.profiles.find(p => p.id === creator.activeProfileId)?.ingameName ||
                              creator.profiles[0]?.ingameName;

            return {
                id: creator.id,
                discordId: creator.discordId,
                name: user?.name || profileName || "Unknown",
                image: user?.image || null
            };
        }));

        return {
            ...quest,
            creators: creatorsWithUsers
        };
    }));

    const categories = await prisma.questCategory.findMany({
        orderBy: { order: 'asc' }
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">Quest Planner</h1>
                <p className="text-lg text-slate-400 mt-2">Plan your path, pick your counters, and conquer content.</p>
            </div>
            <QuestListClient initialQuests={quests as QuestWithRelations[]} categories={categories} />
        </div>
    );
}

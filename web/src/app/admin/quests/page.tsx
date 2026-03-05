import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminQuestManagerClient, { QuestWithRelations } from "@/components/admin/quests/admin-quest-manager-client";

export default async function AdminQuestsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/api/auth/discord-login?redirectTo=/admin/quests");
    }

    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: "discord",
        },
    });

    if (!account?.providerAccountId) {
        return <p>Error: No linked Discord account found.</p>;
    }

    const botUser = await prisma.botUser.findUnique({
        where: { discordId: account.providerAccountId },
    });

    if (!botUser?.isBotAdmin) {
        return <p>You must be a Bot Admin to access this page.</p>;
    }

        const quests = await prisma.questPlan.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                category: true,
                creator: true,
                creators: true,
                requiredTags: true,
                encounters: {
                    select: { id: true }
                }
            }
        });
    
        // Enrich creators with user data
        const enrichedQuests = await Promise.all(quests.map(async (quest) => {
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
                return {
                    ...creator,
                    name: user?.name || "Unknown Creator",
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
            <div className="space-y-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">
                        Quest Planner Management
                    </h1>
                    <p className="text-slate-400">Create and manage standardized quest counters and guides for the alliance.</p>
                </div>
    
                <AdminQuestManagerClient initialQuests={enrichedQuests as QuestWithRelations[]} categories={categories} />
            </div>
        );}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getQuestPlanById } from "@/app/actions/quests";
import AdminQuestBuilderClient from "@/components/admin/quests/admin-quest-builder-client";
import { Champion } from "@/types/champion";

export default async function AdminQuestBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/api/auth/discord-login?redirectTo=/admin/quests");
    }

    const { id } = await params;

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

    const quest = await getQuestPlanById(id);
    if (!quest) {
        return <p>Quest Plan not found.</p>;
    }

    // Map creators to User data to get their names
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
            name: user?.name || "Unknown Creator"
        };
    }));

    const enrichedQuest = {
        ...quest,
        creators: creatorsWithUsers
    };

    const categories = await prisma.questCategory.findMany({ orderBy: { order: 'asc' } });
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
    const champions = await prisma.champion.findMany({ orderBy: { name: 'asc' } });
    const nodeModifiers = await prisma.nodeModifier.findMany({ orderBy: { name: 'asc' } });

    return (
        <div className="space-y-6">
            <AdminQuestBuilderClient
                initialQuest={enrichedQuest as any}
                categories={categories}
                tags={tags}
                champions={champions as unknown as Champion[]}
                nodeModifiers={nodeModifiers}
            />
        </div>
    );
}

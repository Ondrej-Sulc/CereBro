import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminQuestManagerClient from "@/components/admin/quests/admin-quest-manager-client";

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
            creator: true
        }
    });

    const categories = await prisma.questCategory.findMany({
        orderBy: { order: 'asc' }
    });

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Quest Planner Management</h1>
            <AdminQuestManagerClient initialQuests={quests} categories={categories} />
        </div>
    );
}

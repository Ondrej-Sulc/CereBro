import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getQuestPlanById } from "@/app/actions/quests";
import QuestTimelineClient from "@/components/planning/quest-timeline-client";

export default async function QuestTimelinePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/api/auth/discord-login?redirectTo=/planning/quests");
    }

    const { id } = await params;

    // We need the Player ID, which means looking up the account
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" }
    });

    if (!account?.providerAccountId) {
        return <p>Error: No linked Discord account found.</p>;
    }

    // Find the primary Player profile for this BotUser
    const botUser = await prisma.botUser.findUnique({
        where: { discordId: account.providerAccountId },
        include: {
            profiles: {
                where: { isActive: true }
            }
        }
    });

    const activePlayer = botUser?.profiles[0];
    if (!activePlayer) {
        return <p>Please create a player profile first.</p>;
    }

    // Fetch the Quest
    const quest = await getQuestPlanById(id);
    if (!quest) return <p>Quest not found</p>;

    // Fetch the user's saved plan for this quest
    const playerPlan = await prisma.playerQuestPlan.findUnique({
        where: {
            playerId_questPlanId: {
                playerId: activePlayer.id,
                questPlanId: id
            }
        },
        include: {
            encounters: true
        }
    });

    // Fetch the user's roster to pass to the client for counter selection
    const roster = await prisma.roster.findMany({
        where: { playerId: activePlayer.id },
        include: {
            champion: {
                include: { tags: true }
            }
        },
        orderBy: [
            { stars: 'desc' },
            { rank: 'desc' },
            { powerRating: 'desc' },
            { champion: { name: 'asc' } }
        ]
    });

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">{quest.title}</h1>
                {quest.category && <p className="text-slate-400 mt-2">{quest.category.name}</p>}
            </div>

            {/* We cast here because Prisma's nested includes get complex, but we know the shape matches what the client needs */}
            <QuestTimelineClient
                quest={quest as any}
                roster={roster as any}
                savedEncounters={playerPlan?.encounters || []}
            />
        </div>
    );
}

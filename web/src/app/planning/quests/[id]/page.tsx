import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getQuestPlanById } from "@/app/actions/quests";
import QuestTimelineClient from "@/components/planning/quest-timeline-client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3 } from "lucide-react";
import { QuestPlanStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Champion } from "@/types/champion";

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

    // Visibility check
    const isAdmin = botUser?.isBotAdmin || false;
    if (quest.status !== QuestPlanStatus.VISIBLE && !isAdmin) {
        return <div className="p-8 text-center text-slate-400 italic">This quest plan is currently hidden or archived.</div>;
    }

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
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
                        {quest.bannerUrl && (
                            <div className="relative w-full aspect-[21/9] md:aspect-[25/7] mb-8 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
                                <Image 
                                    src={quest.bannerUrl} 
                                    alt={quest.title} 
                                    fill 
                                    priority
                                    className={cn(
                                        quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                                        quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                    )} 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />                    <div className="absolute bottom-6 left-8 right-8">
                        <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl uppercase tracking-tight">{quest.title}</h1>
                        {quest.category && (
                            <Badge className="mt-2 bg-sky-600 text-white border-none text-xs font-bold uppercase tracking-widest px-3 py-1">
                                {quest.category.name}
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {!quest.bannerUrl && (
                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">{quest.title}</h1>
                        {quest.category && <p className="text-slate-400 mt-2">{quest.category.name}</p>}
                    </div>
                    {isAdmin && botUser?.isBotAdmin && (
                        <Link href={`/admin/quests/${quest.id}`}>
                            <Button variant="outline" className="shrink-0 border-sky-800 text-sky-400 hover:bg-sky-950/50 hover:text-sky-300">
                                <Edit3 className="w-4 h-4 mr-2" /> Edit Plan
                            </Button>
                        </Link>
                    )}
                </div>
            )}

            {quest.bannerUrl && isAdmin && botUser?.isBotAdmin && (
                <div className="fixed bottom-8 right-8 z-50">
                    <Link href={`/admin/quests/${quest.id}`}>
                        <Button className="bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/40 rounded-full h-12 px-6">
                            <Edit3 className="w-4 h-4 mr-2" /> Edit Plan
                        </Button>
                    </Link>
                </div>
            )}

            {/* We cast here because Prisma's nested includes get complex, but we know the shape matches what the client needs */}
            <QuestTimelineClient
                quest={quest as any}
                roster={roster as unknown as any[]}
                savedEncounters={playerPlan?.encounters || []}
            />
        </div>
    );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlanForViewing } from "@/app/actions/quests";
import QuestTimelineClient from "@/components/planning/quest-timeline-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { QuestPlanStatus } from "@prisma/client";

interface PlayerQuestViewPageProps {
    params: Promise<{ id: string; questId: string }>;
}

export default async function PlayerQuestViewPage({ params }: PlayerQuestViewPageProps) {
    const { id: playerId, questId } = await params;

    // Find the player's plan for this quest
    const playerQuestPlan = await prisma.playerQuestPlan.findFirst({
        where: {
            playerId,
            questPlanId: questId,
            questPlan: { status: QuestPlanStatus.VISIBLE }
        },
        select: { id: true }
    });

    if (!playerQuestPlan) notFound();

    const plan = await getPlayerQuestPlanForViewing(playerQuestPlan.id);
    if (!plan) notFound();

    const quest = plan.questPlan;
    const player = plan.player;

    // Build selections map: encounterId -> championId
    const selections: Record<string, number | null> = {};
    for (const encounter of plan.encounters) {
        selections[encounter.questEncounterId] = encounter.selectedChampionId;
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <Link href={`/player/${playerId}`} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4">
                    <ChevronLeft className="w-3.5 h-3.5" /> Back to {player.ingameName}&apos;s Profile
                </Link>

                {/* Quest Banner */}
                {quest.bannerUrl && (
                    <div className="relative rounded-xl overflow-hidden h-48 md:h-64 mb-6 border border-slate-800">
                        <Image
                            src={quest.bannerUrl}
                            alt={quest.title}
                            fill
                            className="object-cover"
                            style={{
                                objectFit: (quest.bannerFit as "cover" | "contain") || "cover",
                                objectPosition: quest.bannerPosition || "center"
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
                            {quest.category && (
                                <Badge variant="outline" className="bg-sky-950/60 border-sky-800/50 text-sky-300 text-[10px] uppercase font-bold tracking-wider mb-2">
                                    {quest.category.name}
                                </Badge>
                            )}
                            <h1 className="text-2xl md:text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                {quest.title}
                            </h1>
                        </div>
                    </div>
                )}

                {!quest.bannerUrl && (
                    <div className="mb-6">
                        {quest.category && (
                            <Badge variant="outline" className="bg-sky-950/60 border-sky-800/50 text-sky-300 text-[10px] uppercase font-bold tracking-wider mb-2">
                                {quest.category.name}
                            </Badge>
                        )}
                        <h1 className="text-2xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">
                            {quest.title}
                        </h1>
                    </div>
                )}

                {/* Player attribution */}
                <Link href={`/player/${playerId}`} className="inline-flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-sky-800/50 transition-colors">
                    <Avatar className="h-8 w-8 border border-slate-700">
                        <AvatarImage src={player.avatar || undefined} />
                        <AvatarFallback className="text-xs bg-slate-800">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-sm font-semibold text-slate-200">{player.ingameName}&apos;s Plan</p>
                        <p className="text-[10px] text-slate-500">View-only</p>
                    </div>
                </Link>
            </div>

            {/* Read-only Timeline */}
            <QuestTimelineClient
                quest={quest}
                readOnly
                initialSelections={selections}
                rosterMap={plan.rosterMap}
            />
        </div>
    );
}

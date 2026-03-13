import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerQuestPlansForProfile } from "@/app/actions/quests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ScrollText } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface PlayerProfilePageProps {
    params: Promise<{ id: string }>;
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
    const { id } = await params;

    const player = await prisma.player.findUnique({
        where: { id },
        include: {
            alliance: { select: { id: true, name: true } }
        }
    });

    if (!player) notFound();

    const questPlans = await getPlayerQuestPlansForProfile(id);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Profile Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <Avatar className="h-16 w-16 border-2 border-slate-700 shadow-xl">
                        <AvatarImage src={player.avatar || undefined} />
                        <AvatarFallback className="text-lg bg-slate-800 font-bold">{player.ingameName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white">{player.ingameName}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            {player.alliance && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <MapPin className="w-3 h-3" />
                                    <span>{player.alliance.name}</span>
                                </div>
                            )}
                            {player.championPrestige && (
                                <Badge variant="outline" className="text-[10px] h-5 border-slate-700 text-slate-400">
                                    Prestige: {player.championPrestige.toLocaleString('en-US')}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quest Plans Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 bg-sky-500 rounded-full" />
                    <h2 className="text-sm font-black text-sky-400 uppercase tracking-[0.2em]">Quest Plans</h2>
                    <Badge variant="secondary" className="text-[10px] h-4 ml-1">{questPlans.length}</Badge>
                </div>

                {questPlans.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                        <ScrollText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">No quest plans yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {questPlans.map(plan => (
                            <Link key={plan.id} href={`/player/${id}/quests/${plan.questPlan.id}`}>
                                <Card className="bg-slate-900/50 border-slate-800 hover:border-sky-800/50 transition-all hover:shadow-lg hover:shadow-sky-500/5 cursor-pointer group overflow-hidden h-full">
                                    {plan.questPlan.bannerUrl && (
                                        <div className="relative h-32 overflow-hidden">
                                            <Image
                                                src={plan.questPlan.bannerUrl}
                                                alt={plan.questPlan.title}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                style={{
                                                    objectFit: (plan.questPlan.bannerFit as "cover" | "contain") || "cover",
                                                    objectPosition: plan.questPlan.bannerPosition || "center"
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                        </div>
                                    )}
                                    <CardContent className="p-4">
                                        {plan.questPlan.category && (
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold border-slate-700 text-slate-400 mb-2">
                                                {plan.questPlan.category.name}
                                            </Badge>
                                        )}
                                        <h3 className="font-bold text-sm text-slate-200 group-hover:text-sky-400 transition-colors mb-2">
                                            {plan.questPlan.title}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-sky-950/30 border-sky-900/50 text-sky-400">
                                                {plan.encounters.length} / {plan.questPlan.encounters.length} picked
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

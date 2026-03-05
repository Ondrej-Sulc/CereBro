"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QuestPlan, QuestCategory, Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, ArrowRight, Image as ImageIcon, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

type QuestWithRelations = QuestPlan & {
    category: QuestCategory | null;
    creator: Player | null;
    encounters: { id: string }[];
};

interface Props {
    initialQuests: QuestWithRelations[];
    categories: QuestCategory[];
}

export default function QuestListClient({ initialQuests, categories }: Props) {
    const router = useRouter();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const displayedQuests = selectedCategoryId
        ? initialQuests.filter(q => q.categoryId === selectedCategoryId)
        : initialQuests;

    return (
        <div className="space-y-8">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={selectedCategoryId === null ? "default" : "outline"}
                    onClick={() => setSelectedCategoryId(null)}
                    className={selectedCategoryId === null ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 border-slate-800 text-slate-300"}
                >
                    All Quests
                </Button>
                {categories.map(cat => (
                    <Button
                        key={cat.id}
                        variant={selectedCategoryId === cat.id ? "default" : "outline"}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={selectedCategoryId === cat.id ? "bg-indigo-600 hover:bg-indigo-500" : "bg-slate-900 border-slate-800 text-slate-300"}
                    >
                        {cat.name}
                    </Button>
                ))}
            </div>

            {/* Grid of Quests */}
            {displayedQuests.length === 0 ? (
                <div className="text-center py-20 bg-slate-950/50 rounded-xl border border-slate-800 border-dashed">
                    <Map className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                    <h3 className="text-xl font-medium text-slate-300">No quests found</h3>
                    <p className="text-slate-500 mt-2">Check back later for new content.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedQuests.map(quest => (
                        <Card
                            key={quest.id}
                            className="bg-slate-950 border-slate-800 hover:border-sky-700 hover:shadow-[0_0_20px_rgba(2,132,199,0.1)] transition-all cursor-pointer group overflow-hidden flex flex-col"
                            onClick={() => router.push(`/planning/quests/${quest.id}`)}
                        >
                            <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-900 border-b border-slate-800">
                                {quest.bannerUrl ? (
                                    <Image 
                                        src={quest.bannerUrl} 
                                        alt={quest.title} 
                                        fill 
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                        className={cn(
                                            "transition-transform duration-500 group-hover:scale-105",
                                            quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                                            quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                        )} 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                        <ImageIcon className="w-8 h-8 text-slate-800 opacity-50" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                                <div className="absolute top-3 left-3 flex gap-2">
                                    <Badge variant="secondary" className="bg-slate-950/80 backdrop-blur-md border-slate-700 text-[10px] uppercase tracking-wider font-bold">
                                        {quest.category ? quest.category.name : "Uncategorized"}
                                    </Badge>
                                </div>
                                <div className="absolute top-3 right-3 flex gap-2">
                                    {quest.videoUrl && (
                                        <div className="bg-red-950/80 backdrop-blur-md border border-red-800/50 p-1 rounded-md shadow-lg" title="Video Guide Available">
                                            <Youtube className="w-3.5 h-3.5 text-red-500" />
                                        </div>
                                    )}
                                    <Badge variant="outline" className="bg-sky-950/80 backdrop-blur-md text-sky-400 border-sky-800/50 text-[10px] font-bold">
                                        {quest.encounters.length} Fights
                                    </Badge>
                                </div>
                            </div>
                            <CardHeader className="pb-3 pt-4 flex-1">
                                <CardTitle className="text-lg group-hover:text-sky-400 transition-colors line-clamp-1">{quest.title}</CardTitle>
                                <CardDescription className="text-slate-500 text-xs mt-1">
                                    Planned by {quest.creator?.ingameName || "Cerebro Admin"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <div className="flex justify-end pt-2 border-t border-slate-900/50">
                                    <span className="text-xs font-bold uppercase tracking-widest text-sky-500 flex items-center group-hover:translate-x-1 transition-transform">
                                        View Plan <ArrowRight className="ml-1.5 h-3 w-3" />
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

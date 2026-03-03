"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestPlan, QuestCategory, Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, ArrowRight } from "lucide-react";

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
                            className="bg-slate-950 border-slate-800 hover:border-sky-700 hover:shadow-[0_0_15px_rgba(2,132,199,0.15)] transition-all cursor-pointer group"
                            onClick={() => router.push(`/planning/quests/${quest.id}`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className="bg-slate-900 border-slate-700 text-slate-300">
                                        {quest.category ? quest.category.name : "Uncategorized"}
                                    </Badge>
                                    <Badge variant="outline" className="text-sky-400 border-sky-900/50 bg-sky-950/30">
                                        {quest.encounters.length} Fights
                                    </Badge>
                                </div>
                                <CardTitle className="text-xl group-hover:text-sky-400 transition-colors">{quest.title}</CardTitle>
                                <CardDescription className="text-slate-500">
                                    By {quest.creator?.ingameName || "Admin"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-end">
                                    <span className="text-sm font-medium text-sky-500 flex items-center group-hover:translate-x-1 transition-transform">
                                        Start Planning <ArrowRight className="ml-1 h-4 w-4" />
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

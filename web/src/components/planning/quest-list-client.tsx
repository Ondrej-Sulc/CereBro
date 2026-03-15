"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { QuestPlan, QuestCategory, Player, Tag, ChampionClass } from "@prisma/client";
import { QuestWithRelations, QuestSummary } from "@/types/quests";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, ArrowRight, Image as ImageIcon, Youtube, Swords, Users, ShieldAlert, Tag as TagIcon, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
    initialQuests: QuestSummary[];
    categories: QuestCategory[];
}

export default function QuestListClient({ initialQuests, categories }: Props) {
    const router = useRouter();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const displayedQuests = selectedCategoryId
        ? initialQuests.filter(q => q.categoryId === selectedCategoryId)
        : initialQuests;

    return (
        <TooltipProvider>
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {displayedQuests.map(quest => (
                        <Link key={quest.id} href={`/planning/quests/${quest.id}`} className="block h-full">
                            <Card
                                className="bg-slate-950 border-slate-800 hover:border-sky-700/50 hover:shadow-[0_0_30px_rgba(2,132,199,0.1)] transition-all cursor-pointer group overflow-hidden flex flex-col h-full relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-sky-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity"
                            >
                                {/* Banner Section */}
                                <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-900 border-b border-slate-800">
                                    {quest.bannerUrl ? (
                                        <Image
                                            src={quest.bannerUrl.replace(/#/g, '%23')}
                                            alt={quest.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 33vw"
                                            className={cn(
                                                "transition-transform duration-700 group-hover:scale-105",
                                                quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                                                quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                            )}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                            <ImageIcon className="w-12 h-12 text-slate-800 opacity-30" />
                                        </div>
                                    )}

                                    {/* Subtle Overlay Gradient for the bottom info */}
                                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-90" />

                                    {/* Bottom Info Bar on Image */}
                                    <div className="absolute bottom-2.5 right-4 flex items-center gap-2 z-10">
                                        <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl" title={`${quest.encounters.length} Fights`}>
                                            <Swords className="w-4 h-4 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                            <span className="text-xs font-black uppercase tracking-tight">{quest.encounters.length} Fights</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Section */}
                                <CardContent className="p-6 flex flex-col flex-1 gap-5">
                                    <div className="space-y-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <CardTitle className="text-xl md:text-2xl font-black group-hover:text-sky-400 transition-colors line-clamp-2 uppercase tracking-tight leading-none">
                                                {quest.title}
                                            </CardTitle>
                                            {quest.videoUrl && (
                                                <Youtube className="w-6 h-6 text-red-600 shrink-0" />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-sky-950/40 border border-sky-800/30 text-sky-400 text-[10px] uppercase tracking-[0.15em] font-black px-2.5 py-0.5 shadow-sm">
                                                {quest.category ? quest.category.name : "Uncategorized"}
                                            </Badge>
                                        </div>

                                        {/* Creators Bar */}
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                            {quest.creators && quest.creators.length > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex -space-x-2">
                                                        {quest.creators.map(c => (
                                                            <Tooltip key={c.id} delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <div className="relative w-7 h-7 rounded-full border-2 border-slate-950 overflow-hidden shadow-md bg-slate-800 hover:z-20 hover:scale-110 hover:border-sky-500 transition-all cursor-help">
                                                                        {c.image ? (
                                                                            <Image src={c.image} alt={c.name} fill className="object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-white uppercase">
                                                                                {c.name?.trim() ? c.name.trim().charAt(0) : '?'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-slate-950 border-sky-800/50 text-white p-2">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-xs font-black uppercase tracking-wider">{c.name}</span>
                                                                        {c.allianceTag && (
                                                                            <span className="text-[10px] font-bold text-sky-400">{c.allianceTag}</span>
                                                                        )}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ))}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                        {quest.creators.length === 1 ? quest.creators[0].name : `${quest.creators.length} Creators`}
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                    By {quest.creator?.ingameName || "Cerebro Admin"}
                                                </p>
                                            )}

                                            {quest._count && quest._count.playerPlans > 0 && (
                                                <div className="flex items-center gap-2 text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full shadow-lg" title={`${quest._count.playerPlans} players using this plan`}>
                                                    <Users className="w-4 h-4 text-sky-500" />
                                                    <span className="text-xs font-black">{quest._count.playerPlans}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metadata Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Star Req */}
                                        {(quest.minStarLevel || quest.maxStarLevel) && (
                                            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-2.5 flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-md bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                    <Trophy className="w-4 h-4 text-amber-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter leading-none mb-1">Restriction</span>
                                                    <span className="text-xs font-black text-amber-500 leading-none">
                                                        {quest.minStarLevel && quest.maxStarLevel ? `${quest.minStarLevel}-${quest.maxStarLevel}★` : quest.minStarLevel ? `${quest.minStarLevel}★+` : `Up to ${quest.maxStarLevel}★`}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Classes */}
                                        {quest.requiredClasses && quest.requiredClasses.length > 0 && (
                                            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-2.5 flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-md bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                                                    <ShieldAlert className="w-4 h-4 text-sky-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter leading-none mb-1">Classes</span>
                                                    <div className="flex gap-1">
                                                        {quest.requiredClasses.slice(0, 3).map(cls => (
                                                            <div key={cls} className="relative w-3.5 h-3.5">
                                                                <Image src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} fill className="object-contain" />
                                                            </div>
                                                        ))}
                                                        {quest.requiredClasses.length > 3 && <span className="text-[8px] text-slate-500 font-bold self-center">+{quest.requiredClasses.length - 3}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Tags */}
                                    {quest.requiredTags && quest.requiredTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {quest.requiredTags.slice(0, 4).map(tag => (
                                                <Badge key={tag.id} variant="outline" className="bg-slate-900/30 text-slate-400 border-slate-800 text-[9px] uppercase font-black px-2 py-0.5 h-5">
                                                    <TagIcon className="w-2.5 h-2.5 mr-1 text-slate-600" /> {tag.name}
                                                </Badge>
                                            ))}
                                            {quest.requiredTags.length > 4 && <span className="text-[10px] text-slate-600 font-bold self-center">+{quest.requiredTags.length - 4}</span>}
                                        </div>
                                    )}

                                    {/* Footer Action */}
                                    <div className="mt-auto pt-4 border-t border-slate-900/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-500 group-hover:text-sky-500 group-hover:translate-x-1 transition-all">
                                            <Map className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Open Plan</span>
                                        </div>
                                        <div className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:bg-sky-600 group-hover:border-sky-500 group-hover:scale-110 transition-all shadow-inner group-hover:shadow-[0_0_15px_rgba(2,132,199,0.5)]">
                                            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    </TooltipProvider>
    );
}

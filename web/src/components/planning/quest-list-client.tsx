"use client";

import { useState, useMemo, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { QuestCategory } from "@prisma/client";
import { QuestSummary } from "@/types/quests";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Map as MapIcon, ArrowRight, ChevronRight, Image as ImageIcon,
    Youtube, Swords, Users, ShieldAlert, Tag as TagIcon, Trophy, Folder
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const UNCATEGORIZED = "UNCATEGORIZED";

type CategoryWithThumb = QuestCategory & { thumbnailUrl?: string | null };

type CategoryNode = CategoryWithThumb & { children: CategoryNode[] };

function buildCategoryTree(cats: CategoryWithThumb[]): CategoryNode[] {
    const nodeMap = new Map<string, CategoryNode>();
    for (const cat of cats) nodeMap.set(cat.id, { ...cat, children: [] });
    const roots: CategoryNode[] = [];
    for (const node of nodeMap.values()) {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    const sortNodes = (nodes: CategoryNode[]) => {
        nodes.sort((a, b) => a.order - b.order);
        for (const n of nodes) sortNodes(n.children);
    };
    sortNodes(roots);
    return roots;
}

// Precompute subtree quest counts for all nodes into a memo map
function computeSubtreeCounts(
    nodes: CategoryNode[],
    directCountMap: Map<string, number>,
    memo: Map<string, number> = new Map()
): Map<string, number> {
    for (const node of nodes) {
        computeSubtreeCounts(node.children, directCountMap, memo);
        const direct = directCountMap.get(node.id) ?? 0;
        const nested = node.children.reduce((sum, child) => sum + (memo.get(child.id) ?? 0), 0);
        memo.set(node.id, direct + nested);
    }
    return memo;
}

function formatStarRestriction(min?: number | null, max?: number | null): string {
    if (min != null && max != null) return `${min}-${max}★`;
    if (min != null) return `${min}★+`;
    return `Up to ${max}★`;
}

interface Props {
    initialQuests: QuestSummary[];
    categories: CategoryWithThumb[];
}

export default function QuestListClient({ initialQuests, categories }: Props) {
    // navStack is an array of category IDs representing the current breadcrumb path.
    // Empty = root level.
    const [navStack, setNavStack] = useState<string[]>([]);

    const tree = useMemo(() => buildCategoryTree(categories), [categories]);

    // Direct quest count per category (quests with that categoryId exactly)
    const directCountMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const q of initialQuests) {
            const key = q.categoryId ?? UNCATEGORIZED;
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }, [initialQuests]);

    // Precomputed subtree totals keyed by node.id
    const subtreeCountMap = useMemo(
        () => computeSubtreeCounts(tree, directCountMap),
        [tree, directCountMap]
    );

    // Flat lookup map for category nodes
    const nodeMap = useMemo(() => {
        const map = new Map<string, CategoryNode>();
        const walk = (nodes: CategoryNode[]) => {
            for (const n of nodes) { map.set(n.id, n); walk(n.children); }
        };
        walk(tree);
        return map;
    }, [tree]);

    const currentCategoryId = navStack.length > 0 ? navStack[navStack.length - 1] : null;
    const currentNode = currentCategoryId ? nodeMap.get(currentCategoryId) ?? null : null;

    // Sub-folders to display at current level
    const visibleFolders: CategoryNode[] = currentNode ? currentNode.children : tree;

    // Quests directly in the current category (null = uncategorized at root)
    const directQuests = useMemo(() => {
        if (navStack.length === 0) return [];
        if (currentCategoryId === UNCATEGORIZED) return initialQuests.filter(q => q.categoryId === null);
        return initialQuests.filter(q => q.categoryId === currentCategoryId);
    }, [initialQuests, navStack, currentCategoryId]);

    const uncategorizedCount = directCountMap.get(UNCATEGORIZED) ?? 0;

    const navigateTo = (id: string) => setNavStack(prev => [...prev, id]);
    const navigateToIndex = (index: number) => setNavStack(prev => prev.slice(0, index + 1));
    const navigateToRoot = () => setNavStack([]);

    const isRoot = navStack.length === 0;

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Breadcrumb */}
                {!isRoot && (
                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            onClick={navigateToRoot}
                            className="text-[11px] font-bold text-slate-500 hover:text-sky-400 uppercase tracking-wider transition-colors"
                        >
                            All Quests
                        </button>
                        {navStack.map((id, i) => {
                            const node = id === UNCATEGORIZED ? null : nodeMap.get(id);
                            const label = id === UNCATEGORIZED ? "Uncategorized" : (node?.name ?? id);
                            const isLast = i === navStack.length - 1;
                            return (
                                <span key={id} className="flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3 text-slate-700" />
                                    {isLast ? (
                                        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">{label}</span>
                                    ) : (
                                        <button
                                            onClick={() => navigateToIndex(i)}
                                            className="text-[11px] font-bold text-slate-500 hover:text-sky-400 uppercase tracking-wider transition-colors"
                                        >
                                            {label}
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Category header (when inside a folder) */}
                {currentNode && (
                    <div className="flex items-center gap-4">
                        {currentNode.thumbnailUrl && (
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                                <Image src={currentNode.thumbnailUrl} alt={currentNode.name} fill className="object-cover" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-100">{currentNode.name}</h2>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                                {subtreeCountMap.get(currentNode.id) ?? 0} Quests
                            </p>
                        </div>
                    </div>
                )}

                {/* Sub-folders grid */}
                {visibleFolders.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {visibleFolders.map(cat => {
                            const count = subtreeCountMap.get(cat.id) ?? 0;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => navigateTo(cat.id)}
                                    className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 hover:border-sky-700/50 hover:shadow-[0_0_30px_rgba(2,132,199,0.1)] transition-all text-left"
                                >
                                    <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden">
                                        {cat.thumbnailUrl ? (
                                            <Image
                                                src={cat.thumbnailUrl}
                                                alt={cat.name}
                                                fill
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                                <Folder className="w-10 h-10 text-slate-700 group-hover:text-indigo-600 transition-colors" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        {cat.children.length > 0 && (
                                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-wide">
                                                    {cat.children.length} {cat.children.length === 1 ? "sub-category" : "sub-categories"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 md:p-4">
                                        <p className="font-black uppercase tracking-tight text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-1 text-sm md:text-base">
                                            {cat.name}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 font-bold uppercase tracking-wider">
                                            {count} {count === 1 ? "Quest" : "Quests"}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Uncategorized — root only */}
                        {isRoot && uncategorizedCount > 0 && (
                            <button
                                onClick={() => navigateTo(UNCATEGORIZED)}
                                className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 hover:border-slate-600 transition-all text-left"
                            >
                                <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                                    <Folder className="w-10 h-10 text-slate-700 group-hover:text-slate-500 transition-colors" />
                                </div>
                                <div className="p-3 md:p-4">
                                    <p className="font-black uppercase tracking-tight text-slate-400 group-hover:text-slate-300 transition-colors line-clamp-1 text-sm md:text-base">
                                        Uncategorized
                                    </p>
                                    <p className="text-[11px] text-slate-600 mt-0.5 font-bold uppercase tracking-wider">
                                        {uncategorizedCount} {uncategorizedCount === 1 ? "Quest" : "Quests"}
                                    </p>
                                </div>
                            </button>
                        )}
                    </div>
                )}

                {/* Empty root state */}
                {isRoot && visibleFolders.length === 0 && uncategorizedCount === 0 && (
                    <div className="text-center py-20 bg-slate-950/50 rounded-xl border border-slate-800 border-dashed">
                        <MapIcon className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-medium text-slate-300">No quests found</h3>
                        <p className="text-slate-500 mt-2">Check back later for new content.</p>
                    </div>
                )}

                {/* Direct quests in current folder */}
                {directQuests.length > 0 && (
                    <>
                        {visibleFolders.length > 0 && (
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-slate-800/60" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                    Quests in this category
                                </span>
                                <div className="h-px flex-1 bg-slate-800/60" />
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {directQuests.map(quest => (
                                <QuestCard key={quest.id} quest={quest} />
                            ))}
                        </div>
                    </>
                )}

                {/* Empty folder state */}
                {!isRoot && directQuests.length === 0 && visibleFolders.length === 0 && (
                    <div className="text-center py-20 bg-slate-950/50 rounded-xl border border-slate-800 border-dashed">
                        <MapIcon className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-medium text-slate-300">No quests in this category</h3>
                        <p className="text-slate-500 mt-2">Check back later for new content.</p>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}

const QuestCard = memo(function QuestCard({ quest }: { quest: QuestSummary }) {
    return (
        <Link href={`/planning/quests/${quest.id}`} className="block h-full">
            <Card className="bg-slate-950 border-slate-800 hover:border-sky-700/50 hover:shadow-[0_0_30px_rgba(2,132,199,0.1)] transition-all cursor-pointer group overflow-hidden flex flex-col h-full relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-sky-500/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity">
                {/* Banner */}
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
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-90" />
                    <div className="absolute bottom-2.5 right-4 flex items-center gap-2 z-10">
                        <div className="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl">
                            <Swords className="w-4 h-4 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-xs font-black uppercase tracking-tight">{quest.encounters.length} Fights</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <CardContent className="p-6 flex flex-col flex-1 gap-5">
                    <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-xl md:text-2xl font-black group-hover:text-sky-400 transition-colors line-clamp-2 uppercase tracking-tight leading-none">
                                {quest.title}
                            </CardTitle>
                            {quest.videoUrl && <Youtube className="w-6 h-6 text-red-600 shrink-0" />}
                        </div>

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
                                                        {c.allianceTag && <span className="text-[10px] font-bold text-sky-400">{c.allianceTag}</span>}
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
                                <div className="flex items-center gap-2 text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full shadow-lg">
                                    <Users className="w-4 h-4 text-sky-500" />
                                    <span className="text-xs font-black">{quest._count.playerPlans}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-3">
                        {(quest.minStarLevel || quest.maxStarLevel) && (
                            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-2.5 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-md bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter leading-none mb-1">Restriction</span>
                                    <span className="text-xs font-black text-amber-500 leading-none">
                                        {formatStarRestriction(quest.minStarLevel, quest.maxStarLevel)}
                                    </span>
                                </div>
                            </div>
                        )}
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

                    {/* Footer */}
                    <div className="mt-auto pt-4 border-t border-slate-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-slate-500 group-hover:text-sky-500 group-hover:translate-x-1 transition-all">
                                <MapIcon className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Open Plan</span>
                            </div>
                            {quest.personalProgress != null && quest.personalProgress > 0 && (
                                quest.personalProgress >= quest.encounters.length ? (
                                    <Badge className="text-[10px] h-5 bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 font-black uppercase tracking-wider px-2">
                                        ✓ Completed
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-[10px] h-5 bg-sky-950/30 border border-sky-900/50 text-sky-400 font-bold px-2">
                                        {quest.personalProgress} / {quest.encounters.length} picked
                                    </Badge>
                                )
                            )}
                        </div>
                        <div className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:bg-sky-600 group-hover:border-sky-500 group-hover:scale-110 transition-all shadow-inner group-hover:shadow-[0_0_15px_rgba(2,132,199,0.5)]">
                            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
});

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { reorderQuestEncountersByRoute } from "@/app/actions/quest-encounters";
import {
    createQuestRoutePath,
    createQuestRouteSection,
    deleteQuestRoutePath,
    deleteQuestRouteSection,
    duplicateQuestRoutePathFights,
    reorderQuestRoutePaths,
    reorderQuestRouteSections,
    updateQuestRoutePath,
    updateQuestRouteSection,
} from "@/app/actions/quest-routes";
import { ChevronDown, ChevronRight, ChevronUp, Copy, LayoutList, Loader2, Plus, Trash2 } from "lucide-react";
import type { QuestWithRelations, RoutePathOption } from "./types";

type RouteSection = NonNullable<QuestWithRelations["routeSections"]>[number];

type RouteLayoutPanelProps = {
    questPlanId: string;
    routeSections?: QuestWithRelations["routeSections"] | null;
    routePathOptions: RoutePathOption[];
    fightCount: number;
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function RouteLayoutPanel({
    questPlanId,
    routeSections,
    routePathOptions,
    fightCount,
}: RouteLayoutPanelProps) {
    const router = useRouter();
    const { toast } = useToast();
    const sections = routeSections ?? [];

    const [routeSectionTitles, setRouteSectionTitles] = useState<Record<string, string>>({});
    const [routePathTitles, setRoutePathTitles] = useState<Record<string, string>>({});
    const [isRouteLayoutCollapsed, setIsRouteLayoutCollapsed] = useState(false);
    const [duplicatingRoutePathId, setDuplicatingRoutePathId] = useState<string | null>(null);

    const handleSortEncountersByRoute = async () => {
        if (!confirm("Resort all fights by route section and path order? This will rewrite fight sequence numbers.")) return;
        try {
            const result = await reorderQuestEncountersByRoute(questPlanId);
            router.refresh();
            toast({ title: "Timeline sorted", description: `Updated ${result.count} fight${result.count === 1 ? "" : "s"}.` });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to sort fights by route"), variant: "destructive" });
        }
    };

    const handleCreateRouteSection = async () => {
        try {
            await createQuestRouteSection(questPlanId, `Section ${sections.length + 1}`);
            router.refresh();
            toast({ title: "Route section added", description: "A new section with Path A was created." });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to add route section"), variant: "destructive" });
        }
    };

    const handleCreateRoutePath = async (sectionId: string) => {
        const section = sections.find(s => s.id === sectionId);
        try {
            await createQuestRoutePath(questPlanId, sectionId, `Path ${String.fromCharCode(65 + (section?.paths.length || 0))}`);
            router.refresh();
            toast({ title: "Route path added", description: "A new path was added to the section." });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to add route path"), variant: "destructive" });
        }
    };

    const handleSaveRouteSectionTitle = async (sectionId: string) => {
        const section = sections.find(s => s.id === sectionId);
        const title = routeSectionTitles[sectionId]?.trim() || "Section";
        if (!section || title === section.title) return;
        try {
            await updateQuestRouteSection(questPlanId, sectionId, { title });
            router.refresh();
        } catch (error: unknown) {
            setRouteSectionTitles(prev => ({ ...prev, [sectionId]: section.title }));
            toast({ title: "Error", description: getErrorMessage(error, "Failed to rename section"), variant: "destructive" });
        }
    };

    const handleSaveRoutePathTitle = async (pathId: string) => {
        const path = sections.flatMap(s => s.paths).find(p => p.id === pathId);
        const title = routePathTitles[pathId]?.trim() || "Path";
        if (!path || title === path.title) return;
        try {
            await updateQuestRoutePath(questPlanId, pathId, { title });
            router.refresh();
        } catch (error: unknown) {
            setRoutePathTitles(prev => ({ ...prev, [pathId]: path.title }));
            toast({ title: "Error", description: getErrorMessage(error, "Failed to rename path"), variant: "destructive" });
        }
    };

    const handleMoveRouteSection = async (sectionId: string, direction: "up" | "down") => {
        const sortedSections = [...sections].sort((a, b) => a.order - b.order);
        const index = sortedSections.findIndex(section => section.id === sectionId);
        if (index === -1) return;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= sortedSections.length) return;
        const nextSections = [...sortedSections];
        [nextSections[index], nextSections[targetIndex]] = [nextSections[targetIndex], nextSections[index]];
        try {
            await reorderQuestRouteSections(questPlanId, nextSections.map(section => section.id));
            router.refresh();
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to reorder sections"), variant: "destructive" });
        }
    };

    const handleChangeRouteSectionParent = async (sectionId: string, parentPathId: string) => {
        try {
            await updateQuestRouteSection(questPlanId, sectionId, {
                parentPathId: parentPathId || null
            });
            router.refresh();
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to update section scope"), variant: "destructive" });
        }
    };

    const handleMoveRoutePath = async (sectionId: string, pathId: string, direction: "up" | "down") => {
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;
        const paths = [...section.paths].sort((a, b) => a.order - b.order);
        const index = paths.findIndex(path => path.id === pathId);
        if (index === -1) return;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= paths.length) return;
        const nextPaths = [...paths];
        [nextPaths[index], nextPaths[targetIndex]] = [nextPaths[targetIndex], nextPaths[index]];
        try {
            await reorderQuestRoutePaths(questPlanId, sectionId, nextPaths.map(path => path.id));
            router.refresh();
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to reorder paths"), variant: "destructive" });
        }
    };

    const handleDuplicateRoutePath = async (sectionId: string, pathId: string) => {
        const section = sections.find(s => s.id === sectionId);
        const path = section?.paths.find(p => p.id === pathId);
        if (!section || !path) return;

        if (!confirm(`Duplicate fights from "${section.title} / ${path.title}" into a new conditional section?`)) return;

        setDuplicatingRoutePathId(pathId);
        try {
            const result = await duplicateQuestRoutePathFights(questPlanId, pathId);
            setIsRouteLayoutCollapsed(false);
            router.refresh();
            toast({
                title: "Path fights duplicated",
                description: `Copied ${result.copiedCount} fight${result.copiedCount === 1 ? "" : "s"} into a new conditional section.`
            });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to duplicate path fights"), variant: "destructive" });
        } finally {
            setDuplicatingRoutePathId(null);
        }
    };

    const handleDeleteRouteSection = async (sectionId: string) => {
        const section = sections.find(s => s.id === sectionId);
        const assignedFightCount = section?.paths.reduce((sum, path) => sum + path.encounters.length, 0) ?? 0;
        const message = assignedFightCount > 0
            ? `Delete ${section?.title || "this section"}? ${assignedFightCount} assigned fight${assignedFightCount === 1 ? "" : "s"} will become shared fights.`
            : `Delete ${section?.title || "this section"}?`;
        if (!confirm(message)) return;
        try {
            await deleteQuestRouteSection(questPlanId, sectionId);
            router.refresh();
            toast({ title: "Route section deleted" });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to delete section"), variant: "destructive" });
        }
    };

    const handleDeleteRoutePath = async (pathId: string) => {
        const path = sections.flatMap(s => s.paths).find(p => p.id === pathId);
        const assignedFightCount = path?.encounters.length ?? 0;
        const message = assignedFightCount > 0
            ? `Delete ${path?.title || "this path"}? ${assignedFightCount} assigned fight${assignedFightCount === 1 ? "" : "s"} will become shared fights.`
            : `Delete ${path?.title || "this path"}?`;
        if (!confirm(message)) return;
        try {
            await deleteQuestRoutePath(questPlanId, pathId);
            router.refresh();
            toast({ title: "Route path deleted" });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to delete path"), variant: "destructive" });
        }
    };

    return (
        <TabsContent value="routes" className="mt-6 space-y-4 outline-none focus-visible:outline-none">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setIsRouteLayoutCollapsed(prev => !prev)}
                        className="min-w-0 flex items-center gap-2 text-left group"
                        aria-expanded={!isRouteLayoutCollapsed}
                    >
                        {isRouteLayoutCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors shrink-0" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors shrink-0" />
                        )}
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider group-hover:text-white transition-colors">Route Layout</h3>
                            <p className="text-xs text-slate-500 mt-1">Create sections and paths, then assign fights from the encounter editor.</p>
                        </div>
                    </button>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            onClick={handleSortEncountersByRoute}
                            disabled={!sections.length || !fightCount}
                        >
                            <LayoutList className="w-3.5 h-3.5 mr-1.5" /> Sort Fights
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-sky-800 text-sky-400 hover:bg-sky-950/40"
                            onClick={handleCreateRouteSection}
                        >
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Section
                        </Button>
                    </div>
                </div>

                {!isRouteLayoutCollapsed && (sections.length ? (
                    <div className="space-y-2">
                        {sections.map((section: RouteSection, sectionIndex: number) => (
                            <div key={section.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <Input
                                            value={routeSectionTitles[section.id] ?? section.title}
                                            onChange={(e) => setRouteSectionTitles(prev => ({ ...prev, [section.id]: e.target.value }))}
                                            onBlur={() => handleSaveRouteSectionTitle(section.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className="h-8 bg-slate-950/70 border-slate-800 text-xs font-bold text-slate-200"
                                        />
                                        <div className="text-[11px] text-slate-600 mt-1">{section.paths.length} path{section.paths.length === 1 ? "" : "s"}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            disabled={sectionIndex === 0}
                                            className="h-7 w-7 text-slate-500 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-30"
                                            onClick={() => handleMoveRouteSection(section.id, "up")}
                                            title="Move section up"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            disabled={sectionIndex === sections.length - 1}
                                            className="h-7 w-7 text-slate-500 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-30"
                                            onClick={() => handleMoveRouteSection(section.id, "down")}
                                            title="Move section down"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-[11px] text-slate-400 hover:text-sky-300 hover:bg-slate-800"
                                            onClick={() => handleCreateRoutePath(section.id)}
                                        >
                                            <Plus className="w-3 h-3 mr-1" /> Path
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                                            onClick={() => handleDeleteRouteSection(section.id)}
                                            title="Delete section"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Visible After</Label>
                                    <select
                                        value={section.parentPathId || ""}
                                        onChange={(e) => handleChangeRouteSectionParent(section.id, e.target.value)}
                                        className="mt-1 w-full h-8 rounded-md border border-slate-800 bg-slate-950/70 px-2 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="">Always visible</option>
                                        {routePathOptions
                                            .filter(path => !section.paths.some(sectionPath => sectionPath.id === path.id))
                                            .map(path => (
                                                <option key={path.id} value={path.id}>{path.label}</option>
                                            ))}
                                    </select>
                                </div>
                                <div className="mt-3 space-y-1.5">
                                    {section.paths.map((path, pathIndex) => (
                                        <div key={path.id} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-2">
                                            <Input
                                                value={routePathTitles[path.id] ?? path.title}
                                                onChange={(e) => setRoutePathTitles(prev => ({ ...prev, [path.id]: e.target.value }))}
                                                onBlur={() => handleSaveRoutePathTitle(path.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                className="h-7 min-w-0 bg-slate-900 border-slate-800 text-xs text-slate-300"
                                            />
                                            <Badge variant="outline" className="shrink-0 border-slate-700 bg-slate-900/80 text-slate-500 text-[10px]">
                                                {path.encounters.length} fight{path.encounters.length === 1 ? "" : "s"}
                                            </Badge>
                                            <div className="flex items-center gap-0.5">
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    disabled={pathIndex === 0}
                                                    className="h-7 w-7 text-slate-500 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-30"
                                                    onClick={() => handleMoveRoutePath(section.id, path.id, "up")}
                                                    title="Move path up"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    disabled={pathIndex === section.paths.length - 1}
                                                    className="h-7 w-7 text-slate-500 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-30"
                                                    onClick={() => handleMoveRoutePath(section.id, path.id, "down")}
                                                    title="Move path down"
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    disabled={duplicatingRoutePathId === path.id}
                                                    className="h-7 w-7 text-slate-500 hover:text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-40"
                                                    onClick={() => handleDuplicateRoutePath(section.id, path.id)}
                                                    title="Duplicate path fights"
                                                >
                                                    {duplicatingRoutePathId === path.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                                                    onClick={() => handleDeleteRoutePath(path.id)}
                                                    title="Delete path"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-4 text-center text-xs text-slate-500">
                        No route sections yet. Existing fights remain shared until you create sections and assign them to paths.
                    </div>
                ))}
            </div>
        </TabsContent>
    );
}

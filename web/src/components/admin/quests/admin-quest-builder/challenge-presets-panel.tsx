"use client";

import { type ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ChampionClass, QuestObjectiveTagMode, type Tag } from "@prisma/client";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MultiTagCombobox } from "@/components/comboboxes/MultiTagCombobox";
import { useToast } from "@/hooks/use-toast";
import { deleteQuestObjective, seedNecropolisCarinaObjectives, uploadQuestObjectiveImage, upsertQuestObjective } from "@/app/actions/quest-objectives";
import { isNecropolisQuestTitle } from "@/lib/quest-objectives";
import { cn } from "@/lib/utils";
import { Copy, ImageIcon, Loader2, Plus, Save, Star, Trash2, Upload, XCircle } from "lucide-react";
import type { EncounterWithRelations, ObjectiveRouteChoiceForm, ObjectiveRouteRecommendationForm, QuestWithRelations } from "./types";

type ChallengePresetsPanelProps = {
    questPlanId: string;
    questTitle: string;
    objectives?: QuestWithRelations["objectives"] | null;
    routeSections?: QuestWithRelations["routeSections"] | null;
    encounters: EncounterWithRelations[];
    tags: Tag[];
};

type RouteSection = NonNullable<ChallengePresetsPanelProps["routeSections"]>[number];

const AVAILABLE_CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MUTANT", "COSMIC", "TECH", "MYSTIC"];

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getVisiblePresetRouteSections(
    routeSections: RouteSection[],
    routeChoices: Record<string, string | undefined>
) {
    const visible = new Set<string>();
    let changed = true;

    while (changed) {
        changed = false;
        for (const section of routeSections) {
            if (visible.has(section.id)) continue;
            if (!section.parentPathId) {
                visible.add(section.id);
                changed = true;
                continue;
            }

            const parentSection = routeSections.find(candidate =>
                candidate.paths.some(path => path.id === section.parentPathId)
            );
            if (!parentSection || !visible.has(parentSection.id)) continue;
            if (routeChoices[parentSection.id] === section.parentPathId) {
                visible.add(section.id);
                changed = true;
            }
        }
    }

    return routeSections.filter(section => visible.has(section.id));
}

function prunePresetRouteChoices<TValue>(
    routeSections: RouteSection[],
    routeChoices: Record<string, TValue>,
    getPathId: (value: TValue) => string | undefined
) {
    const selectedPathBySection = Object.fromEntries(
        Object.entries(routeChoices).map(([sectionId, value]) => [sectionId, getPathId(value)])
    );
    const visibleSectionIds = new Set(
        getVisiblePresetRouteSections(routeSections, selectedPathBySection).map(section => section.id)
    );

    return Object.fromEntries(
        Object.entries(routeChoices).filter(([sectionId, value]) => {
            const section = routeSections.find(candidate => candidate.id === sectionId);
            const pathId = getPathId(value);
            return Boolean(
                section &&
                pathId &&
                visibleSectionIds.has(sectionId) &&
                section.paths.some(path => path.id === pathId)
            );
        })
    );
}

export function ChallengePresetsPanel({
    questPlanId,
    questTitle,
    objectives,
    routeSections,
    encounters,
    tags,
}: ChallengePresetsPanelProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isNecropolisQuest = isNecropolisQuestTitle(questTitle);
    const routeSectionList = routeSections || [];

    const [isSeedingObjectives, setIsSeedingObjectives] = useState(false);
    const [objectiveEditingId, setObjectiveEditingId] = useState<string | null>(null);
    const [objectiveTitle, setObjectiveTitle] = useState("");
    const [objectiveSlug, setObjectiveSlug] = useState("");
    const [objectiveShortTitle, setObjectiveShortTitle] = useState("");
    const [objectiveDescription, setObjectiveDescription] = useState("");
    const [objectiveImageUrl, setObjectiveImageUrl] = useState<string | null>(null);
    const [objectiveImageFit, setObjectiveImageFit] = useState("cover");
    const [objectiveImagePosition, setObjectiveImagePosition] = useState("center");
    const [objectiveOrder, setObjectiveOrder] = useState("");
    const [objectiveIsVisible, setObjectiveIsVisible] = useState(true);
    const [objectiveTeamLimit, setObjectiveTeamLimit] = useState("");
    const [objectiveMinStars, setObjectiveMinStars] = useState("");
    const [objectiveMaxStars, setObjectiveMaxStars] = useState("");
    const [objectiveRequiredClasses, setObjectiveRequiredClasses] = useState<ChampionClass[]>([]);
    const [objectiveRequiredTags, setObjectiveRequiredTags] = useState<number[]>([]);
    const [objectiveRequiredTagMode, setObjectiveRequiredTagMode] = useState<QuestObjectiveTagMode>(QuestObjectiveTagMode.ALL);
    const [objectiveEndpointEncounterId, setObjectiveEndpointEncounterId] = useState("");
    const [objectiveDefaultShowContinuation, setObjectiveDefaultShowContinuation] = useState(false);
    const [objectiveRouteChoices, setObjectiveRouteChoices] = useState<ObjectiveRouteChoiceForm>({});
    const [objectiveRouteRecommendations, setObjectiveRouteRecommendations] = useState<ObjectiveRouteRecommendationForm[]>([]);
    const [isSavingObjective, setIsSavingObjective] = useState(false);
    const [isDeletingObjectiveId, setIsDeletingObjectiveId] = useState<string | null>(null);
    const [isUploadingObjectiveImage, setIsUploadingObjectiveImage] = useState(false);

    const resetObjectiveForm = () => {
        setObjectiveEditingId(null);
        setObjectiveTitle("");
        setObjectiveSlug("");
        setObjectiveShortTitle("");
        setObjectiveDescription("");
        setObjectiveImageUrl(null);
        setObjectiveImageFit("cover");
        setObjectiveImagePosition("center");
        setObjectiveOrder(String((objectives?.length || 0) + 1));
        setObjectiveIsVisible(true);
        setObjectiveTeamLimit("");
        setObjectiveMinStars("");
        setObjectiveMaxStars("");
        setObjectiveRequiredClasses([]);
        setObjectiveRequiredTags([]);
        setObjectiveRequiredTagMode(QuestObjectiveTagMode.ALL);
        setObjectiveEndpointEncounterId("");
        setObjectiveDefaultShowContinuation(false);
        setObjectiveRouteChoices({});
        setObjectiveRouteRecommendations([]);
    };

    const editObjective = (objective: QuestWithRelations["objectives"][number]) => {
        setObjectiveEditingId(objective.id);
        setObjectiveTitle(objective.title);
        setObjectiveSlug(objective.slug);
        setObjectiveShortTitle(objective.shortTitle || "");
        setObjectiveDescription(objective.description || "");
        setObjectiveImageUrl(objective.imageUrl || null);
        setObjectiveImageFit(objective.imageFit || "cover");
        setObjectiveImagePosition(objective.imagePosition || "center");
        setObjectiveOrder(String(objective.order));
        setObjectiveIsVisible(objective.isVisible);
        setObjectiveTeamLimit(objective.teamLimitOverride == null ? "" : String(objective.teamLimitOverride));
        setObjectiveMinStars(objective.minStarLevel == null ? "" : String(objective.minStarLevel));
        setObjectiveMaxStars(objective.maxStarLevel == null ? "" : String(objective.maxStarLevel));
        setObjectiveRequiredClasses(objective.requiredClasses || []);
        setObjectiveRequiredTags(objective.requiredTags.map(tag => tag.id));
        setObjectiveRequiredTagMode(objective.requiredTagMode);
        setObjectiveEndpointEncounterId(objective.endpointEncounterId || "");
        setObjectiveDefaultShowContinuation(objective.defaultShowContinuation);
        setObjectiveRouteChoices(Object.fromEntries(
            objective.routeChoices.map(choice => [
                choice.questRouteSectionId,
                { pathId: choice.questRoutePathId, isLocked: choice.isLocked }
            ])
        ));
        setObjectiveRouteRecommendations((objective.routeRecommendations || []).map(recommendation => ({
            id: recommendation.id,
            title: recommendation.title,
            slug: recommendation.slug,
            order: recommendation.order,
            choices: Object.fromEntries(
                recommendation.choices.map((choice: { questRouteSectionId: string; questRoutePathId: string }) => [
                    choice.questRouteSectionId,
                    choice.questRoutePathId,
                ])
            ),
        })));
    };

    const handleSaveObjective = async () => {
        setIsSavingObjective(true);
        try {
            const prunedRouteChoices = prunePresetRouteChoices(
                routeSectionList,
                objectiveRouteChoices,
                choice => choice.pathId
            );
            const routeChoices = Object.entries(prunedRouteChoices)
                .filter(([, choice]) => choice.pathId)
                .map(([questRouteSectionId, choice]) => ({
                    questRouteSectionId,
                    questRoutePathId: choice.pathId,
                    isLocked: choice.isLocked,
                }));
            const routeRecommendations = objectiveRouteRecommendations
                .map((recommendation, index) => ({
                    id: recommendation.id,
                    slug: recommendation.slug || recommendation.title,
                    title: recommendation.title,
                    order: recommendation.order || index + 1,
                    choices: Object.entries(prunePresetRouteChoices(
                        routeSectionList,
                        recommendation.choices,
                        pathId => pathId
                    ))
                        .filter(([, questRoutePathId]) => Boolean(questRoutePathId))
                        .map(([questRouteSectionId, questRoutePathId]) => ({
                            questRouteSectionId,
                            questRoutePathId,
                        })),
                }))
                .filter(recommendation => recommendation.title.trim() && recommendation.choices.length > 0);

            const result = await upsertQuestObjective({
                id: objectiveEditingId || undefined,
                questPlanId,
                title: objectiveTitle,
                slug: objectiveSlug || objectiveTitle,
                shortTitle: objectiveShortTitle || null,
                description: objectiveDescription || null,
                imageUrl: objectiveImageUrl,
                imageFit: objectiveImageFit,
                imagePosition: objectiveImagePosition,
                order: objectiveOrder ? parseInt(objectiveOrder) : (objectives?.length || 0) + 1,
                isVisible: objectiveIsVisible,
                teamLimitOverride: objectiveTeamLimit ? parseInt(objectiveTeamLimit) : null,
                minStarLevel: objectiveMinStars ? parseInt(objectiveMinStars) : null,
                maxStarLevel: objectiveMaxStars ? parseInt(objectiveMaxStars) : null,
                requiredClasses: objectiveRequiredClasses,
                requiredTagIds: objectiveRequiredTags,
                requiredTagMode: objectiveRequiredTagMode,
                endpointEncounterId: objectiveEndpointEncounterId || null,
                defaultShowContinuation: objectiveDefaultShowContinuation,
                routeChoices,
                routeRecommendations,
            });
            setObjectiveEditingId(result.objectiveId);
            router.refresh();
            toast({ title: "Challenge preset saved" });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to save challenge preset"), variant: "destructive" });
        } finally {
            setIsSavingObjective(false);
        }
    };

    const handleObjectiveImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !objectiveEditingId) return;

        setIsUploadingObjectiveImage(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const result = await uploadQuestObjectiveImage(questPlanId, objectiveEditingId, formData);
            if (result.success && result.url) {
                setObjectiveImageUrl(result.url);
                router.refresh();
                toast({ title: "Objective image uploaded" });
            }
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to upload objective image"), variant: "destructive" });
        } finally {
            setIsUploadingObjectiveImage(false);
        }
    };

    const handleDeleteObjective = async (objectiveId: string) => {
        if (!confirm("Delete this challenge preset? Existing player plans for this objective will also be deleted.")) return;
        setIsDeletingObjectiveId(objectiveId);
        try {
            await deleteQuestObjective(questPlanId, objectiveId);
            if (objectiveEditingId === objectiveId) resetObjectiveForm();
            router.refresh();
            toast({ title: "Challenge preset deleted" });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to delete challenge preset"), variant: "destructive" });
        } finally {
            setIsDeletingObjectiveId(null);
        }
    };

    const handleSeedNecropolisObjectives = async () => {
        if (!confirm("Create or update the six Necropolis Carina challenge presets for this quest?")) return;
        setIsSeedingObjectives(true);
        try {
            const result = await seedNecropolisCarinaObjectives(questPlanId);
            router.refresh();
            toast({
                title: "Challenge presets seeded",
                description: `Created or updated ${result.count} Necropolis Carina preset${result.count === 1 ? "" : "s"}.`
            });
        } catch (error: unknown) {
            toast({ title: "Error", description: getErrorMessage(error, "Failed to seed challenge presets"), variant: "destructive" });
        } finally {
            setIsSeedingObjectives(false);
        }
    };

    const addRecommendedRoute = () => {
        if (objectiveRouteRecommendations.length >= 2) return;
        const order = objectiveRouteRecommendations.length + 1;
        setObjectiveRouteRecommendations(prev => [
            ...prev,
            {
                title: order === 1 ? "Recommended Route" : "Alternate Route",
                order,
                choices: {},
            },
        ]);
    };

    const copyRouteDefaultsToRecommendation = (index: number) => {
        const choices = Object.fromEntries(
            Object.entries(objectiveRouteChoices)
                .filter(([, choice]) => Boolean(choice.pathId))
                .map(([sectionId, choice]) => [sectionId, choice.pathId])
        );
        setObjectiveRouteRecommendations(prev => prev.map((recommendation, recommendationIndex) =>
            recommendationIndex === index
                ? { ...recommendation, choices: prunePresetRouteChoices(routeSectionList, choices, pathId => pathId) }
                : recommendation
        ));
    };

    const hasRouteDefaults = Object.values(objectiveRouteChoices).some(choice => Boolean(choice.pathId));

    return (
        <TabsContent value="presets" className="mt-6 space-y-4 outline-none focus-visible:outline-none">
                    <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Challenge Presets</h3>
                                <p className="text-xs text-slate-500 mt-1">Objective-specific route defaults, locks, endpoints, and roster restrictions.</p>
                            </div>
                            {isNecropolisQuest && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 border-amber-800 text-amber-300 hover:bg-amber-950/40"
                                    onClick={handleSeedNecropolisObjectives}
                                    disabled={isSeedingObjectives}
                                >
                                    {isSeedingObjectives ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Star className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Seed Necropolis
                                </Button>
                            )}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Existing Presets</Label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-[11px] text-amber-300 hover:bg-amber-950/40"
                                        onClick={resetObjectiveForm}
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1" /> New
                                    </Button>
                                </div>
                                {objectives?.length ? (
                                    <div className="grid gap-2">
                                        {objectives.map((objective) => (
                                            <button
                                                key={objective.id}
                                                type="button"
                                                onClick={() => editObjective(objective)}
                                                className={cn(
                                                    "rounded-lg border bg-slate-950/50 p-3 text-left transition-colors hover:border-amber-800/70 hover:bg-amber-950/10",
                                                    objectiveEditingId === objective.id ? "border-amber-700/80 bg-amber-950/20" : "border-slate-800"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex min-w-0 gap-3">
                                                        <div className="relative mt-0.5 hidden h-12 w-16 shrink-0 overflow-hidden rounded-md border border-slate-800 bg-slate-900 sm:block">
                                                            {objective.imageUrl ? (
                                                                <Image
                                                                    src={objective.imageUrl.replace(/#/g, "%23")}
                                                                    alt={objective.title}
                                                                    fill
                                                                    className={cn(
                                                                        objective.imageFit === "contain" ? "object-contain" : "object-cover",
                                                                        objective.imagePosition === "top" ? "object-top" : objective.imagePosition === "bottom" ? "object-bottom" : "object-center"
                                                                    )}
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-slate-700">
                                                                    <ImageIcon className="h-4 w-4" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">#{objective.order}</span>
                                                                {!objective.isVisible && (
                                                                    <Badge variant="outline" className="border-slate-700 text-slate-500 text-[9px] uppercase">Hidden</Badge>
                                                                )}
                                                            </div>
                                                            <h4 className="mt-1 truncate text-sm font-black uppercase tracking-wide text-white">{objective.title}</h4>
                                                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                                                {objective.shortTitle || objective.description || (objective.imageUrl ? "Image assigned" : "No card image")}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0 border-amber-800/60 bg-amber-950/30 text-amber-200 text-[9px] uppercase">
                                                        {objective.routeChoices.length} route{objective.routeChoices.length === 1 ? "" : "s"}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {objective.requiredClasses.map((cls) => (
                                                        <Badge key={cls} variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 text-[9px] uppercase">{cls}</Badge>
                                                    ))}
                                                    {objective.requiredTags.map((tag) => (
                                                        <Badge key={tag.id} variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 text-[9px] uppercase">{tag.name}</Badge>
                                                    ))}
                                                    {objective.requiredTagMode === "ANY" && (
                                                        <Badge variant="outline" className="border-sky-800 bg-sky-950/30 text-sky-300 text-[9px] uppercase">Any Tag</Badge>
                                                    )}
                                                    {(objective.minStarLevel || objective.maxStarLevel) && (
                                                        <Badge variant="outline" className="border-amber-800 bg-amber-950/30 text-amber-300 text-[9px] uppercase">
                                                            {objective.minStarLevel && objective.maxStarLevel ? `${objective.minStarLevel}-${objective.maxStarLevel}★` : objective.minStarLevel ? `${objective.minStarLevel}★+` : `Up to ${objective.maxStarLevel}★`}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-4 text-center text-xs text-slate-500">
                                        {isNecropolisQuest ? "No challenge presets yet. Seed Necropolis defaults or create a custom preset." : "No challenge presets yet. Create a custom preset."}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-wide text-white">
                                            {objectiveEditingId ? "Edit Preset" : "New Preset"}
                                        </h4>
                                        <p className="text-[11px] text-slate-500">Restrictions, endpoint, and route defaults for this planning scope.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {objectiveEditingId && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="border-red-900/70 text-red-300 hover:bg-red-950/40"
                                                onClick={() => handleDeleteObjective(objectiveEditingId)}
                                                disabled={isDeletingObjectiveId === objectiveEditingId}
                                            >
                                                {isDeletingObjectiveId === objectiveEditingId ? (
                                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                                )}
                                                Delete
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="bg-amber-600 hover:bg-amber-500 text-white"
                                            onClick={handleSaveObjective}
                                            disabled={isSavingObjective}
                                        >
                                            {isSavingObjective ? (
                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            ) : (
                                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                            )}
                                            Save
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Title</Label>
                                        <Input
                                            value={objectiveTitle}
                                            onChange={(e) => setObjectiveTitle(e.target.value)}
                                            placeholder="Masterful Mutants"
                                            className="h-9 bg-slate-900 border-slate-800 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Slug</Label>
                                        <Input
                                            value={objectiveSlug}
                                            onChange={(e) => setObjectiveSlug(e.target.value)}
                                            placeholder="masterful-mutants"
                                            className="h-9 bg-slate-900 border-slate-800 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Short Title</Label>
                                        <Input
                                            value={objectiveShortTitle}
                                            onChange={(e) => setObjectiveShortTitle(e.target.value)}
                                            placeholder="Mutants"
                                            className="h-9 bg-slate-900 border-slate-800 text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={objectiveOrder}
                                                onChange={(e) => setObjectiveOrder(e.target.value)}
                                                className="h-9 bg-slate-900 border-slate-800 text-sm"
                                            />
                                        </div>
                                        <label className="mt-6 flex h-9 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 text-xs text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={objectiveIsVisible}
                                                onChange={(e) => setObjectiveIsVisible(e.target.checked)}
                                                className="rounded border-slate-700 bg-slate-950"
                                            />
                                            Visible
                                        </label>
                                    </div>
                                    <div className="md:col-span-2 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</Label>
                                        <Textarea
                                            value={objectiveDescription}
                                            onChange={(e) => setObjectiveDescription(e.target.value)}
                                            placeholder="Optional planning notes shown in the objective banner."
                                            className="min-h-[70px] bg-slate-900 border-slate-800 text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Card Image</Label>
                                                <p className="mt-1 text-[11px] text-slate-500">Shown on planning objective cards. Recommended ratio: 16:9.</p>
                                            </div>
                                            {!objectiveEditingId && (
                                                <Badge variant="outline" className="shrink-0 border-slate-700 text-[9px] uppercase text-slate-500">
                                                    Save first to upload
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                                            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                                                {objectiveImageUrl ? (
                                                    <>
                                                        <Image
                                                            src={objectiveImageUrl.replace(/#/g, "%23")}
                                                            alt="Objective card"
                                                            fill
                                                            className={cn(
                                                                objectiveImageFit === "cover" ? "object-cover" : "object-contain",
                                                                objectiveImagePosition === "top" ? "object-top" : objectiveImagePosition === "bottom" ? "object-bottom" : "object-center"
                                                            )}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setObjectiveImageUrl(null)}
                                                            className="absolute right-2 top-2 rounded-full border border-red-800/60 bg-red-950/80 p-1 text-red-200 shadow-lg transition-colors hover:bg-red-900"
                                                            title="Remove image"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-slate-600">
                                                        <ImageIcon className="h-8 w-8 opacity-30" />
                                                        <span className="text-xs font-medium">No image assigned</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex flex-wrap gap-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Image Fit</Label>
                                                        <select
                                                            value={objectiveImageFit}
                                                            onChange={(e) => setObjectiveImageFit(e.target.value)}
                                                            className="block h-9 w-32 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-300 focus:ring-1 focus:ring-amber-500"
                                                        >
                                                            <option value="cover">Zoom (Cover)</option>
                                                            <option value="contain">Whole (Contain)</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Position</Label>
                                                        <select
                                                            value={objectiveImagePosition}
                                                            onChange={(e) => setObjectiveImagePosition(e.target.value)}
                                                            className="block h-9 w-28 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-300 focus:ring-1 focus:ring-amber-500"
                                                        >
                                                            <option value="top">Top</option>
                                                            <option value="center">Center</option>
                                                            <option value="bottom">Bottom</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <label className={cn(
                                                        "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 shadow-sm transition-all hover:bg-slate-700",
                                                        (!objectiveEditingId || isUploadingObjectiveImage) && "pointer-events-none opacity-50"
                                                    )}>
                                                        {isUploadingObjectiveImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                        {isUploadingObjectiveImage ? "Uploading..." : "Upload Image"}
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/png,image/jpeg,image/webp"
                                                            onChange={handleObjectiveImageUpload}
                                                            disabled={!objectiveEditingId || isUploadingObjectiveImage}
                                                        />
                                                    </label>
                                                    <div className="relative min-w-0 flex-1">
                                                        <Input
                                                            placeholder="Or paste external URL..."
                                                            value={objectiveImageUrl || ""}
                                                            onChange={(e) => setObjectiveImageUrl(e.target.value.trim() === "" ? null : e.target.value)}
                                                            className="h-10 bg-slate-950 border-slate-800 pr-10 text-xs"
                                                        />
                                                        {objectiveImageUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setObjectiveImageUrl(null)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                                            >
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-800/60" />

                                <div className="space-y-3">
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Team Limit</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={objectiveTeamLimit}
                                                onChange={(e) => setObjectiveTeamLimit(e.target.value)}
                                                placeholder="Quest default"
                                                className="h-9 bg-slate-900 border-slate-800 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Min Stars</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={7}
                                                value={objectiveMinStars}
                                                onChange={(e) => setObjectiveMinStars(e.target.value)}
                                                placeholder="None"
                                                className="h-9 bg-slate-900 border-slate-800 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Max Stars</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={7}
                                                value={objectiveMaxStars}
                                                onChange={(e) => setObjectiveMaxStars(e.target.value)}
                                                placeholder="None"
                                                className="h-9 bg-slate-900 border-slate-800 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Required Classes</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {AVAILABLE_CLASSES.map(cls => (
                                                <Badge
                                                    key={cls}
                                                    variant={objectiveRequiredClasses.includes(cls) ? "default" : "outline"}
                                                    className={objectiveRequiredClasses.includes(cls) ? "bg-amber-600 cursor-pointer py-1.5 px-3" : "border-slate-700 text-slate-400 cursor-pointer py-1.5 px-3 hover:border-slate-600 hover:text-slate-300 transition-colors"}
                                                    onClick={() => {
                                                        setObjectiveRequiredClasses(prev => (
                                                            prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
                                                        ));
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Image
                                                            src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`}
                                                            alt={cls}
                                                            width={16}
                                                            height={16}
                                                            className="object-contain"
                                                        />
                                                        {cls}
                                                    </div>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tag Mode</Label>
                                            <select
                                                value={objectiveRequiredTagMode}
                                                onChange={(e) => setObjectiveRequiredTagMode(e.target.value as QuestObjectiveTagMode)}
                                                className="w-full h-9 rounded-md border border-slate-800 bg-slate-900 px-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            >
                                                <option value={QuestObjectiveTagMode.ALL}>All tags</option>
                                                <option value={QuestObjectiveTagMode.ANY}>Any tag</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Required Tags</Label>
                                            <MultiTagCombobox
                                                tags={tags}
                                                values={objectiveRequiredTags.map(id => tags.find(t => t.id === id)?.name || "").filter(Boolean)}
                                                onSelect={(names) => setObjectiveRequiredTags(names.map(name => {
                                                    const foundTag = tags.find(t => t.name === name);
                                                    return foundTag ? foundTag.id : undefined;
                                                }).filter((id): id is number => id !== undefined))}
                                                placeholder="Search tags..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-800/60" />

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Endpoint Encounter</Label>
                                        <select
                                            value={objectiveEndpointEncounterId}
                                            onChange={(e) => setObjectiveEndpointEncounterId(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-800 bg-slate-900 px-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">Full run / no endpoint</option>
                                            {encounters.map((encounter) => (
                                                <option key={encounter.id} value={encounter.id}>
                                                    {encounter.sequence}. {encounter.defender?.name || "Unknown Defender"}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <label className="mt-6 flex h-9 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={objectiveDefaultShowContinuation}
                                            onChange={(e) => setObjectiveDefaultShowContinuation(e.target.checked)}
                                            className="rounded border-slate-700 bg-slate-950"
                                        />
                                        Show continuation by default
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Route Defaults</Label>
                                    {routeSectionList.length ? (
                                        <div className="space-y-2">
                                            {getVisiblePresetRouteSections(
                                                routeSectionList,
                                                Object.fromEntries(
                                                    Object.entries(objectiveRouteChoices).map(([sectionId, choice]) => [sectionId, choice.pathId])
                                                )
                                            ).map((section) => {
                                                const choice = objectiveRouteChoices[section.id];
                                                return (
                                                    <div key={section.id} className="grid gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-2 md:grid-cols-[150px_minmax(0,1fr)_92px] md:items-center">
                                                        <div className="text-xs font-bold text-slate-300 truncate">{section.title}</div>
                                                        <select
                                                            value={choice?.pathId || ""}
                                                            onChange={(e) => {
                                                                const pathId = e.target.value;
                                                                setObjectiveRouteChoices(prev => {
                                                                    const next = { ...prev };
                                                                    if (!pathId) {
                                                                        delete next[section.id];
                                                                    } else {
                                                                        next[section.id] = {
                                                                            pathId,
                                                                            isLocked: prev[section.id]?.isLocked ?? false,
                                                                        };
                                                                    }
                                                                    return prunePresetRouteChoices(routeSectionList, next, choice => choice.pathId);
                                                                });
                                                            }}
                                                            className="w-full h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                        >
                                                            <option value="">No default</option>
                                                            {section.paths.map((path) => (
                                                                <option key={path.id} value={path.id}>{path.title}</option>
                                                            ))}
                                                        </select>
                                                        <label className={cn(
                                                            "flex h-8 items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs text-slate-300",
                                                            !choice?.pathId && "opacity-50"
                                                        )}>
                                                            <input
                                                                type="checkbox"
                                                                checked={choice?.isLocked || false}
                                                                disabled={!choice?.pathId}
                                                                onChange={(e) => {
                                                                    setObjectiveRouteChoices(prev => ({
                                                                        ...prev,
                                                                        [section.id]: {
                                                                            pathId: prev[section.id]?.pathId || "",
                                                                            isLocked: e.target.checked,
                                                                        },
                                                                    }));
                                                                }}
                                                                className="rounded border-slate-700 bg-slate-950"
                                                            />
                                                            Lock
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-3 text-center text-xs text-slate-500">
                                            Create route sections before assigning objective defaults.
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended Routes</Label>
                                            <p className="mt-0.5 text-[11px] text-slate-600">Up to two optional route variants highlighted in the player planner.</p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 shrink-0 border-amber-800/60 text-amber-300 hover:bg-amber-950/40"
                                            onClick={addRecommendedRoute}
                                            disabled={objectiveRouteRecommendations.length >= 2}
                                        >
                                            <Plus className="mr-1 h-3.5 w-3.5" />
                                            Add Recommended Route
                                        </Button>
                                    </div>
                                    {objectiveRouteRecommendations.length > 0 ? (
                                        <div className="space-y-3">
                                            {objectiveRouteRecommendations.map((recommendation, index) => (
                                                <div key={recommendation.id || index} className="space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/10 p-3">
                                                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Route Title</Label>
                                                            <Input
                                                                value={recommendation.title}
                                                                onChange={(e) => {
                                                                    const title = e.target.value;
                                                                    setObjectiveRouteRecommendations(prev => prev.map((item, itemIndex) =>
                                                                        itemIndex === index ? { ...item, title } : item
                                                                    ));
                                                                }}
                                                                className="h-8 bg-slate-950 border-slate-800 text-xs"
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 border-slate-800 text-slate-300 hover:bg-slate-900"
                                                            onClick={() => copyRouteDefaultsToRecommendation(index)}
                                                            disabled={!hasRouteDefaults}
                                                        >
                                                            <Copy className="mr-1 h-3.5 w-3.5" />
                                                            Copy Defaults
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 border-slate-800 text-slate-300 hover:bg-slate-900"
                                                            onClick={() => {
                                                                setObjectiveRouteRecommendations(prev => prev.map((item, itemIndex) =>
                                                                    itemIndex === index ? { ...item, choices: {} } : item
                                                                ));
                                                            }}
                                                        >
                                                            Clear
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-red-300 hover:bg-red-950/30"
                                                            onClick={() => {
                                                                setObjectiveRouteRecommendations(prev =>
                                                                    prev
                                                                        .filter((_, itemIndex) => itemIndex !== index)
                                                                        .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }))
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                    {routeSectionList.length ? (
                                                        <div className="grid gap-2">
                                                            {getVisiblePresetRouteSections(routeSectionList, recommendation.choices).map((section) => (
                                                                <div key={section.id} className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-2 md:grid-cols-[150px_minmax(0,1fr)] md:items-center">
                                                                    <div className="truncate text-xs font-bold text-slate-300">{section.title}</div>
                                                                    <select
                                                                        value={recommendation.choices[section.id] || ""}
                                                                        onChange={(e) => {
                                                                            const pathId = e.target.value;
                                                                            setObjectiveRouteRecommendations(prev => prev.map((item, itemIndex) => {
                                                                                if (itemIndex !== index) return item;
                                                                                const choices = { ...item.choices };
                                                                                if (pathId) {
                                                                                    choices[section.id] = pathId;
                                                                                } else {
                                                                                    delete choices[section.id];
                                                                                }
                                                                                return {
                                                                                    ...item,
                                                                                    choices: prunePresetRouteChoices(routeSectionList, choices, pathId => pathId),
                                                                                };
                                                                            }));
                                                                        }}
                                                                        className="h-8 w-full rounded-md border border-slate-800 bg-slate-950 px-2 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                    >
                                                                        <option value="">No recommendation</option>
                                                                        {section.paths.map((path) => (
                                                                            <option key={path.id} value={path.id}>{path.title}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-3 text-center text-xs text-slate-500">
                                                            Create route sections before assigning recommended routes.
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-3 text-center text-xs text-slate-500">
                                            No recommended routes yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
        </TabsContent>

    );
}

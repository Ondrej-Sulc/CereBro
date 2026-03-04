"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuestPlan, QuestEncounter, Champion, QuestCategory, Tag, ChampionClass } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ArrowLeft, Save, Edit3, XCircle, Wand2, Loader2, ExternalLink } from "lucide-react";
import { createQuestEncounter, deleteQuestEncounter, updateQuestPlan, updateQuestEncounter } from "@/app/actions/quests";
import { autoFormatTipsAction } from "@/app/actions/ai-format-tips";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/comboboxes/MultiChampionCombobox";
import { MultiNodeModifierCombobox } from "@/components/comboboxes/MultiNodeModifierCombobox";
import { MultiTagCombobox } from "@/components/comboboxes/MultiTagCombobox";
import { NodeModifier, QuestEncounterNode } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { cn } from "@/lib/utils";

// We'll define a simpler type for now based on what we included in page.tsx
type EncounterNodeWithRelations = QuestEncounterNode & {
    nodeModifier: NodeModifier;
};

type EncounterWithRelations = QuestEncounter & {
    defender: Champion | null;
    recommendedChampions: Champion[];
    nodes: EncounterNodeWithRelations[];
};

type QuestWithRelations = QuestPlan & {
    category: QuestCategory | null;
    encounters: EncounterWithRelations[];
    requiredTags?: Tag[];
};

interface Props {
    initialQuest: QuestWithRelations;
    categories: QuestCategory[];
    tags: Tag[];
    champions: Champion[];
    nodeModifiers: NodeModifier[];
}

export default function AdminQuestBuilderClient({ initialQuest, categories, tags, champions, nodeModifiers }: Props) {
    const router = useRouter();

    const [editingEncounterId, setEditingEncounterId] = useState<string | null>(null);

    const [sequence, setSequence] = useState<string>(
        String((initialQuest.encounters.length > 0
            ? Math.max(...initialQuest.encounters.map(e => e.sequence))
            : 0) + 1)
    );
    const [defenderId, setDefenderId] = useState<string>("");
    const [tips, setTips] = useState<string>("");
    const [recommendedTags, setRecommendedTags] = useState<string[]>([]);
    const [recommendedChampionIds, setRecommendedChampionIds] = useState<number[]>([]);
    const [nodeModifierIds, setNodeModifierIds] = useState<string[]>([]);
    const [isFormattingTips, setIsFormattingTips] = useState(false);

    // Auto-update sequence when encounters change (after refresh)
    useEffect(() => {
        if (!editingEncounterId) {
            const nextSeq = (initialQuest.encounters.length > 0
                ? Math.max(...initialQuest.encounters.map(e => e.sequence))
                : 0) + 1;
            setSequence(String(nextSeq));
        }
    }, [initialQuest.encounters, editingEncounterId]);

    // Settings State
    const [title, setTitle] = useState(initialQuest.title);
    const [categoryId, setCategoryId] = useState(initialQuest.categoryId || "none");
    const [minStars, setMinStars] = useState(initialQuest.minStarLevel ? String(initialQuest.minStarLevel) : "");
    const [maxStars, setMaxStars] = useState(initialQuest.maxStarLevel ? String(initialQuest.maxStarLevel) : "");
    const [teamLimit, setTeamLimit] = useState(initialQuest.teamLimit !== null ? String(initialQuest.teamLimit) : "");
    const [requiredClasses, setRequiredClasses] = useState<ChampionClass[]>(initialQuest.requiredClasses || []);
    const [requiredTags, setRequiredTags] = useState<number[]>((initialQuest.requiredTags as Tag[])?.map(t => t.id) || []);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const AVAILABLE_CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MUTANT", "COSMIC", "TECH", "MYSTIC"];

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await updateQuestPlan({
                id: initialQuest.id,
                title,
                categoryId: categoryId === "none" ? null : categoryId,
                minStarLevel: minStars ? parseInt(minStars) : null,
                maxStarLevel: maxStars ? parseInt(maxStars) : null,
                teamLimit: teamLimit ? parseInt(teamLimit) : null,
                requiredClasses,
                requiredTagIds: requiredTags
            });
            alert("Settings saved successfully!");
        } catch (error: any) {
            console.error(error);
            alert(error.message || "Failed to save settings");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleAddOrUpdateEncounter = async () => {
        if (!sequence) return;

        try {
            if (editingEncounterId) {
                await updateQuestEncounter({
                    id: editingEncounterId,
                    questPlanId: initialQuest.id,
                    sequence: parseInt(sequence),
                    defenderId: defenderId ? parseInt(defenderId) : null,
                    tips: tips || null,
                    recommendedTagNames: recommendedTags,
                    recommendedChampionIds: recommendedChampionIds,
                    nodeModifierIds: nodeModifierIds
                });
            } else {
                await createQuestEncounter({
                    questPlanId: initialQuest.id,
                    sequence: parseInt(sequence),
                    defenderId: defenderId ? parseInt(defenderId) : undefined,
                    tips: tips || undefined,
                    recommendedTagNames: recommendedTags,
                    recommendedChampionIds: recommendedChampionIds,
                    nodeModifierIds: nodeModifierIds
                });
            }

            cancelEditing();
            router.refresh();
        } catch (error: any) {
            console.error(error);
            alert(error.message || `Failed to ${editingEncounterId ? 'update' : 'add'} encounter`);
        }
    };

    const startEditingEncounter = (encounter: EncounterWithRelations) => {
        setEditingEncounterId(encounter.id);
        setSequence(String(encounter.sequence));
        setDefenderId(encounter.defenderId ? String(encounter.defenderId) : "");
        setTips(encounter.tips || "");
        setRecommendedTags(encounter.recommendedTags);
        setRecommendedChampionIds(encounter.recommendedChampions?.map(c => c.id) || []);
        setNodeModifierIds(encounter.nodes?.map(n => n.nodeModifierId) || []);
    };

    const cancelEditing = () => {
        setEditingEncounterId(null);
        setSequence(String((initialQuest.encounters.length > 0 ? Math.max(...initialQuest.encounters.map(e => e.sequence)) : 0) + 1));
        setDefenderId("");
        setTips("");
        setRecommendedTags([]);
        setRecommendedChampionIds([]);
        setNodeModifierIds([]);
    };

    const handleDeleteEncounter = async (encounterId: string) => {
        if (!confirm("Remove this encounter?")) return;
        try {
            await deleteQuestEncounter(initialQuest.id, encounterId);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to delete encounter");
        }
    };

    const handleFormatTips = async () => {
        if (!tips || tips.trim() === "") return;
        setIsFormattingTips(true);
        try {
            const result = await autoFormatTipsAction(tips);
            if (result.success && result.formattedTips) {
                setTips(result.formattedTips);
            } else {
                alert(result.error || "Failed to format tips.");
            }
        } catch (error: any) {
            console.error(error);
            alert("An error occurred while formatting tips.");
        } finally {
            setIsFormattingTips(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" onClick={() => router.push('/admin/quests')}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Quests
                    </Button>
                    <h1 className="text-3xl font-bold">{initialQuest.title}</h1>
                </div>
                <Link href={`/planning/quests/${initialQuest.id}`}>
                    <Button variant="outline" className="border-sky-800 text-sky-400 hover:bg-sky-950/50 hover:text-sky-300">
                        <ExternalLink className="h-4 w-4 mr-2" /> View Plan
                    </Button>
                </Link>
            </div>

            <Card className="bg-slate-950/80 border-sky-900/50 shadow-lg shadow-sky-900/10">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">Global Quest Settings</CardTitle>
                    <CardDescription>Restrictions set here apply to the entire quest path.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        <div className="space-y-2">
                            <Label>Quest Title</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                        </div>
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <select
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="none">Uncategorized</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Team Limit</Label>
                            <select
                                value={teamLimit}
                                onChange={e => setTeamLimit(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="1">1 Champion</option>
                                <option value="3">3 Champions</option>
                                <option value="5">5 Champions</option>
                                <option value="">Infinite (Swaps)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Min Star Level</Label>
                            <Input type="number" value={minStars} onChange={e => setMinStars(e.target.value)} placeholder="e.g. 5" className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Star Level</Label>
                            <Input type="number" value={maxStars} onChange={e => setMaxStars(e.target.value)} placeholder="e.g. 7" className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                        <div className="space-y-3">
                            <Label>Required Classes (Any of the following)</Label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_CLASSES.map(cls => (
                                    <Badge
                                        key={cls}
                                        variant={requiredClasses.includes(cls) ? "default" : "outline"}
                                        className={requiredClasses.includes(cls) ? "bg-sky-600 cursor-pointer py-1.5 px-3" : "border-slate-700 text-slate-400 cursor-pointer py-1.5 px-3"}
                                        onClick={() => {
                                            if (requiredClasses.includes(cls)) {
                                                setRequiredClasses(requiredClasses.filter(c => c !== cls));
                                            } else {
                                                setRequiredClasses([...requiredClasses, cls]);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Image
                                                src={`/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`}
                                                alt={cls}
                                                width={18}
                                                height={18}
                                                className="object-contain"
                                            />
                                            {cls}
                                        </div>
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Required Tags (Any of the following)</Label>
                            <MultiTagCombobox
                                tags={tags}
                                values={requiredTags.map(id => tags.find(t => t.id === id)?.name || "").filter(Boolean)}
                                onSelect={(names) => setRequiredTags(names.map(name => tags.find(t => t.name === name)!.id))}
                                placeholder="Search tags..."
                            />
                            <p className="text-xs text-slate-500 mt-1">Select required tags for this quest path.</p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-sky-600 hover:bg-sky-500 text-white min-w-[150px] shadow-md shadow-sky-900/20 transition-all">
                            <Save className="mr-2 h-4 w-4" /> {isSavingSettings ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Create Encounter Form */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className={cn(
                        "bg-slate-950/50 border-slate-800 sticky top-24 transition-colors",
                        editingEncounterId ? "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : ""
                    )}>
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className={editingEncounterId ? "text-amber-400" : ""}>
                                    {editingEncounterId ? "Edit Fight/Encounter" : "Add Fight/Encounter"}
                                </CardTitle>
                                {editingEncounterId && (
                                    <Badge variant="outline" className="text-amber-400 border-amber-500/50 bg-amber-950/20">Editing</Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Sequence (Fight Number)</Label>
                                    <Input
                                        type="number"
                                        value={sequence}
                                        onChange={e => setSequence(e.target.value)}
                                        className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Defender</Label>
                                    <ChampionCombobox
                                        champions={champions as any}
                                        value={defenderId}
                                        onSelect={(id) => setDefenderId(id)}
                                        placeholder="Search..."
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 -mt-2">Leave defender empty to use a generic/unknown node.</p>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Quick Tips (Markdown supported)</Label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30"
                                        onClick={handleFormatTips}
                                        disabled={!tips || isFormattingTips}
                                    >
                                        {isFormattingTips ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1.5" />}
                                        Auto-Format (AI)
                                    </Button>
                                </div>
                                <Textarea
                                    value={tips}
                                    onChange={e => setTips(e.target.value)}
                                    placeholder="e.g. Bait SP1. Needs PURIFY champion."
                                    className="bg-slate-900 border-slate-800 min-h-[100px] focus-visible:ring-sky-500 resize-y"
                                />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800/50">
                                <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">Optional</Badge>
                                    Encounter Specifics
                                </h4>
                                <div className="space-y-2">
                                    <Label>Recommended Tags</Label>
                                    <MultiTagCombobox
                                        tags={tags}
                                        values={recommendedTags}
                                        onSelect={setRecommendedTags}
                                        placeholder="Search tags..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Recommended Champions</Label>
                                    <MultiChampionCombobox
                                        champions={champions as any}
                                        values={recommendedChampionIds}
                                        onSelect={setRecommendedChampionIds}
                                        placeholder="Search champions..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Node Modifiers</Label>
                                    <MultiNodeModifierCombobox
                                        modifiers={nodeModifiers}
                                        values={nodeModifierIds}
                                        onSelect={setNodeModifierIds}
                                        placeholder="Search nodes..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-800/50 mt-4">
                                <Button 
                                    onClick={handleAddOrUpdateEncounter} 
                                    className={cn(
                                        "flex-1 text-white shadow-md transition-all",
                                        editingEncounterId ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20" : "bg-sky-600 hover:bg-sky-500 shadow-sky-900/20"
                                    )} 
                                    disabled={!sequence}
                                >
                                    {editingEncounterId ? <><Save className="mr-2 h-4 w-4" /> Save Changes</> : <><Plus className="mr-2 h-4 w-4" /> Add Encounter</>}
                                </Button>
                                {editingEncounterId && (
                                    <Button onClick={cancelEditing} variant="outline" className="border-slate-700 hover:bg-slate-800 hover:text-slate-300">
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Existing Encounters */}
                <div className="lg:col-span-7 space-y-4">
                    <h2 className="text-2xl font-semibold mb-4">Path Timeline</h2>
                    {initialQuest.encounters.length === 0 ? (
                        <p className="text-muted-foreground italic bg-slate-950/50 p-6 rounded-xl border border-dashed border-slate-800 text-center">No encounters added to this quest yet. Start by adding a fight on the left.</p>
                    ) : (
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:via-slate-800 before:to-transparent">
                            {initialQuest.encounters.map((encounter: EncounterWithRelations, index: number) => {
                                const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as ChampionClass) : { border: "border-slate-700", text: "text-slate-300", bg: "bg-slate-900" };
                                return (
                                    <div key={encounter.id} className="relative flex items-center group is-active">
                                        {/* Timeline dot */}
                                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full border bg-slate-950 text-slate-300 shadow shrink-0 absolute left-0 transform -translate-x-1/2 font-bold z-10 border-slate-700 transition-colors group-hover:border-slate-500">
                                            {encounter.sequence}
                                        </div>

                                        {/* Card Content */}
                                        <Card
                                            className={cn(
                                                "w-[calc(100%-3rem)] ml-12 md:ml-16 bg-slate-950/80 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer",
                                                editingEncounterId === encounter.id ? "ring-1 ring-sky-500/50 border-sky-500/50 shadow-[0_0_15px_rgba(2,132,199,0.1)]" : ""
                                            )}
                                            onClick={() => startEditingEncounter(encounter)}
                                        >
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-4 w-full">
                                                    {encounter.defender ? (
                                                        <div className={cn("relative h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 border-2 shadow-sm", colors.border)}>
                                                            <Image
                                                                src={getChampionImageUrl(encounter.defender.images as any, "128")}
                                                                alt={encounter.defender.name}
                                                                fill
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="h-12 w-12 rounded-lg bg-slate-900 border-2 border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                                                            <span className="text-lg font-bold text-slate-500">?</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <CardTitle className={cn("text-lg", colors.text)}>
                                                            {encounter.defender ? encounter.defender.name : "Unknown Defender"}
                                                        </CardTitle>
                                                        {encounter.nodes && encounter.nodes.length > 0 && (
                                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                                {encounter.nodes.map((n) => (
                                                                    <Badge key={n.id} variant="secondary" className="text-[10px] py-0 h-4 bg-slate-900 border-slate-800 text-slate-400 font-normal">
                                                                        {n.nodeModifier.name}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteEncounter(encounter.id); }}
                                                    className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete Encounter"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </CardHeader>
                                            {encounter.tips && (
                                                <CardContent className="px-4 pb-4 pt-0">
                                                    <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                                                        <SimpleMarkdown content={encounter.tips} />
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

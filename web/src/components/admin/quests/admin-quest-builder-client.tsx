"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { QuestPlan, QuestEncounter, Champion as PrismaChampion, QuestCategory, Tag, ChampionClass, QuestPlanStatus, Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, ArrowLeft, Save, Edit3, XCircle, Wand2, Loader2, ExternalLink, ClipboardPaste, Eraser, Upload, Image as ImageIcon } from "lucide-react";
import { createQuestEncounter, deleteQuestEncounter, updateQuestPlan, updateQuestEncounter, clearRecommendedChampionsInQuest, uploadQuestBanner } from "@/app/actions/quests";
import { autoFormatTipsAction } from "@/app/actions/ai-format-tips";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/comboboxes/MultiChampionCombobox";
import { MultiNodeModifierCombobox } from "@/components/comboboxes/MultiNodeModifierCombobox";
import { MultiTagCombobox } from "@/components/comboboxes/MultiTagCombobox";
import { AsyncBotUserCombobox } from "@/components/comboboxes/AsyncBotUserCombobox";
import { NodeModifier, QuestEncounterNode } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { cn } from "@/lib/utils";
import { getQuestPlanById } from "@/app/actions/quests";
import { ChampionImages, Champion } from "@/types/champion";

type BaseQuestWithRelations = NonNullable<Prisma.PromiseReturnType<typeof getQuestPlanById>>;
type QuestWithRelations = Omit<BaseQuestWithRelations, 'creators'> & {
    creators: (BaseQuestWithRelations["creators"][0] & { name?: string })[];
};
type EncounterWithRelations = BaseQuestWithRelations["encounters"][0];
type EncounterNodeWithRelations = EncounterWithRelations["nodes"][0];
type CreatorRelation = QuestWithRelations["creators"][0];

interface Props {
    initialQuest: QuestWithRelations;
    categories: QuestCategory[];
    tags: Tag[];
    champions: Champion[];
    nodeModifiers: NodeModifier[];
}

export default function AdminQuestBuilderClient({ initialQuest, categories, tags, champions, nodeModifiers }: Props) {
    const router = useRouter();
    const { toast } = useToast();

    const [editingEncounterId, setEditingEncounterId] = useState<string | null>(null);

    const [sequence, setSequence] = useState<string>(
        String((initialQuest.encounters.length > 0
            ? Math.max(...initialQuest.encounters.map(e => e.sequence))
            : 0) + 1)
    );
    const [defenderId, setDefenderId] = useState<string>("");
    const [tips, setTips] = useState<string>("");
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [recommendedTags, setRecommendedTags] = useState<string[]>([]);
    const [encounterRequiredTagIds, setEncounterRequiredTagIds] = useState<number[]>([]);
    const [recommendedChampionIds, setRecommendedChampionIds] = useState<number[]>([]);
    const [nodeModifierIds, setNodeModifierIds] = useState<string[]>([]);
    const [isFormattingTips, setIsFormattingTips] = useState(false);

    // Bulk Paste states
    const [bulkChampionText, setBulkChampionText] = useState("");
    const [bulkNodeText, setBulkNodeText] = useState("");

    const handleBulkChampionParse = () => {
        const lines = bulkChampionText.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);
        const newIds = new Set<number>(recommendedChampionIds);
        let matchedCount = 0;

        lines.forEach(line => {
            const match = champions.find(c =>
                c.name.toLowerCase() === line ||
                (c.shortName && c.shortName.toLowerCase() === line)
            );
            if (match) {
                newIds.add(match.id);
                matchedCount++;
            }
        });

        setRecommendedChampionIds(Array.from(newIds));
        setBulkChampionText("");
        toast({
            title: "Bulk Parse Complete",
            description: `Matched ${matchedCount} champions from ${lines.length} lines.`,
            variant: matchedCount > 0 ? "default" : "destructive"
        });
    };

    const handleBulkNodeParse = () => {
        const lines = bulkNodeText.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);
        const newIds = new Set<string>(nodeModifierIds);
        let matchedCount = 0;

        lines.forEach(line => {
            const matches = nodeModifiers.filter(n => n.name.toLowerCase() === line || n.name.toLowerCase().startsWith(line) || n.name.toLowerCase().includes(line));
            if (matches.length === 1) {
                newIds.add(matches[0].id);
                matchedCount++;
            } else if (matches.length > 1) {
                const exactMatch = matches.find(n => n.name.toLowerCase() === line);
                if (exactMatch) {
                    newIds.add(exactMatch.id);
                    matchedCount++;
                } else {
                    toast({ title: "Ambiguous Match", description: `Multiple matches for '${line}'. Please select manually.`, variant: "destructive" });
                }
            }
        });

        setNodeModifierIds(Array.from(newIds));
        setBulkNodeText("");
        toast({
            title: "Bulk Parse Complete",
            description: `Matched ${matchedCount} nodes from ${lines.length} lines.`,
            variant: matchedCount > 0 ? "default" : "destructive"
        });
    };

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
    const [status, setStatus] = useState<QuestPlanStatus>(initialQuest.status);
    const [planVideoUrl, setPlanVideoUrl] = useState<string>(initialQuest.videoUrl || "");
    const [bannerUrl, setBannerUrl] = useState<string | null>(initialQuest.bannerUrl || null);
    const [bannerFit, setBannerFit] = useState<string>(initialQuest.bannerFit || "cover");
    const [bannerPosition, setBannerPosition] = useState<string>(initialQuest.bannerPosition || "center");
    const [categoryId, setCategoryId] = useState(initialQuest.categoryId || "none");
    const [minStars, setMinStars] = useState(initialQuest.minStarLevel ? String(initialQuest.minStarLevel) : "");
    const [maxStars, setMaxStars] = useState(initialQuest.maxStarLevel ? String(initialQuest.maxStarLevel) : "");
    const [teamLimit, setTeamLimit] = useState(initialQuest.teamLimit !== null ? String(initialQuest.teamLimit) : "");
    const [requiredClasses, setRequiredClasses] = useState<ChampionClass[]>(initialQuest.requiredClasses || []);
    const [requiredTags, setRequiredTags] = useState<number[]>((initialQuest.requiredTags as Tag[])?.map(t => t.id) || []);
    const [creatorIds, setCreatorIds] = useState<string[]>(initialQuest.creators?.map(c => c.id) || []);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const AVAILABLE_CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MUTANT", "COSMIC", "TECH", "MYSTIC"];

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await updateQuestPlan({
                id: initialQuest.id,
                title,
                status,
                videoUrl: planVideoUrl || null,
                bannerUrl,
                bannerFit,
                bannerPosition,
                categoryId: categoryId === "none" ? null : categoryId,
                minStarLevel: minStars ? parseInt(minStars) : null,
                maxStarLevel: maxStars ? parseInt(maxStars) : null,
                teamLimit: teamLimit ? parseInt(teamLimit) : null,
                requiredClasses,
                requiredTagIds: requiredTags,
                creatorIds
            });
            toast({ title: "Success", description: "Settings saved successfully!" });
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save settings";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const result = await uploadQuestBanner(initialQuest.id, formData);
            if (result.success && result.url) {
                setBannerUrl(result.url);
                toast({ title: "Success", description: "Banner uploaded successfully!" });
            }
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to upload banner";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsUploading(false);
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
                    videoUrl: videoUrl || null,
                    tips: tips || null,
                    recommendedTagNames: recommendedTags,
                    recommendedChampionIds: recommendedChampionIds,
                    requiredTagIds: encounterRequiredTagIds,
                    nodeModifierIds: nodeModifierIds
                });
            } else {
                await createQuestEncounter({
                    questPlanId: initialQuest.id,
                    sequence: parseInt(sequence),
                    defenderId: defenderId ? parseInt(defenderId) : undefined,
                    videoUrl: videoUrl || undefined,
                    tips: tips || undefined,
                    recommendedTagNames: recommendedTags,
                    recommendedChampionIds: recommendedChampionIds,
                    requiredTagIds: encounterRequiredTagIds,
                    nodeModifierIds: nodeModifierIds
                });
            }

            cancelEditing();
            router.refresh();
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : `Failed to ${editingEncounterId ? 'update' : 'add'} encounter`;
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const startEditingEncounter = (encounter: EncounterWithRelations) => {
        setEditingEncounterId(encounter.id);
        setSequence(String(encounter.sequence));
        setDefenderId(encounter.defenderId ? String(encounter.defenderId) : "");
        setTips(encounter.tips || "");
        setVideoUrl(encounter.videoUrl || "");
        setRecommendedTags(encounter.recommendedTags);
        setEncounterRequiredTagIds(encounter.requiredTags?.map(t => t.id) || []);
        setRecommendedChampionIds(encounter.recommendedChampions?.map(c => c.id) || []);
        setNodeModifierIds(encounter.nodes?.map(n => n.nodeModifierId) || []);
    };

    const cancelEditing = () => {
        setEditingEncounterId(null);
        setSequence(String((initialQuest.encounters.length > 0 ? Math.max(...initialQuest.encounters.map(e => e.sequence)) : 0) + 1));
        setDefenderId("");
        setTips("");
        setVideoUrl("");
        setRecommendedTags([]);
        setEncounterRequiredTagIds([]);
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
            toast({ title: "Error", description: "Failed to delete encounter", variant: "destructive" });
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
                toast({ title: "Error", description: result.error || "Failed to format tips.", variant: "destructive" });
            }
        } catch (error: unknown) {
            console.error(error);
            toast({ title: "Error", description: "An error occurred while formatting tips.", variant: "destructive" });
        } finally {
            setIsFormattingTips(false);
        }
    };

    const handleClearRecommended = async () => {
        if (!confirm("Are you sure you want to clear ALL recommended champions from every encounter in this quest? This cannot be undone.")) return;
        try {
            const res = await clearRecommendedChampionsInQuest(initialQuest.id);
            if (res.success) {
                toast({ title: "Success", description: "All recommended champions cleared." });
                router.refresh();
            }
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to clear recommendations";
            toast({ title: "Error", description: msg, variant: "destructive" });
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* General Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-4 w-1 bg-sky-500 rounded-full" />
                                <h4 className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">General Information</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Quest Title</Label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>YouTube Video URL (Main Guide)</Label>
                                    <Input 
                                        value={planVideoUrl} 
                                        onChange={e => setPlanVideoUrl(e.target.value)} 
                                        placeholder="https://www.youtube.com/watch?v=..." 
                                        className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <select
                                        value={status}
                                        onChange={e => setStatus(e.target.value as QuestPlanStatus)}
                                        className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="DRAFT">Draft (Hidden)</option>
                                        <option value="VISIBLE">Visible (All Players)</option>
                                        <option value="ARCHIVED">Archived</option>
                                    </select>
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
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Creators</Label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-2">
                                            {initialQuest.creators?.map(c => (
                                                <Badge key={c.id} variant="secondary" className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border-slate-800">
                                                    {c.discordId && ( // Just an indicator, the image isn't readily available without joining User, we will use BotUser directly for simplicity in the planner display
                                                        <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                                        </div>
                                                    )}
                                                    {/* In the admin builder, since we just have BotUser IDs, we rely on the parent component mapping or we show a generic tag.
                                                        To keep it simple, we just show the Discord ID or a placeholder if we didn't fetch the names. */}
                                                    <span>{c.name ? c.name : `Creator ${c.id.slice(-4)}`}</span>
                                                    <button onClick={() => setCreatorIds(creatorIds.filter(id => id !== c.id))} className="text-slate-500 hover:text-red-400 ml-1"><XCircle className="w-3 h-3" /></button>
                                                </Badge>
                                            ))}
                                            {/* For new additions, they won't show the name immediately without a refetch, but that's standard for this pattern without a complex local map. */}
                                            {creatorIds.filter(id => !initialQuest.creators?.find(c => c.id === id)).map(id => (
                                                <Badge key={id} variant="outline" className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/50 border-slate-700 border-dashed text-slate-400">
                                                    <span>New Creator</span>
                                                    <button onClick={() => setCreatorIds(creatorIds.filter(i => i !== id))} className="text-slate-500 hover:text-red-400 ml-1"><XCircle className="w-3 h-3" /></button>
                                                </Badge>
                                            ))}
                                        </div>
                                        <AsyncBotUserCombobox 
                                            value=""
                                            displayValue=""
                                            onSelect={(id) => {
                                                if (id && !creatorIds.includes(id)) {
                                                    setCreatorIds([...creatorIds, id]);
                                                }
                                            }}
                                            placeholder="Search to add creators..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requirements Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-4 w-1 bg-amber-500 rounded-full" />
                                <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Requirements & Limits</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                                    <Label>Min Stars</Label>
                                    <Input type="number" value={minStars} onChange={e => setMinStars(e.target.value)} placeholder="e.g. 5" className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Stars</Label>
                                    <Input type="number" value={maxStars} onChange={e => setMaxStars(e.target.value)} placeholder="e.g. 7" className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-800/50">
                        <Label className="mb-3 block text-slate-400 uppercase tracking-widest text-[10px] font-bold">Quest Banner Asset</Label>
                                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                                    <div className="relative group w-full md:w-80 aspect-[21/9] rounded-xl overflow-hidden border-2 border-slate-800 bg-slate-900 shadow-inner flex items-center justify-center">
                                                        {bannerUrl ? (
                                                            <>
                                                                <Image 
                                                                    src={bannerUrl.replace(/#/g, '%23')} 
                                                                    alt="Quest Banner" 
                                                                    fill 
                                                                    className={cn(
                                                                        bannerFit === "cover" ? "object-cover" : "object-contain",
                                                                        bannerPosition === "top" ? "object-top" : bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                                                    )} 
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                    <Button variant="secondary" size="sm" onClick={() => setBannerUrl(null)} className="bg-red-600 hover:bg-red-500 text-white border-none h-8">
                                                                        <XCircle className="w-4 h-4 mr-2" /> Remove
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 text-slate-600">
                                                                <ImageIcon className="w-8 h-8 opacity-20" />
                                                                <span className="text-xs font-medium">No banner assigned</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex-1 space-y-4">
                                                        <div className="space-y-1">
                                                            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                                                                Upload a banner for this quest plan. Recommended ratio: 21:9.
                                                            </p>
                                                            <div className="flex flex-wrap gap-3 pt-1">
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] text-slate-500 uppercase">Image Fit</Label>
                                                                    <select 
                                                                        value={bannerFit} 
                                                                        onChange={e => setBannerFit(e.target.value)}
                                                                        className="block w-28 h-8 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:ring-1 focus:ring-sky-500"
                                                                    >
                                                                        <option value="cover">Zoom (Cover)</option>
                                                                        <option value="contain">Whole (Contain)</option>
                                                                    </select>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] text-slate-500 uppercase">Position</Label>
                                                                    <select 
                                                                        value={bannerPosition} 
                                                                        onChange={e => setBannerPosition(e.target.value)}
                                                                        className="block w-28 h-8 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:ring-1 focus:ring-sky-500"
                                                                    >
                                                                        <option value="top">Top</option>
                                                                        <option value="center">Center</option>
                                                                        <option value="bottom">Bottom</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                        
                                                        <div className="flex gap-2 pt-1">
                                                            <label className={cn(
                                                                "cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-all shadow-sm",
                                                                isUploading && "opacity-50 cursor-not-allowed"
                                                            )}>
                                                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                                {isUploading ? "Upload" : "Upload Image"}
                                                                <input type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} disabled={isUploading} />
                                                            </label>
                                                            
                                                                                                <div className="relative flex-1 max-w-sm">
                                                                                                    <Input 
                                                                                                        placeholder="Or paste external URL..." 
                                                                                                        value={bannerUrl || ""} 
                                                                                                        onChange={(e) => setBannerUrl(e.target.value.trim() === "" ? null : e.target.value)}
                                                                                                        className="h-10 bg-slate-950 border-slate-800 text-xs pr-10"
                                                                                                    />
                                                                                                    {bannerUrl && (
                                                                                                        <button onClick={() => setBannerUrl(null)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                                                                                            <XCircle className="w-3.5 h-3.5" />
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>                                                        </div>
                                                    </div>
                                                </div>                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 mt-6 border-t border-slate-800/50">
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
                                onSelect={(names) => setRequiredTags(names.map(name => {
                                    const foundTag = tags.find(t => t.name === name);
                                    return foundTag ? foundTag.id : undefined;
                                }).filter((id): id is number => id !== undefined))}
                                placeholder="Search tags..."
                            />
                            <p className="text-xs text-slate-500 mt-1">Select required tags for this quest path.</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <Button
                            variant="outline"
                            onClick={handleClearRecommended}
                            className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                        >
                            <Eraser className="mr-2 h-4 w-4" /> Clear All Recommendations
                        </Button>
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
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sky-400 font-bold">Defender</Label>
                                    <ChampionCombobox
                                        champions={champions}
                                        value={defenderId}
                                        onSelect={(id) => setDefenderId(id)}
                                        placeholder="Search champions..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sequence (Fight Number)</Label>
                                    <Input
                                        type="number"
                                        value={sequence}
                                        onChange={e => setSequence(e.target.value)}
                                        className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500"
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>YouTube Video URL (Fight Specific)</Label>
                                    <Input 
                                        value={videoUrl} 
                                        onChange={e => setVideoUrl(e.target.value)} 
                                        placeholder="https://www.youtube.com/watch?v=..." 
                                        className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" 
                                    />
                                </div>
                            </div>

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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Required Tags</Label>
                                        <MultiTagCombobox
                                            tags={tags}
                                            values={encounterRequiredTagIds.map(id => tags.find(t => t.id === id)?.name || "").filter(Boolean)}
                                            onSelect={(names) => setEncounterRequiredTagIds(names.map(name => {
                                                const foundTag = tags.find(t => t.name === name);
                                                return foundTag ? foundTag.id : undefined;
                                            }).filter((id): id is number => id !== undefined))}
                                            placeholder="Required for this fight..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Recommended Tags</Label>
                                        <MultiTagCombobox
                                            tags={tags}
                                            values={recommendedTags}
                                            onSelect={setRecommendedTags}
                                            placeholder="Recommended for this fight..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Recommended Champions</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-slate-400 hover:text-sky-400">
                                                    <ClipboardPaste className="w-3 h-3 mr-1" /> Bulk Paste
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-3 bg-slate-950 border-slate-800" align="end">
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-sm leading-none">Bulk Paste Champions</h4>
                                                    <p className="text-xs text-slate-500">Paste a list of champion names, one per line.</p>
                                                    <Textarea
                                                        value={bulkChampionText}
                                                        onChange={(e) => setBulkChampionText(e.target.value)}
                                                        placeholder="e.g.&#10;Hercules&#10;Hulkling&#10;Kitty Pryde"
                                                        className="h-32 text-xs bg-slate-900 border-slate-800"
                                                    />
                                                    <Button size="sm" className="w-full bg-sky-600 hover:bg-sky-500 text-white" onClick={handleBulkChampionParse}>Parse & Add</Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <MultiChampionCombobox
                                        champions={champions}
                                        values={recommendedChampionIds}
                                        onSelect={setRecommendedChampionIds}
                                        placeholder="Search champions..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Node Modifiers</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-slate-400 hover:text-sky-400">
                                                    <ClipboardPaste className="w-3 h-3 mr-1" /> Bulk Paste
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-3 bg-slate-950 border-slate-800" align="end">
                                                <div className="space-y-2">
                                                    <h4 className="font-medium text-sm leading-none">Bulk Paste Node Modifiers</h4>
                                                    <p className="text-xs text-slate-500">Paste a list of node modifiers, one per line.</p>
                                                    <Textarea
                                                        value={bulkNodeText}
                                                        onChange={(e) => setBulkNodeText(e.target.value)}
                                                        placeholder="e.g.&#10;Stun Immunity&#10;Bleed Vulnerability"
                                                        className="h-32 text-xs bg-slate-900 border-slate-800"
                                                    />
                                                    <Button size="sm" className="w-full bg-sky-600 hover:bg-sky-500 text-white" onClick={handleBulkNodeParse}>Parse & Add</Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
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
                                                                src={getChampionImageUrl(encounter.defender.images, "128")}
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
                                                        {(encounter.requiredTags?.length > 0 || encounter.recommendedTags?.length > 0) && (
                                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                                {encounter.requiredTags?.map((t: Tag) => (
                                                                    <Badge key={t.id} variant="outline" className="text-[9px] py-0 h-3.5 bg-red-950/20 border-red-900/30 text-red-400 font-bold uppercase tracking-tighter">
                                                                        REQ: {t.name}
                                                                    </Badge>
                                                                ))}
                                                                {encounter.recommendedTags?.map((tag: string) => (
                                                                    <Badge key={tag} variant="outline" className="text-[9px] py-0 h-3.5 bg-amber-950/20 border-amber-800/30 text-amber-400 font-bold uppercase tracking-tighter">
                                                                        REC: {tag}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {encounter.videoUrl && (
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <div className="h-4 w-4 rounded-full bg-red-600/20 flex items-center justify-center">
                                                                    <div className="h-2 w-2 bg-red-600 rounded-full" />
                                                                </div>
                                                                <span className="text-[10px] text-slate-500 font-medium italic">Video guide linked</span>
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

                                            {(encounter.tips || (encounter.recommendedChampions && encounter.recommendedChampions.length > 0)) && (
                                                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                                                    {encounter.recommendedChampions && encounter.recommendedChampions.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 pb-1">
                                                            {encounter.recommendedChampions.map((champ) => {
                                                                const champColors = getChampionClassColors(champ.class as ChampionClass);
                                                                return (
                                                                    <div
                                                                        key={champ.id}
                                                                        className={cn("relative h-8 w-8 rounded-full overflow-hidden border-2 shadow-sm ring-1 ring-slate-950/50", champColors.border)}
                                                                        title={champ.name}
                                                                    >
                                                                        <Image
                                                                            src={getChampionImageUrl(champ.images, "64")}
                                                                            alt={champ.name}
                                                                            fill
                                                                            className="object-cover"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {encounter.tips && (
                                                        <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
                                                            <SimpleMarkdown content={encounter.tips} />
                                                        </div>
                                                    )}
                                                </CardContent>
                                            )}                                        </Card>
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

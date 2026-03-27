"use client";

import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createQuestEncounter, deleteQuestEncounter, updateQuestPlan, updateQuestEncounter, clearRecommendedChampionsInQuest, uploadQuestBanner, updateFeaturedPlayers, reorderQuestEncounters, bulkCreateQuestEncounters, bulkImportNodeModifiersFromJson, BulkNodeImportResult } from "@/app/actions/quests";
import { autoFormatTipsAction } from "@/app/actions/ai-format-tips";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ExternalLink,
    XCircle, ImageIcon, Loader2, Upload, Eraser, Save, Wand2,
    ClipboardPaste, Plus, Trash2, LayoutList, SlidersHorizontal, FileStack,
    Info, ShieldAlert, Users, Tag as TagIcon, EyeOff, Eye, Archive, Check
} from "lucide-react";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/comboboxes/MultiChampionCombobox";
import { MultiNodeModifierCombobox } from "@/components/comboboxes/MultiNodeModifierCombobox";
import { MultiTagCombobox } from "@/components/comboboxes/MultiTagCombobox";
import { AsyncBotUserCombobox } from "@/components/comboboxes/AsyncBotUserCombobox";
import { AsyncPlayerSearchCombobox } from "@/components/comboboxes/AsyncPlayerSearchCombobox";
import { NodeModifier, QuestEncounterNode } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { getChampionImageUrl, getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { getChampionClassColors } from "@/lib/championClassHelper";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { cn } from "@/lib/utils";
import { getQuestPlanById } from "@/app/actions/quests";
import { ChampionImages, Champion } from "@/types/champion";

type BaseQuestWithRelations = NonNullable<Prisma.PromiseReturnType<typeof getQuestPlanById>>;
export type QuestWithRelations = Omit<BaseQuestWithRelations, 'creators'> & {
    creators: (BaseQuestWithRelations["creators"][0] & { name?: string })[];
    playerPlans: any[]; // Manual bypass for Prisma relation inference
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

    const defaultSequence = String((initialQuest.encounters.length > 0
        ? Math.max(...initialQuest.encounters.map(e => e.sequence))
        : 0) + 1);

    const [sequence, setSequence] = useState<string>(defaultSequence);

    useEffect(() => {
        if (!editingEncounterId) {
            setSequence(defaultSequence);
        }
    }, [editingEncounterId, defaultSequence]);

    const [defenderId, setDefenderId] = useState<string>("");
    const [tips, setTips] = useState<string>("");
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [videos, setVideos] = useState<{ videoUrl: string, playerId: string | null, playerName: string | null, playerAvatar: string | null }[]>([]);
    const [recommendedTags, setRecommendedTags] = useState<string[]>([]);
    const [encounterRequiredTagIds, setEncounterRequiredTagIds] = useState<number[]>([]);
    const [recommendedChampionIds, setRecommendedChampionIds] = useState<number[]>([]);
    const [nodeModifierIds, setNodeModifierIds] = useState<string[]>([]);
    const [isFormattingTips, setIsFormattingTips] = useState(false);

    // Bulk Add Encounters
    const [bulkEncountersText, setBulkEncountersText] = useState("");
    const [isBulkAdding, setIsBulkAdding] = useState(false);

    // Bulk Import Node Modifiers
    const [bulkNodeImportTab, setBulkNodeImportTab] = useState<"encounters" | "nodes">("encounters");
    const [bulkNodeJsonText, setBulkNodeJsonText] = useState("");
    const [isBulkNodeImporting, setIsBulkNodeImporting] = useState(false);
    const [bulkNodeImportResults, setBulkNodeImportResults] = useState<BulkNodeImportResult[] | null>(null);

    const bulkImportPreview = useMemo(() => {
        const lines = bulkEncountersText.split("\n").map((l) => l.trim()).filter(Boolean);
        let matched = 0;
        for (const line of lines) {
            const hit = champions.find(
                (c) =>
                    c.name.toLowerCase() === line.toLowerCase() ||
                    (c.shortName && c.shortName.toLowerCase() === line.toLowerCase())
            );
            if (hit) matched++;
        }
        return { total: lines.length, matched, unmatched: lines.length - matched };
    }, [bulkEncountersText, champions]);

    const sortedPathEncounters = useMemo(
        () => [...initialQuest.encounters].sort((a, b) => a.sequence - b.sequence),
        [initialQuest.encounters]
    );

    const editingEncounterIndex = editingEncounterId
        ? sortedPathEncounters.findIndex((e) => e.id === editingEncounterId)
        : -1;

    const pathNavDisabled = sortedPathEncounters.length === 0;

    const handleBulkEncounterParse = async () => {
        const lines = bulkEncountersText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const defenderIds: (number | null)[] = lines.map(line => {
            const match = champions.find(c =>
                c.name.toLowerCase() === line.toLowerCase() ||
                (c.shortName && c.shortName.toLowerCase() === line.toLowerCase())
            );
            return match ? match.id : null;
        });

        const startSeq = parseInt(defaultSequence, 10);
        if (Number.isNaN(startSeq)) {
            toast({ title: "Error", description: "Could not determine the next sequence number. Add or refresh encounters first.", variant: "destructive" });
            return;
        }

        setIsBulkAdding(true);
        try {
            const res = await bulkCreateQuestEncounters(initialQuest.id, defenderIds, startSeq);
            if (res.success) {
                const unmatched = defenderIds.filter((id) => id === null).length;
                toast({
                    title: "Success",
                    description:
                        unmatched > 0
                            ? `Added ${res.count} encounters (${unmatched} without a matched defender — edit those rows to assign champions).`
                            : `Added ${res.count} encounters.`,
                });
                setBulkEncountersText("");
                router.refresh();
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to bulk add", variant: "destructive" });
        } finally {
            setIsBulkAdding(false);
        }
    };

    const handleBulkNodeImport = async () => {
        if (!bulkNodeJsonText.trim()) return;
        setIsBulkNodeImporting(true);
        setBulkNodeImportResults(null);
        try {
            const res = await bulkImportNodeModifiersFromJson(initialQuest.id, bulkNodeJsonText.trim());
            if (res.success) {
                setBulkNodeImportResults(res.results);
                const totalEncountersCreated = res.results.filter(r => r.encounterCreated).length;
                const totalNodesCreated = res.results.reduce((s, r) => s + r.nodesCreated, 0);
                const totalNodesLinked = res.results.reduce((s, r) => s + r.nodesLinked, 0);
                toast({
                    title: "Import complete",
                    description: `${res.results.length} champions processed. ${totalEncountersCreated} new encounters created. ${totalNodesLinked} nodes linked, ${totalNodesCreated} nodes created.`,
                });
                router.refresh();
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to import node modifiers", variant: "destructive" });
        } finally {
            setIsBulkNodeImporting(false);
        }
    };

    // Keep handler refs up-to-date each render to avoid stale closures in the keyboard effect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddOrUpdateEncounterRef = useRef<() => Promise<void>>(null as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSaveSettingsRef = useRef<() => Promise<void>>(null as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cancelEditingRef = useRef<() => void>(null as any);
    useEffect(() => {
        handleAddOrUpdateEncounterRef.current = handleAddOrUpdateEncounter;
        handleSaveSettingsRef.current = handleSaveSettings;
        cancelEditingRef.current = cancelEditing;
        saveEncounterChangesRef.current = saveEncounterChanges;
    });

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Save shortcut (Cmd/Ctrl + S)
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (editingEncounterId) {
                    handleAddOrUpdateEncounterRef.current();
                } else {
                    handleSaveSettingsRef.current();
                }
            }

            // New Encounter shortcut (N)
            if (e.key === 'n' && !editingEncounterId &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                const defenderInput = document.getElementById('defender-search-input') as HTMLInputElement;
                defenderInput?.focus();
            }

            // Cancel editing (Esc)
            if (e.key === 'Escape' && editingEncounterId) {
                cancelEditingRef.current();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingEncounterId]);

    // Autosave — fires 1.5s after any encounter field changes while in edit mode
    useEffect(() => {
        // When the encounter being edited changes, reset the ref and cancel pending saves
        if (encIdForAutoSaveRef.current !== editingEncounterId) {
            encIdForAutoSaveRef.current = editingEncounterId;
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            setSaveStatus('idle');
            return;
        }
        if (!editingEncounterId) return;

        // A field changed while editing the same encounter — schedule autosave
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        setSaveStatus('unsaved');
        autoSaveTimerRef.current = setTimeout(() => {
            saveEncounterChangesRef.current?.();
        }, 1500);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingEncounterId, defenderId, tips, videoUrl, videos, recommendedTags, encounterRequiredTagIds, recommendedChampionIds, nodeModifierIds, sequence]);

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
            const lowerLine = line.toLowerCase();
            const matches = nodeModifiers.filter(n => {
                const name = n.name.toLowerCase();
                // Exact
                if (name === lowerLine) return true;
                // Prefix
                if (name.startsWith(lowerLine)) return true;
                // Word boundary substring
                const wordRegex = new RegExp(`\\b${lowerLine}\\b`, 'i');
                if (wordRegex.test(name)) return true;
                // Regular substring fallback
                return name.includes(lowerLine);
            });

            if (matches.length === 0) return;

            // Prefer order: Exact > Prefix > Word Match > Substring
            const exactMatch = matches.find(n => n.name.toLowerCase() === lowerLine);
            if (exactMatch) {
                newIds.add(exactMatch.id);
                matchedCount++;
                return;
            }

            const prefixMatches = matches.filter(n => n.name.toLowerCase().startsWith(lowerLine));
            if (prefixMatches.length === 1) {
                newIds.add(prefixMatches[0].id);
                matchedCount++;
                return;
            }

            // Word Boundary
            const wordMatches = matches.filter(n => new RegExp(`\\b${lowerLine}\\b`, 'i').test(n.name));
            if (wordMatches.length === 1) {
                newIds.add(wordMatches[0].id);
                matchedCount++;
                return;
            }

            // If we have multiple substring matches or prefix matches, it's ambiguous
            if (matches.length > 1) {
                toast({ title: "Ambiguous Match", description: `Multiple matches for '${line}'. Please select manually.`, variant: "destructive" });
            } else if (matches.length === 1) {
                newIds.add(matches[0].id);
                matchedCount++;
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

    const effectiveSequence = sequence;

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
    const [featuredPlayers, setFeaturedPlayers] = useState<{id: string, name: string, avatar: string | null}[]>(
        (initialQuest?.playerPlans || [])
            .filter((p: any) => p.player?.id)
            .map((p: any) => ({
                id: p.player.id,
                name: p.player.ingameName || "Unknown",
                avatar: p.player.avatar || null
            }))
    );
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Autosave state & refs for the encounter editor
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const encIdForAutoSaveRef = useRef<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saveEncounterChangesRef = useRef<() => Promise<void>>(null as any);

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
            try {
                await updateFeaturedPlayers(initialQuest.id, featuredPlayers.map(p => p.id));
                toast({ title: "Success", description: "Settings saved successfully!" });
            } catch (error: unknown) {
                console.error(error);
                const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to update featured players";
                toast({
                    title: "Partial Success",
                    description: `Settings saved but featured players update failed: ${msg}`,
                    variant: "destructive"
                });
            }
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save settings";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleBannerUpload = async (e: ChangeEvent<HTMLInputElement>) => {
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

    const handleMoveEncounter = async (encounterId: string, direction: 'up' | 'down') => {
        const encounters = [...initialQuest.encounters].sort((a, b) => a.sequence - b.sequence);
        const currentIndex = encounters.findIndex(e => e.id === encounterId);
        
        try {
            if (direction === 'up' && currentIndex > 0) {
                const newEncounters = [...encounters];
                [newEncounters[currentIndex - 1], newEncounters[currentIndex]] = [newEncounters[currentIndex], newEncounters[currentIndex - 1]];
                await reorderQuestEncounters(initialQuest.id, newEncounters.map(e => e.id));
                router.refresh();
                toast({ title: "Success", description: "Encounter moved up" });
            } else if (direction === 'down' && currentIndex < encounters.length - 1) {
                const newEncounters = [...encounters];
                [newEncounters[currentIndex + 1], newEncounters[currentIndex]] = [newEncounters[currentIndex], newEncounters[currentIndex + 1]];
                await reorderQuestEncounters(initialQuest.id, newEncounters.map(e => e.id));
                router.refresh();
                toast({ title: "Success", description: "Encounter moved down" });
            }
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to reorder encounters";
            toast({ title: "Error", description: `Failed to reorder encounter: ${msg}`, variant: "destructive" });
        }
    };

    // Saves the currently-editing encounter without canceling edit mode (used by autosave + manual save)
    const saveEncounterChanges = async () => {
        if (!editingEncounterId || !effectiveSequence) return;
        setSaveStatus('saving');
        try {
            await updateQuestEncounter({
                id: editingEncounterId,
                questPlanId: initialQuest.id,
                sequence: parseInt(effectiveSequence),
                defenderId: defenderId ? parseInt(defenderId) : null,
                videoUrl: videoUrl || null,
                videos: videos.map(v => ({ videoUrl: v.videoUrl, playerId: v.playerId })),
                tips: tips || null,
                recommendedTagNames: recommendedTags,
                recommendedChampionIds: recommendedChampionIds,
                requiredTagIds: encounterRequiredTagIds,
                nodeModifierIds: nodeModifierIds
            });
            router.refresh();
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2500);
        } catch (error: unknown) {
            console.error(error);
            setSaveStatus('idle');
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to save encounter";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const handleAddOrUpdateEncounter = async () => {
        if (!effectiveSequence) return;

        if (editingEncounterId) {
            // Flush any pending debounce and save immediately
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            await saveEncounterChanges();
        } else {
            try {
                await createQuestEncounter({
                    questPlanId: initialQuest.id,
                    sequence: parseInt(effectiveSequence),
                    defenderId: defenderId ? parseInt(defenderId) : undefined,
                    videoUrl: videoUrl || undefined,
                    videos: videos.map(v => ({ videoUrl: v.videoUrl, playerId: v.playerId })),
                    tips: tips || undefined,
                    recommendedTagNames: recommendedTags,
                    recommendedChampionIds: recommendedChampionIds,
                    requiredTagIds: encounterRequiredTagIds,
                    nodeModifierIds: nodeModifierIds
                });
                cancelEditing();
                router.refresh();
            } catch (error: unknown) {
                console.error(error);
                const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to add encounter";
                toast({ title: "Error", description: msg, variant: "destructive" });
            }
        }
    };

    const startEditingEncounter = (
        encounter: EncounterWithRelations,
        options?: { scrollTimeline?: boolean }
    ) => {
        setEditingEncounterId(encounter.id);
        setSequence(String(encounter.sequence));
        setDefenderId(encounter.defenderId ? String(encounter.defenderId) : "");
        setTips(encounter.tips || "");
        setVideoUrl(encounter.videoUrl || "");
        setVideos((encounter as any).videos?.map((v: any) => ({
            videoUrl: v.videoUrl,
            playerId: v.playerId,
            playerName: v.player?.ingameName || null,
            playerAvatar: v.player?.avatar || null
        })) || []);
        setRecommendedTags(encounter.recommendedTags);
        setEncounterRequiredTagIds(encounter.requiredTags?.map(t => t.id) || []);
        setRecommendedChampionIds(encounter.recommendedChampions?.map(c => c.id) || []);
        setNodeModifierIds(encounter.nodes?.map(n => n.nodeModifierId) || []);
        
        setTimeout(() => {
            const el = document.getElementById("encounter-editor");
            if (el) {
                const yOffset = -80;
                const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
            if (options?.scrollTimeline && window.matchMedia('(min-width: 1024px)').matches) {
                document
                    .getElementById(`admin-timeline-encounter-${encounter.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    };

    // Flush pending debounced autosave before navigating away from the current encounter
    const flushAutoSave = async () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        if (editingEncounterId && saveStatus === 'unsaved') {
            await saveEncounterChangesRef.current?.();
        }
    };

    const goToPreviousPathEncounter = async () => {
        if (pathNavDisabled) return;
        await flushAutoSave();
        if (editingEncounterIndex === -1) {
            startEditingEncounter(sortedPathEncounters[sortedPathEncounters.length - 1], { scrollTimeline: true });
            return;
        }
        if (editingEncounterIndex === 0) {
            cancelEditing();
            return;
        }
        startEditingEncounter(sortedPathEncounters[editingEncounterIndex - 1], { scrollTimeline: true });
    };

    const goToNextPathEncounter = async () => {
        if (pathNavDisabled) return;
        await flushAutoSave();
        if (editingEncounterIndex === -1) {
            startEditingEncounter(sortedPathEncounters[0], { scrollTimeline: true });
            return;
        }
        if (editingEncounterIndex === sortedPathEncounters.length - 1) {
            cancelEditing();
            return;
        }
        startEditingEncounter(sortedPathEncounters[editingEncounterIndex + 1], { scrollTimeline: true });
    };

    const cancelEditing = () => {
        setEditingEncounterId(null);
        setSequence(defaultSequence);
        setDefenderId("");
        setTips("");
        setVideoUrl("");
        setVideos([]);
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

            <Tabs defaultValue="path" className="w-full space-y-6 overflow-visible">
                <TabsList className="grid w-full max-w-lg grid-cols-2 bg-slate-950/90 border border-slate-800 p-1 h-11">
                    <TabsTrigger
                        value="path"
                        className="gap-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md"
                    >
                        <LayoutList className="h-4 w-4 shrink-0 opacity-90" />
                        {"Path & encounters"}
                    </TabsTrigger>
                    <TabsTrigger
                        value="settings"
                        className="gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-sky-200 data-[state=active]:shadow-md rounded-md"
                    >
                        <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-90" />
                        Quest settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="mt-6 space-y-4 outline-none focus-visible:outline-none pb-24">

                    {/* General Information */}
                    <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                        <div className="h-0.5 w-full bg-sky-500" />
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2.5 text-base">
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20">
                                    <Info className="w-4 h-4 text-sky-400" />
                                </div>
                                General Information
                            </CardTitle>
                            <CardDescription>Basic details and visibility for this quest plan.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label className="text-slate-300">Quest Title</Label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label className="text-slate-300">YouTube Video URL <span className="text-slate-500 font-normal">(Main Guide)</span></Label>
                                    <Input
                                        value={planVideoUrl}
                                        onChange={e => setPlanVideoUrl(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Status</Label>
                                    <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1 gap-1">
                                        {([
                                            { value: "DRAFT", label: "Draft", icon: EyeOff, activeClass: "bg-slate-700 text-slate-200 shadow-sm" },
                                            { value: "VISIBLE", label: "Visible", icon: Eye, activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-900/40" },
                                            { value: "ARCHIVED", label: "Archived", icon: Archive, activeClass: "bg-orange-700 text-white shadow-sm shadow-orange-900/40" },
                                        ] as const).map(({ value: v, label, icon: Icon, activeClass }) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setStatus(v as QuestPlanStatus)}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all",
                                                    status === v ? activeClass : "text-slate-500 hover:text-slate-300"
                                                )}
                                            >
                                                <Icon className="w-3.5 h-3.5" />{label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Category</Label>
                                    <select
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="none">Uncategorized</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Requirements & Limits */}
                    <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                        <div className="h-0.5 w-full bg-amber-500" />
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2.5 text-base">
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                                </div>
                                Requirements &amp; Limits
                            </CardTitle>
                            <CardDescription>Roster and champion constraints applied globally across all encounters.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Team Limit</Label>
                                    <select
                                        value={teamLimit}
                                        onChange={e => setTeamLimit(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="1">1 Champion</option>
                                        <option value="3">3 Champions</option>
                                        <option value="5">5 Champions</option>
                                        <option value="">Infinite (Swaps)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Min Stars</Label>
                                    <Input type="number" value={minStars} onChange={e => setMinStars(e.target.value)} placeholder="e.g. 5" className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Max Stars</Label>
                                    <Input type="number" value={maxStars} onChange={e => setMaxStars(e.target.value)} placeholder="e.g. 7" className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Authors & Featured */}
                    <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                        <div className="h-0.5 w-full bg-indigo-500" />
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2.5 text-base">
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                    <Users className="w-4 h-4 text-indigo-400" />
                                </div>
                                Authors &amp; Featured Players
                            </CardTitle>
                            <CardDescription>Credit creators and spotlight featured player builds.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Creators</Label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap gap-2 min-h-[28px]">
                                        {creatorIds.map(id => {
                                            const existingCreator = initialQuest.creators?.find(c => c.id === id);
                                            return (
                                                <Badge key={id} variant={existingCreator ? "secondary" : "outline"} className={cn("flex items-center gap-1.5 px-2 py-1 bg-slate-900", !existingCreator && "bg-slate-900/50 border-slate-700 border-dashed text-slate-400")}>
                                                    {existingCreator?.discordId && (
                                                        <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                                        </div>
                                                    )}
                                                    <span>{existingCreator ? (existingCreator.name || `Creator ${id.slice(-4)}`) : "New Creator"}</span>
                                                    <button onClick={() => setCreatorIds(creatorIds.filter(i => i !== id))} className="text-slate-500 hover:text-red-400 ml-1"><XCircle className="w-3 h-3" /></button>
                                                </Badge>
                                            );
                                        })}
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
                            <div className="h-px bg-slate-800/60" />
                            <div className="space-y-2">
                                <Label className="text-slate-300">Featured Players</Label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap gap-2 min-h-[28px]">
                                        {featuredPlayers.map(p => (
                                            <Badge key={p.id} variant="outline" className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border-amber-500/30 text-slate-300">
                                                {p.avatar ? (
                                                    <div className="w-4 h-4 rounded-full overflow-hidden bg-slate-800">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-500">
                                                        {p.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span>{p.name}</span>
                                                <button onClick={() => setFeaturedPlayers(featuredPlayers.filter(x => x.id !== p.id))} className="text-slate-500 hover:text-red-400 ml-1"><XCircle className="w-3 h-3" /></button>
                                            </Badge>
                                        ))}
                                    </div>
                                    <AsyncPlayerSearchCombobox
                                        value=""
                                        onSelect={(id, name, avatar) => {
                                            if (id && !featuredPlayers.some(p => p.id === id)) {
                                                setFeaturedPlayers([...featuredPlayers, { id, name, avatar }]);
                                            }
                                        }}
                                        placeholder="Search to feature a player's plan..."
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Banner */}
                    <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                        <div className="h-0.5 w-full bg-slate-500" />
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2.5 text-base">
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700/60 border border-slate-700">
                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                </div>
                                Quest Banner
                            </CardTitle>
                            <CardDescription>Displayed at the top of the quest plan page. Recommended ratio: 21:9.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="relative group w-full md:w-80 aspect-[21/9] rounded-xl overflow-hidden border-2 border-slate-800 bg-slate-900 shadow-inner flex items-center justify-center flex-shrink-0">
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
                                    <div className="flex flex-wrap gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Image Fit</Label>
                                            <select
                                                value={bannerFit}
                                                onChange={e => setBannerFit(e.target.value)}
                                                className="block w-32 h-9 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-300 focus:ring-1 focus:ring-sky-500"
                                            >
                                                <option value="cover">Zoom (Cover)</option>
                                                <option value="contain">Whole (Contain)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase tracking-widest">Position</Label>
                                            <select
                                                value={bannerPosition}
                                                onChange={e => setBannerPosition(e.target.value)}
                                                className="block w-28 h-9 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-300 focus:ring-1 focus:ring-sky-500"
                                            >
                                                <option value="top">Top</option>
                                                <option value="center">Center</option>
                                                <option value="bottom">Bottom</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <label className={cn(
                                            "cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-all shadow-sm",
                                            isUploading && "opacity-50 cursor-not-allowed"
                                        )}>
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {isUploading ? "Uploading..." : "Upload Image"}
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
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Restrictions */}
                    <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                        <div className="h-0.5 w-full bg-purple-500" />
                        <CardHeader className="pb-3 pt-4">
                            <CardTitle className="flex items-center gap-2.5 text-base">
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    <TagIcon className="w-4 h-4 text-purple-400" />
                                </div>
                                Restrictions
                            </CardTitle>
                            <CardDescription>Filter which champion classes and tags are allowed in this quest.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-3">
                                <Label className="text-slate-300">Required Classes <span className="text-slate-500 font-normal">(any of the following)</span></Label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_CLASSES.map(cls => (
                                        <Badge
                                            key={cls}
                                            variant={requiredClasses.includes(cls) ? "default" : "outline"}
                                            className={requiredClasses.includes(cls) ? "bg-sky-600 cursor-pointer py-1.5 px-3" : "border-slate-700 text-slate-400 cursor-pointer py-1.5 px-3 hover:border-slate-600 hover:text-slate-300 transition-colors"}
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
                                                    src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`}
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
                            <div className="h-px bg-slate-800/60" />
                            <div className="space-y-3">
                                <Label className="text-slate-300">Required Tags <span className="text-slate-500 font-normal">(any of the following)</span></Label>
                                <MultiTagCombobox
                                    tags={tags}
                                    values={requiredTags.map(id => tags.find(t => t.id === id)?.name || "").filter(Boolean)}
                                    onSelect={(names) => setRequiredTags(names.map(name => {
                                        const foundTag = tags.find(t => t.name === name);
                                        return foundTag ? foundTag.id : undefined;
                                    }).filter((id): id is number => id !== undefined))}
                                    placeholder="Search tags..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Focus sentinel — lets keyboard users reach a known position before the fixed bar */}
                    <div tabIndex={-1} aria-hidden="true" className="sr-only" />

                    {/* Sticky save bar */}
                    <div
                        role="toolbar"
                        aria-label="Save settings toolbar"
                        className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-4"
                    >
                        <Button
                            variant="outline"
                            onClick={handleClearRecommended}
                            aria-label="Clear all recommended champions"
                            className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                        >
                            <Eraser className="mr-2 h-4 w-4" /> Clear All Recommendations
                        </Button>
                        <Button onClick={handleSaveSettings} disabled={isSavingSettings} aria-label={isSavingSettings ? "Saving settings…" : "Save settings"} className="bg-sky-600 hover:bg-sky-500 text-white min-w-[150px] shadow-md shadow-sky-900/20 transition-all">
                            <Save className="mr-2 h-4 w-4" /> {isSavingSettings ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>

                </TabsContent>

                <TabsContent value="path" className="mt-6 space-y-6 overflow-visible outline-none focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start overflow-visible">
                {/* Create Encounter Form — sticky on large screens so it stays visible while scrolling the timeline */}
                <div
                    id="encounter-editor"
                    className="space-y-6 lg:col-span-5 lg:sticky lg:top-24 lg:z-10 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:overscroll-contain lg:self-start pr-0 lg:pr-2 pb-4 lg:pb-6 custom-scrollbar"
                >
                    <Card className={cn(
                        "bg-slate-950/50 border-slate-800 transition-all duration-200 overflow-hidden",
                        editingEncounterId ? "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.07)]" : ""
                    )}>
                        {/* Colored top-edge bar — sky when adding, amber when editing */}
                        <div className={cn("h-0.5 w-full transition-colors", editingEncounterId ? "bg-amber-500" : "bg-sky-500")} />

                        <CardHeader className="pb-3 pt-4">
                            <div className="flex items-center gap-3">
                                {/* Nav arrows + counter pill */}
                                <div className="flex items-center gap-0.5 shrink-0 rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                                        disabled={pathNavDisabled}
                                        onClick={goToPreviousPathEncounter}
                                        title={
                                            pathNavDisabled ? "No encounters on this path"
                                                : editingEncounterIndex === -1 ? "Edit last encounter"
                                                : editingEncounterIndex === 0 ? "Back to new encounter"
                                                : "Previous encounter"
                                        }
                                        aria-label={editingEncounterIndex === 0 ? "Back to new encounter" : "Previous encounter"}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    {!pathNavDisabled && (
                                        <span className="px-2 text-[11px] font-bold tabular-nums text-slate-400 select-none min-w-[48px] text-center">
                                            {editingEncounterIndex >= 0
                                                ? `${editingEncounterIndex + 1} / ${sortedPathEncounters.length}`
                                                : `— / ${sortedPathEncounters.length}`}
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                                        disabled={pathNavDisabled}
                                        onClick={goToNextPathEncounter}
                                        title={
                                            pathNavDisabled ? "No encounters on this path"
                                                : editingEncounterIndex === -1 ? "Edit first encounter"
                                                : editingEncounterIndex === sortedPathEncounters.length - 1 ? "Back to new encounter"
                                                : "Next encounter"
                                        }
                                        aria-label={editingEncounterIndex === sortedPathEncounters.length - 1 ? "Back to new encounter" : "Next encounter"}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Title + subtitle */}
                                <div className="min-w-0 flex-1">
                                    <CardTitle className={cn("text-base leading-tight", editingEncounterId ? "text-amber-400" : "text-slate-100")}>
                                        {editingEncounterId
                                            ? (() => {
                                                const enc = sortedPathEncounters[editingEncounterIndex];
                                                const name = enc?.defender?.name;
                                                return name ? `Editing: ${name}` : "Edit Encounter";
                                              })()
                                            : "New Encounter"}
                                    </CardTitle>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {editingEncounterId
                                            ? `Fight #${effectiveSequence} · sequence ${effectiveSequence}`
                                            : pathNavDisabled
                                                ? "No encounters yet — add the first one below."
                                                : "Use arrows to browse existing fights, or fill in below to add new."}
                                    </p>
                                </div>

                                {/* State badge */}
                                <Badge variant="outline" className={cn(
                                    "shrink-0 text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5",
                                    editingEncounterId
                                        ? "text-amber-400 border-amber-500/40 bg-amber-950/20"
                                        : "text-sky-400 border-sky-500/30 bg-sky-950/20"
                                )}>
                                    {editingEncounterId ? "Editing" : "New"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-3 p-0 pb-0">
                            {/* ── Core fields ─────────────────────────────── */}
                            <div className="px-6 py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300 font-semibold">
                                        Defender <span className="text-red-500">*</span>
                                    </Label>
                                    <ChampionCombobox
                                        id="defender-search-input"
                                        champions={champions}
                                        value={defenderId}
                                        onSelect={(id) => setDefenderId(id)}
                                        placeholder="Search champions..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-300 font-semibold">Quick Tips</Label>
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
                                        className="bg-slate-900 border-slate-800 min-h-[90px] focus-visible:ring-sky-500 resize-y text-sm"
                                    />
                                    <p className="text-[11px] text-slate-600">Markdown supported.</p>
                                </div>
                            </div>

                            {/* ── Video guides panel ───────────────────────── */}
                            <div className="px-4">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/60">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Video Guides</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] text-slate-500 uppercase tracking-widest">Generic URL</Label>
                                        <Input
                                            value={videoUrl}
                                            onChange={e => setVideoUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="bg-slate-950 border-slate-800 focus-visible:ring-sky-500 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] text-slate-500 uppercase tracking-widest">Creator-Specific</Label>
                                        <div className="space-y-2">
                                            {videos.map((v, i) => (
                                                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg group">
                                                    {v.playerAvatar ? (
                                                        <img src={v.playerAvatar} alt={v.playerName || "Player"} className="w-7 h-7 rounded-full border border-slate-700 shrink-0" />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                            {(v.playerName || "?").charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 flex flex-col min-w-0">
                                                        <span className="text-xs font-semibold text-slate-200 truncate">{v.playerName || "Unknown Player"}</span>
                                                        <span className="text-[11px] text-sky-500/70 truncate hover:text-sky-400 cursor-pointer" onClick={() => window.open(v.videoUrl, '_blank')}>{v.videoUrl}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setVideos(videos.filter((_, idx) => idx !== i))}
                                                        className="w-7 h-7 text-slate-600 hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <div className="flex flex-col gap-2 pt-1">
                                                <Input
                                                    id="new-video-url"
                                                    placeholder="Video URL (https://youtube.com/...)"
                                                    className="bg-slate-950 border-slate-800 focus-visible:ring-sky-500 text-sm"
                                                />
                                                <AsyncPlayerSearchCombobox
                                                    value=""
                                                    onSelect={(id, name, avatar) => {
                                                        const urlInput = document.getElementById("new-video-url") as HTMLInputElement;
                                                        if (id && urlInput?.value) {
                                                            if (videos.some(v => v.videoUrl === urlInput.value && v.playerId === id)) {
                                                                toast({ title: "Duplicate", description: "This video by this creator is already added.", variant: "destructive" });
                                                                return;
                                                            }
                                                            setVideos([...videos, { videoUrl: urlInput.value, playerId: id, playerName: name, playerAvatar: avatar }]);
                                                            urlInput.value = "";
                                                        } else if (!urlInput?.value) {
                                                            toast({ title: "Error", description: "Please enter a video URL first.", variant: "destructive" });
                                                        }
                                                    }}
                                                    placeholder="Select creator to add their video..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>

                            {/* ── Encounter specifics panel ────────────────── */}
                            <div className="px-4 pb-2">
                            <div className="rounded-xl border border-purple-900/30 bg-purple-950/10 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-900/20 bg-purple-950/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Encounter Specifics</span>
                                    <span className="ml-auto text-[10px] text-slate-500 font-medium">Optional</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-slate-500 uppercase tracking-widest">Required Tags</Label>
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
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-slate-500 uppercase tracking-widest">Recommended Tags</Label>
                                            <MultiTagCombobox
                                                tags={tags}
                                                values={recommendedTags}
                                                onSelect={setRecommendedTags}
                                                placeholder="Recommended for this fight..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] text-slate-500 uppercase tracking-widest">Recommended Champions</Label>
                                            <div className="flex items-center gap-1">
                                                {recommendedChampionIds.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-[10px] text-slate-500 hover:text-red-400 hover:bg-red-950/20"
                                                        onClick={() => setRecommendedChampionIds([])}
                                                        title="Clear recommended champions for this encounter"
                                                    >
                                                        <Eraser className="w-3 h-3 mr-1" /> Clear
                                                    </Button>
                                                )}
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
                                        </div>
                                        <MultiChampionCombobox
                                            champions={champions}
                                            values={recommendedChampionIds}
                                            onSelect={setRecommendedChampionIds}
                                            placeholder="Search champions..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] text-slate-500 uppercase tracking-widest">Node Modifiers</Label>
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
                            </div>
                            </div>

                            {/* ── Action row ───────────────────────────────── */}
                            <div className={cn(
                                "px-4 py-3 border-t flex items-center gap-3",
                                editingEncounterId ? "border-amber-500/20 bg-amber-950/10" : "border-slate-800/60 bg-slate-900/30"
                            )}>
                                {editingEncounterId ? (
                                    <>
                                        {/* Autosave status indicator */}
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            {saveStatus === 'saving' && (
                                                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                                                </span>
                                            )}
                                            {saveStatus === 'saved' && (
                                                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                                                    <Check className="w-3 h-3" /> Saved
                                                </span>
                                            )}
                                            {saveStatus === 'unsaved' && (
                                                <span className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Unsaved
                                                </span>
                                            )}
                                            {saveStatus === 'idle' && (
                                                <span className="text-[11px] text-slate-600">Auto-saves on change</span>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleAddOrUpdateEncounter}
                                            size="sm"
                                            className="bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-900/30 font-semibold"
                                            disabled={saveStatus === 'saving' || !effectiveSequence}
                                        >
                                            <Save className="mr-1.5 h-3.5 w-3.5" /> Save Now
                                        </Button>
                                        <Button onClick={cancelEditing} variant="outline" size="sm" className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                                            Done
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={handleAddOrUpdateEncounter}
                                        className="flex-1 font-semibold text-white shadow-md transition-all bg-sky-600 hover:bg-sky-500 shadow-sky-900/30"
                                        disabled={!effectiveSequence}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Add Encounter
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Existing Encounters */}
                <div className="lg:col-span-7 space-y-4 min-w-0">
                    <h2 className="text-2xl font-semibold mb-2">Path timeline</h2>
                    <details className="group rounded-xl border border-slate-800 bg-slate-950/60 mb-4 open:border-sky-900/40">
                        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-900/40 rounded-xl [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2 min-w-0">
                                <FileStack className="h-4 w-4 shrink-0 text-sky-400" />
                                <span className="truncate">Bulk import</span>
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-slate-800/60">
                            <div className="flex border-b border-slate-800/60">
                                <button
                                    type="button"
                                    onClick={() => setBulkNodeImportTab("encounters")}
                                    className={cn(
                                        "px-4 py-2 text-xs font-medium transition-colors",
                                        bulkNodeImportTab === "encounters"
                                            ? "text-sky-400 border-b-2 border-sky-400 -mb-px"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    Encounters
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setBulkNodeImportTab("nodes"); setBulkNodeImportResults(null); }}
                                    className={cn(
                                        "px-4 py-2 text-xs font-medium transition-colors",
                                        bulkNodeImportTab === "nodes"
                                            ? "text-sky-400 border-b-2 border-sky-400 -mb-px"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    Node Modifiers
                                </button>
                            </div>

                            {bulkNodeImportTab === "encounters" && (
                                <div className="px-4 pb-4 pt-3 space-y-3">
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Paste defender names, one per line. New fights are appended in order starting at sequence {defaultSequence}.
                                        Lines that do not match a champion still create a placeholder row you can edit later.
                                    </p>
                                    <Textarea
                                        value={bulkEncountersText}
                                        onChange={(e) => setBulkEncountersText(e.target.value)}
                                        placeholder={"Hercules\nKitty Pryde\nOmega Red"}
                                        className="min-h-[140px] text-sm bg-slate-900 border-slate-800 focus-visible:ring-sky-500 font-mono"
                                    />
                                    {bulkImportPreview.total > 0 && (
                                        <p className="text-xs text-slate-400">
                                            {bulkImportPreview.matched} matched, {bulkImportPreview.unmatched} unmatched — {bulkImportPreview.total} rows
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        onClick={handleBulkEncounterParse}
                                        disabled={isBulkAdding || bulkImportPreview.total === 0}
                                        className="bg-sky-600 hover:bg-sky-500 text-white w-full sm:w-auto"
                                    >
                                        {isBulkAdding ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                                            </>
                                        ) : (
                                            <>
                                                <FileStack className="mr-2 h-4 w-4" /> Import {bulkImportPreview.total > 0 ? `${bulkImportPreview.total} encounters` : "encounters"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {bulkNodeImportTab === "nodes" && (
                                <div className="px-4 pb-4 pt-3 space-y-3">
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Paste the JSON array of champion nodes. Existing encounters are matched by champion name; unmatched champions get new encounters.
                                        "Champion Boost", "Health", and "WARNING" nodes are ignored. Node modifiers are created if not already in the database.
                                    </p>
                                    <Textarea
                                        value={bulkNodeJsonText}
                                        onChange={(e) => { setBulkNodeJsonText(e.target.value); setBulkNodeImportResults(null); }}
                                        placeholder={'[{"champion": "VISION", "nodes": [{"title": "Tunnel Vision", "description": "..."}]}]'}
                                        className="min-h-[160px] text-sm bg-slate-900 border-slate-800 focus-visible:ring-sky-500 font-mono"
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleBulkNodeImport}
                                        disabled={isBulkNodeImporting || !bulkNodeJsonText.trim()}
                                        className="bg-sky-600 hover:bg-sky-500 text-white w-full sm:w-auto"
                                    >
                                        {isBulkNodeImporting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                                            </>
                                        ) : (
                                            <>
                                                <FileStack className="mr-2 h-4 w-4" /> Import node modifiers
                                            </>
                                        )}
                                    </Button>

                                    {bulkNodeImportResults && (
                                        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
                                            <div className="px-3 py-2 border-b border-slate-800 text-xs font-medium text-slate-300">
                                                Import results — {bulkNodeImportResults.length} champions
                                            </div>
                                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
                                                {bulkNodeImportResults.map((r, i) => (
                                                    <div key={i} className="px-3 py-2 flex items-start gap-2 text-xs">
                                                        <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full shrink-0", r.encounterCreated ? "bg-amber-400" : "bg-sky-400")} />
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-medium text-slate-200">{r.champion}</span>
                                                            {r.encounterCreated && <span className="ml-1.5 text-amber-400/80">(new encounter)</span>}
                                                            <span className="ml-2 text-slate-500">
                                                                {r.nodesLinked} linked
                                                                {r.nodesCreated > 0 && <>, <span className="text-emerald-400">{r.nodesCreated} created</span></>}
                                                                {r.nodesSkipped > 0 && <>, {r.nodesSkipped} skipped</>}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </details>
                    {initialQuest.encounters.length === 0 ? (
                        <p className="text-muted-foreground italic bg-slate-950/50 p-6 rounded-xl border border-dashed border-slate-800 text-center">No encounters added to this quest yet. Start by adding a fight on the left.</p>
                    ) : (
                        <div className="relative pl-6 md:pl-10 pb-20">
                            {/* Continuous Vertical Timeline Line */}
                            <div className="absolute top-0 bottom-0 left-6 md:left-10 w-1 bg-slate-800 -translate-x-1/2 z-0 shadow-inner rounded-full overflow-hidden">
                                <div className="w-full h-full bg-gradient-to-b from-slate-800 via-sky-900/20 to-transparent" />
                            </div>

                            <div className="space-y-6">
                                <AnimatePresence mode="popLayout">
                                {initialQuest.encounters
                                    .sort((a, b) => a.sequence - b.sequence)
                                    .map((encounter: EncounterWithRelations, index: number) => {
                                        const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as ChampionClass) : { border: "border-slate-700", text: "text-slate-300", bg: "bg-slate-900", glow: "from-slate-950/20" };
                                        
                                        // Generate a Class-specific glow for the card background
                                        const classGlow = encounter.defender ? (
                                            encounter.defender.class === 'SCIENCE' ? 'from-green-500/10' :
                                            encounter.defender.class === 'SKILL' ? 'from-red-500/10' :
                                            encounter.defender.class === 'MUTANT' ? 'from-amber-500/10' :
                                            encounter.defender.class === 'COSMIC' ? 'from-sky-500/10' :
                                            encounter.defender.class === 'TECH' ? 'from-blue-500/10' :
                                            encounter.defender.class === 'MYSTIC' ? 'from-purple-500/10' : 'from-slate-500/10'
                                        ) : 'from-slate-500/10';

                                        return (
                                            <motion.div
                                                key={encounter.id}
                                                layout
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="relative flex items-center group is-active"
                                            >
                                                {/* Timeline dot */}
                                                <div className={cn(
                                                    "flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full border bg-slate-950 text-slate-300 shadow shrink-0 absolute left-0 transform -translate-x-1/2 font-bold z-10 transition-colors border-slate-700 group-hover:border-slate-500",
                                                    editingEncounterId === encounter.id && "border-sky-500 text-sky-400"
                                                )}>
                                                    {index + 1}
                                                </div>

                                                {/* Card Content */}
                                                <Card
                                                    id={`admin-timeline-encounter-${encounter.id}`}
                                                    className={cn(
                                                        "w-full ml-8 md:ml-12 bg-slate-950/80 border-slate-800 hover:border-slate-700 transition-all cursor-pointer overflow-hidden relative group/card scroll-mt-28",
                                                        editingEncounterId === encounter.id ? "ring-1 ring-sky-500/50 border-sky-500/50 shadow-[0_0_15px_rgba(2,132,199,0.1)]" : ""
                                                    )}
                                                    onClick={() => startEditingEncounter(encounter)}
                                                >
                                                    {/* Background Glow */}
                                                    <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none opacity-50", classGlow)} />
                                                    
                                                    {/* Class Accent Bar */}
                                                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", colors.bg, "opacity-70")} />

                                                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-4 relative z-10">
                                                        <div className="flex items-center gap-4 w-full">
                                                            {encounter.defender ? (
                                                                <div className={cn("relative h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 border-2 shadow-md transition-transform group-hover/card:scale-105", colors.border)}>
                                                                    <Image
                                                                        src={getChampionImageUrlOrPlaceholder(encounter.defender.images, "128")}
                                                                        alt={encounter.defender.name}
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="h-14 w-14 rounded-lg bg-slate-900 border-2 border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                                                                    <span className="text-xl font-bold text-slate-500">?</span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <CardTitle className={cn("text-lg flex items-center gap-2", colors.text)}>
                                                                    {encounter.defender ? encounter.defender.name : "Unknown Defender"}
                                                                </CardTitle>
                                                                {encounter.nodes && encounter.nodes.length > 0 && (
                                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                                        {encounter.nodes.map((n) => (
                                                                            <Badge key={n.id} variant="secondary" className="text-[10px] py-0 h-4 bg-slate-900/80 border-slate-700/50 text-slate-400 font-normal">
                                                                                {n.nodeModifier.name}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                            <div className="flex flex-col gap-1 mr-2">
                                                                <Button
                                                                    variant="ghost" 
                                                                    size="icon"
                                                                    disabled={index === 0}
                                                                    onClick={(e) => { e.stopPropagation(); handleMoveEncounter(encounter.id, 'up'); }}
                                                                    className="h-6 w-6 rounded bg-slate-900 border border-slate-800 hover:bg-sky-950 hover:text-sky-400"
                                                                >
                                                                    <ChevronUp className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost" 
                                                                    size="icon"
                                                                    disabled={index === initialQuest.encounters.length - 1}
                                                                    onClick={(e) => { e.stopPropagation(); handleMoveEncounter(encounter.id, 'down'); }}
                                                                    className="h-6 w-6 rounded bg-slate-900 border border-slate-800 hover:bg-sky-950 hover:text-sky-400"
                                                                >
                                                                    <ChevronDown className="h-3 w-3" />
                                                                </Button>
                                                            </div>

                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteEncounter(encounter.id); }}
                                                                className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/50 flex-shrink-0"
                                                                title="Delete Encounter"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </CardHeader>

                                                    {(encounter.tips || (encounter.recommendedChampions && encounter.recommendedChampions.length > 0)) && (
                                                        <CardContent className="px-4 pb-4 pt-0 space-y-3 relative z-10">
                                                            {encounter.recommendedChampions && encounter.recommendedChampions.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 pb-1">
                                                                    {encounter.recommendedChampions.map((champ) => {
                                                                        const champColors = getChampionClassColors(champ.class as ChampionClass);
                                                                        return (
                                                                            <div
                                                                                key={champ.id}
                                                                                className={cn("relative h-9 w-9 rounded-full overflow-hidden border-2 shadow-sm ring-1 ring-slate-950/50 transition-transform hover:scale-110", champColors.border)}
                                                                                title={champ.name}
                                                                            >
                                                                                <Image
                                                                                    src={getChampionImageUrlOrPlaceholder(champ.images, "64")}
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
                                                                <div className="text-sm text-slate-300 bg-slate-900/30 backdrop-blur-sm p-3 rounded-lg border border-slate-800/50 line-clamp-2 hover:line-clamp-none transition-all">
                                                                    <SimpleMarkdown content={encounter.tips} />
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    )}
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>
            </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

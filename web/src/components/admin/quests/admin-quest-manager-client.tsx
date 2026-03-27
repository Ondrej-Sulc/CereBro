"use client";

import { useState, useMemo, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { QuestCategory, QuestPlanStatus } from "@prisma/client";
import { QuestSummary } from "@/types/quests";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
    Trash2, Plus, Edit, FolderPlus, Map as MapIcon, Search, X, FolderTree, Copy,
    Image as ImageIcon, Swords, Users, ShieldAlert, FileWarning, Tag as TagIcon,
    Trophy, Youtube, Loader2, EyeOff, Eye, Archive, Pencil, Check, Upload, Folder
} from "lucide-react";
import { createQuestPlan, deleteQuestPlan, createQuestCategory, duplicateQuestPlan, updateQuestCategory, uploadQuestCategoryThumbnail } from "@/app/actions/quests";
import { cn } from "@/lib/utils";

type QuestCategoryFlat = QuestCategory & { thumbnailUrl?: string | null };
type CategoryNode = QuestCategoryFlat & { children: CategoryNode[]; depth: number };

function buildCategoryTree(cats: QuestCategoryFlat[]): CategoryNode[] {
    const nodeMap = new Map<string, CategoryNode>();
    for (const cat of cats) nodeMap.set(cat.id, { ...cat, children: [], depth: 0 });
    const roots: CategoryNode[] = [];
    for (const node of nodeMap.values()) {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    // Sort siblings by order, then assign depth
    const assignDepth = (nodes: CategoryNode[], depth: number) => {
        nodes.sort((a, b) => a.order - b.order);
        for (const n of nodes) { n.depth = depth; assignDepth(n.children, depth + 1); }
    };
    assignDepth(roots, 0);
    return roots;
}

// Flatten tree in DFS order (for dropdowns and sections)
function flattenTree(roots: CategoryNode[]): CategoryNode[] {
    const result: CategoryNode[] = [];
    const walk = (nodes: CategoryNode[]) => {
        for (const n of nodes) { result.push(n); walk(n.children); }
    };
    walk(roots);
    return result;
}

interface Props {
    initialQuests: QuestSummary[];
    categories: QuestCategoryFlat[];
}

export default function AdminQuestManagerClient({ initialQuests, categories }: Props) {
    const router = useRouter();
    const { toast } = useToast();

    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState<string>("none");

    const [categoryName, setCategoryName] = useState("");
    const [categoryParentId, setCategoryParentId] = useState<string>("none");
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Category edit dialog state
    const [editingCategory, setEditingCategory] = useState<QuestCategoryFlat | null>(null);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [editCategoryOrder, setEditCategoryOrder] = useState(0);
    const [editCategoryParentId, setEditCategoryParentId] = useState<string>("none");
    const [editCategoryThumbUrl, setEditCategoryThumbUrl] = useState<string | null>(null);
    const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
    const [isUploadingCategoryThumb, setIsUploadingCategoryThumb] = useState(false);

    const tree = useMemo(() => buildCategoryTree(categories), [categories]);
    const flatCategories = useMemo(() => flattenTree(tree), [tree]);

    const handleAdd = async () => {
        if (!title || isCreating) return;
        setIsCreating(true);
        try {
            const res = await createQuestPlan({
                title,
                categoryId: categoryId !== "none" ? categoryId : undefined
            });
            if (res.success && res.planId) {
                router.push(`/admin/quests/${res.planId}`);
            }
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to create quest";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this quest? This action cannot be undone.")) return;
        try {
            await deleteQuestPlan(id);
            router.refresh();
            toast({ title: "Success", description: "Quest deleted." });
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to delete quest";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const handleDuplicate = async (id: string) => {
        try {
            const res = await duplicateQuestPlan(id);
            if (res.success && res.planId) {
                toast({ title: "Success", description: "Quest duplicated!" });
                router.push(`/admin/quests/${res.planId}`);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to duplicate quest";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const handleAddCategory = async () => {
        if (!categoryName) return;
        setIsCreatingCategory(true);
        try {
            const res = await createQuestCategory(
                categoryName,
                0,
                categoryParentId !== "none" ? categoryParentId : undefined
            );
            if (res.success) {
                setCategoryName("");
                setCategoryParentId("none");
                toast({ title: "Success", description: "Category created!" });
                router.refresh();
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to create category";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const openEditDialog = (cat: QuestCategoryFlat) => {
        setEditingCategory(cat);
        setEditCategoryName(cat.name);
        setEditCategoryOrder(cat.order);
        setEditCategoryParentId(cat.parentId ?? "none");
        setEditCategoryThumbUrl(cat.thumbnailUrl ?? null);
    };

    const handleUpdateCategory = async () => {
        if (!editingCategory || isUpdatingCategory) return;
        setIsUpdatingCategory(true);
        try {
            await updateQuestCategory(editingCategory.id, {
                name: editCategoryName,
                order: editCategoryOrder,
                parentId: editCategoryParentId !== "none" ? editCategoryParentId : null,
            });
            setEditingCategory(null);
            toast({ title: "Success", description: "Category updated." });
            router.refresh();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Failed to update category";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsUpdatingCategory(false);
        }
    };

    const handleUploadCategoryThumbnail = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingCategory) return;
        setIsUploadingCategoryThumb(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await uploadQuestCategoryThumbnail(editingCategory.id, formData);
            if (res.success && res.url) {
                setEditCategoryThumbUrl(res.url);
                toast({ title: "Success", description: "Thumbnail uploaded." });
                router.refresh();
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Failed to upload thumbnail";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsUploadingCategoryThumb(false);
            e.target.value = "";
        }
    };

    // In search mode: flat filtered list. Otherwise: null (use grouped tree view)
    const filteredQuests = useMemo(() => {
        if (!searchQuery) return null;
        return initialQuests.filter(q =>
            q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (q.category && q.category.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [initialQuests, searchQuery]);

    // Build grouped sections from the tree (DFS, one section per node that has quests)
    // Returns flattened ordered sections with depth for indentation
    const questSections = useMemo(() => {
        const sections: Array<{ category: QuestCategoryFlat | null; quests: QuestSummary[]; depth: number }> = [];
        const walk = (nodes: CategoryNode[]) => {
            for (const node of nodes) {
                const nodeQuests = initialQuests.filter(q => q.categoryId === node.id);
                if (nodeQuests.length > 0 || node.children.length > 0) {
                    sections.push({ category: node, quests: nodeQuests, depth: node.depth });
                }
                walk(node.children);
            }
        };
        walk(tree);
        const uncategorized = initialQuests.filter(q => q.categoryId === null);
        if (uncategorized.length > 0) sections.push({ category: null, quests: uncategorized, depth: 0 });
        return sections;
    }, [initialQuests, tree]);

    const getStatusConfig = (status: QuestPlanStatus) => {
        switch (status) {
            case QuestPlanStatus.DRAFT:
                return { label: "Draft", icon: EyeOff, className: "text-amber-400 border-amber-500/40 bg-amber-950/60", barClass: "bg-amber-500" };
            case QuestPlanStatus.VISIBLE:
                return { label: "Visible", icon: Eye, className: "text-emerald-400 border-emerald-500/40 bg-emerald-950/60", barClass: "bg-emerald-500" };
            case QuestPlanStatus.ARCHIVED:
                return { label: "Archived", icon: Archive, className: "text-slate-400 border-slate-600/60 bg-slate-900/80", barClass: "bg-slate-600" };
        }
    };

    const renderQuestCard = (quest: QuestSummary) => {
        const fightCount = quest.encounters?.length || 0;
        const statusConfig = getStatusConfig(quest.status);
        const StatusIcon = statusConfig.icon;

        return (
            <Card key={quest.id} className="bg-slate-950/80 border-slate-800 hover:border-slate-700 transition-all flex flex-col group overflow-hidden relative">
                <div className={cn("h-0.5 w-full transition-colors", statusConfig.barClass)} />
                <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-900 border-b border-slate-800">
                    {quest.bannerUrl ? (
                        <Image
                            src={quest.bannerUrl.replace(/#/g, '%23')}
                            alt={quest.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 25vw"
                            className={cn(
                                "transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-100",
                                quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                                quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                            )}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                            <ImageIcon className="w-8 h-8 text-slate-800" />
                        </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 z-10">
                        <Badge variant="outline" className={cn("flex items-center gap-1 font-black uppercase text-[9px] tracking-widest px-2 py-0.5 shadow-lg shadow-black/50", statusConfig.className)}>
                            <StatusIcon className="w-2.5 h-2.5" />
                            {statusConfig.label}
                        </Badge>
                    </div>
                    <div className="absolute bottom-2.5 right-3 z-10">
                        <div className="flex items-center gap-1.5 text-white bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 shadow-xl">
                            <Swords className="w-3 h-3 text-red-400" />
                            <span className="text-[10px] font-black uppercase tracking-tight">{fightCount} {fightCount === 1 ? "Fight" : "Fights"}</span>
                        </div>
                    </div>
                </div>

                <CardContent className="p-4 flex flex-col flex-1 gap-3">
                    {quest.videoUrl && (
                        <div className="flex items-center gap-1 text-red-500/80 text-[9px] font-bold uppercase tracking-wider">
                            <Youtube className="w-3 h-3" /> Guide
                        </div>
                    )}
                    <CardTitle className="text-base font-black group-hover:text-sky-400 transition-colors line-clamp-2 uppercase tracking-tight leading-snug">
                        {quest.title}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        {quest.creators && quest.creators.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-1.5">
                                    {quest.creators.slice(0, 3).map(c => (
                                        <div key={c.id} className="relative w-5 h-5 rounded-full border border-slate-900 overflow-hidden bg-slate-800" title={c.name}>
                                            {c.image ? (
                                                <Image src={c.image} alt={c.name} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-white uppercase">
                                                    {c.name?.trim() ? c.name.trim().charAt(0) : "?"}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    By {quest.creators.length === 1 ? quest.creators[0].name : `${quest.creators.length} Creators`}
                                </span>
                            </div>
                        ) : (
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                By {quest.creator?.ingameName || "Cerebro Admin"}
                            </p>
                        )}
                        {quest._count && quest._count.playerPlans > 0 && (
                            <div className="flex items-center gap-1 text-slate-500 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/60">
                                <Users className="w-2.5 h-2.5 text-sky-500/60" />
                                <span className="text-[9px] font-black">{quest._count.playerPlans}</span>
                            </div>
                        )}
                    </div>
                    {((quest.minStarLevel || quest.maxStarLevel) || (quest.requiredClasses && quest.requiredClasses.length > 0)) && (
                        <div className="flex flex-wrap gap-1.5">
                            {(quest.minStarLevel || quest.maxStarLevel) && (
                                <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/60 rounded-md px-2 py-1">
                                    <Trophy className="w-3 h-3 text-amber-500" />
                                    <span className="text-[10px] font-black text-amber-400">
                                        {quest.minStarLevel && quest.maxStarLevel
                                            ? `${quest.minStarLevel}–${quest.maxStarLevel}★`
                                            : quest.minStarLevel ? `${quest.minStarLevel}★+` : `Up to ${quest.maxStarLevel}★`}
                                    </span>
                                </div>
                            )}
                            {quest.requiredClasses && quest.requiredClasses.length > 0 && (
                                <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/60 rounded-md px-2 py-1">
                                    <ShieldAlert className="w-3 h-3 text-sky-500" />
                                    <div className="flex gap-0.5">
                                        {quest.requiredClasses.slice(0, 4).map(cls => (
                                            <div key={cls} className="relative w-3 h-3">
                                                <Image src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} fill className="object-contain" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {quest.requiredTags && quest.requiredTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {quest.requiredTags.slice(0, 3).map(tag => (
                                <Badge key={tag.id} variant="outline" className="bg-slate-900/30 text-slate-500 border-slate-800 text-[8px] uppercase font-black px-1.5 py-0 h-4">
                                    <TagIcon className="w-2 h-2 mr-1 text-slate-600" />{tag.name}
                                </Badge>
                            ))}
                            {quest.requiredTags.length > 3 && <span className="text-[8px] text-slate-600 font-bold self-center">+{quest.requiredTags.length - 3}</span>}
                        </div>
                    )}
                    {fightCount === 0 && (
                        <div className="flex items-center gap-2 text-amber-400 bg-amber-500/8 border border-amber-500/25 px-3 py-2 rounded-lg">
                            <FileWarning className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Empty — no fights added yet</span>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="p-3 bg-slate-900/50 border-t border-slate-800/60 flex gap-2">
                    <Button
                        className="flex-1 bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-300 h-9 font-bold text-xs uppercase tracking-widest transition-all border border-slate-700 hover:border-sky-500 shadow-sm"
                        onClick={() => router.push(`/admin/quests/${quest.id}`)}
                    >
                        <Edit className="h-3.5 w-3.5 mr-2" /> Edit Quest
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDuplicate(quest.id)}
                        className="text-slate-500 hover:text-indigo-400 hover:bg-indigo-950/30 shrink-0 h-9 w-9 border border-transparent hover:border-indigo-900/50 transition-all" title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(quest.id)}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-950/30 shrink-0 h-9 w-9 border border-transparent hover:border-red-900/50 transition-all" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Recursive sidebar tree item renderer
    const renderSidebarTree = (nodes: CategoryNode[]) => nodes.map(node => (
        <div key={node.id}>
            <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/50 group"
                style={{ marginLeft: node.depth * 12 }}
            >
                {node.thumbnailUrl ? (
                    <div className="relative w-7 h-7 rounded overflow-hidden shrink-0 border border-slate-700">
                        <Image src={node.thumbnailUrl} alt={node.name} fill className="object-cover" />
                    </div>
                ) : (
                    <Folder className={cn("shrink-0", node.depth === 0 ? "w-4 h-4 text-indigo-500/50" : "w-3.5 h-3.5 text-slate-600")} />
                )}
                <span className="flex-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">{node.name}</span>
                <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-slate-600 hover:text-indigo-400 hover:bg-indigo-950/30 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    onClick={() => openEditDialog(node)}
                    title="Edit category"
                >
                    <Pencil className="w-3 h-3" />
                </Button>
            </div>
            {node.children.length > 0 && (
                <div className="mt-1 space-y-1">
                    {renderSidebarTree(node.children)}
                </div>
            )}
        </div>
    ));

    const totalShown = filteredQuests ? filteredQuests.length : initialQuests.length;

    // Dropdown options for category selectors (indented by depth)
    const categoryOptions = useMemo(() => flatCategories.map(cat => ({
        value: cat.id,
        label: `${"  ".repeat(cat.depth)}${cat.depth > 0 ? "└ " : ""}${cat.name}`,
    })), [flatCategories]);

    const editParentOptions = useMemo(() => {
        if (!editingCategory) return categoryOptions;
        const getDescendantIds = (catId: string): Set<string> => {
            const result = new Set<string>();
            const walk = (id: string) => {
                result.add(id);
                const node = flatCategories.find(c => c.id === id);
                if (node) for (const child of node.children) walk(child.id);
            };
            walk(catId);
            return result;
        };
        const excluded = getDescendantIds(editingCategory.id);
        return categoryOptions.filter(o => !excluded.has(o.value));
    }, [editingCategory, flatCategories, categoryOptions]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* ── Sidebar ────────────────────────────────────────── */}
            <div className="lg:col-span-4 space-y-4">

                {/* New Quest */}
                <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                    <div className="h-0.5 w-full bg-sky-500" />
                    <CardHeader className="pb-3 pt-4">
                        <CardTitle className="flex items-center gap-2.5 text-base">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20">
                                <MapIcon className="w-4 h-4 text-sky-400" />
                            </div>
                            New Quest
                        </CardTitle>
                        <CardDescription>Initialize a new quest plan and start building.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Quest Title</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleAdd()}
                                placeholder="e.g. 8.1.3 Psycho-Man Path"
                                className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Category</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-800 focus:ring-sky-500">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800">
                                    <SelectItem value="none">No Category (Standalone)</SelectItem>
                                    {categoryOptions.map(o => (
                                        <SelectItem key={o.value} value={o.value}>
                                            <span className="font-mono">{o.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAdd}
                            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-all shadow-md shadow-sky-900/30"
                            disabled={!title || isCreating}>
                            {isCreating
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                                : <><Plus className="mr-2 h-4 w-4" /> Create &amp; Build</>}
                        </Button>
                    </CardContent>
                </Card>

                {/* New Category */}
                <Card className="bg-slate-950/80 border-slate-800 shadow-md overflow-hidden">
                    <div className="h-0.5 w-full bg-indigo-500" />
                    <CardHeader className="pb-3 pt-4">
                        <CardTitle className="flex items-center gap-2.5 text-base">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <FolderTree className="w-4 h-4 text-indigo-400" />
                            </div>
                            New Category
                        </CardTitle>
                        <CardDescription>
                            Group related quests together.
                            {categories.length > 0 && <span className="ml-1 text-indigo-400/70">{categories.length} existing.</span>}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Category Name</Label>
                            <Input value={categoryName} onChange={e => setCategoryName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                                placeholder="e.g. Story Quests Vol. 8"
                                className="bg-slate-900 border-slate-800 focus-visible:ring-indigo-500" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Parent Category <span className="text-slate-600">(optional)</span></Label>
                            <Select value={categoryParentId} onValueChange={setCategoryParentId}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-800 focus:ring-indigo-500">
                                    <SelectValue placeholder="None (top-level)" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800">
                                    <SelectItem value="none">None (top-level)</SelectItem>
                                    {categoryOptions.map(o => (
                                        <SelectItem key={o.value} value={o.value}>
                                            <span className="font-mono">{o.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAddCategory}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md shadow-indigo-900/30"
                            disabled={!categoryName || isCreatingCategory}>
                            {isCreatingCategory
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                                : <><FolderPlus className="mr-2 h-4 w-4" /> Add Category</>}
                        </Button>
                    </CardContent>

                    {/* Tree list */}
                    {tree.length > 0 && (
                        <div className="px-4 pb-4 space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Existing Categories</p>
                            <div className="space-y-1">
                                {renderSidebarTree(tree)}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Main quest list ────────────────────────────────── */}
            <div className="lg:col-span-8 flex flex-col gap-4">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 py-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 shrink-0">
                            <MapIcon className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-200 leading-tight">Quest Plans</h2>
                            <p className="text-[11px] text-slate-500">
                                {filteredQuests
                                    ? `${filteredQuests.length} of ${initialQuests.length} shown`
                                    : `${initialQuests.length} total`}
                            </p>
                        </div>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                        <Input placeholder="Search quests or categories…"
                            className="pl-8 pr-8 h-9 bg-slate-900 border-slate-800 text-sm"
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        {searchQuery && (
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                onClick={() => setSearchQuery("")}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Empty state */}
                {totalShown === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                            <MapIcon className="h-7 w-7 text-slate-700" />
                        </div>
                        <div>
                            <p className="text-slate-300 font-semibold">No quests found</p>
                            {searchQuery
                                ? <p className="text-sm text-slate-500 mt-1">No results for &ldquo;{searchQuery}&rdquo;</p>
                                : <p className="text-sm text-slate-500 mt-1">Create your first quest using the form on the left.</p>}
                        </div>
                    </div>
                ) : filteredQuests ? (
                    /* Search — flat grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                        {filteredQuests.map(quest => renderQuestCard(quest))}
                    </div>
                ) : (
                    /* Grouped tree sections */
                    <div className="space-y-8">
                        {questSections.map(({ category: cat, quests, depth }) => (
                            <div key={cat?.id ?? "uncategorized"} className="space-y-3"
                                style={{ marginLeft: depth * 16 }}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        {cat?.thumbnailUrl ? (
                                            <div className="relative w-8 h-8 rounded-md overflow-hidden border border-slate-700 shrink-0">
                                                <Image src={cat.thumbnailUrl} alt={cat.name} fill className="object-cover" />
                                            </div>
                                        ) : (
                                            <Folder className={cn("shrink-0", cat ? "w-4 h-4 text-indigo-400/60" : "w-4 h-4 text-slate-600")} />
                                        )}
                                        <h3 className={cn("font-black uppercase tracking-wider text-slate-300", depth === 0 ? "text-sm" : "text-xs")}>
                                            {cat?.name ?? "Uncategorized"}
                                        </h3>
                                        {quests.length > 0 && (
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                {quests.length} {quests.length === 1 ? "Quest" : "Quests"}
                                            </span>
                                        )}
                                    </div>
                                    {cat && (
                                        <Button variant="ghost" size="sm"
                                            className="h-7 px-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-950/30 text-[10px] uppercase tracking-wide font-bold gap-1"
                                            onClick={() => openEditDialog(cat)}>
                                            <Pencil className="w-3 h-3" /> Edit
                                        </Button>
                                    )}
                                </div>
                                <div className="h-px bg-slate-800/60" />
                                {quests.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                                        {quests.map(quest => renderQuestCard(quest))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Edit Category Dialog ────────────────────────────── */}
            <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
                <DialogContent className="bg-slate-950 border-slate-800 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-100">
                            <Folder className="w-4 h-4 text-indigo-400" />
                            Edit Category
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Thumbnail */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Thumbnail</Label>
                            <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                                {editCategoryThumbUrl ? (
                                    <Image src={editCategoryThumbUrl} alt="thumbnail" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-8 h-8 text-slate-700" />
                                    </div>
                                )}
                            </div>
                            <label className="block cursor-pointer">
                                <input type="file" accept="image/png,image/jpeg,image/webp"
                                    className="hidden" onChange={handleUploadCategoryThumbnail}
                                    disabled={isUploadingCategoryThumb} />
                                <Button variant="outline" size="sm"
                                    className="bg-slate-900 border-slate-700 text-slate-300 gap-2 pointer-events-none w-full"
                                    disabled={isUploadingCategoryThumb} asChild={false}>
                                    {isUploadingCategoryThumb
                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                                        : <><Upload className="w-3 h-3" /> Upload Thumbnail</>}
                                </Button>
                            </label>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Category Name</Label>
                            <Input value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)}
                                className="bg-slate-900 border-slate-800 focus-visible:ring-indigo-500" />
                        </div>

                        {/* Parent Category */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Parent Category <span className="text-slate-600">(optional)</span></Label>
                            <Select value={editCategoryParentId} onValueChange={setEditCategoryParentId}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-800 focus:ring-indigo-500">
                                    <SelectValue placeholder="None (top-level)" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800">
                                    <SelectItem value="none">None (top-level)</SelectItem>
                                    {editParentOptions.map(o => (
                                        <SelectItem key={o.value} value={o.value}>
                                            <span className="font-mono">{o.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sort Order */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Sort Order</Label>
                            <Input type="number" value={editCategoryOrder}
                                onChange={e => setEditCategoryOrder(Number(e.target.value))}
                                className="bg-slate-900 border-slate-800 focus-visible:ring-indigo-500" />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingCategory(null)}
                            className="text-slate-400 hover:text-slate-200">
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateCategory}
                            disabled={!editCategoryName || isUpdatingCategory}
                            className="bg-indigo-600 hover:bg-indigo-500 gap-2">
                            {isUpdatingCategory
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                : <><Check className="w-4 h-4" /> Save Changes</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

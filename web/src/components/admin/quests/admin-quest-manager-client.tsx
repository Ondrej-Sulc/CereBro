"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { QuestPlan, QuestCategory, Player, QuestPlanStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, FolderPlus, Map, Search, X, FolderTree, Copy, Image as ImageIcon, Swords, Users, ShieldAlert, FileWarning } from "lucide-react";
import { createQuestPlan, deleteQuestPlan, createQuestCategory, duplicateQuestPlan } from "@/app/actions/quests";
import { cn } from "@/lib/utils";

type QuestWithRelations = QuestPlan & {
    category: QuestCategory | null;
    creator: Player | null;
    creators: { id: string; name: string; image: string | null }[];
    encounters: { id: string }[];
};

interface Props {
    initialQuests: QuestWithRelations[];
    categories: QuestCategory[];
}

export default function AdminQuestManagerClient({ initialQuests, categories }: Props) {
    const router = useRouter();
    const { toast } = useToast();

    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState<string>("none");

    // Category state
    const [categoryName, setCategoryName] = useState("");
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");

    const handleAdd = async () => {
        if (!title) return;
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
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to duplicate quest";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const handleAddCategory = async () => {
        if (!categoryName) return;
        setIsCreatingCategory(true);
        try {
            const res = await createQuestCategory(categoryName);
            if (res.success) {
                setCategoryName("");
                toast({ title: "Success", description: "Category created!" });
                router.refresh();
            }
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to create category";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const filteredQuests = useMemo(() => {
        if (!searchQuery) return initialQuests;
        return initialQuests.filter(q =>
            q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (q.category && q.category.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [initialQuests, searchQuery]);

    const getStatusBadge = (status: QuestPlanStatus) => {
        switch (status) {
            case QuestPlanStatus.DRAFT:
                return <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-950/20 font-medium">Draft</Badge>;
            case QuestPlanStatus.VISIBLE:
                return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-950/20 font-medium">Visible</Badge>;
            case QuestPlanStatus.ARCHIVED:
                return <Badge variant="outline" className="text-slate-500 border-slate-700 bg-slate-900/50 font-medium">Archived</Badge>;
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar: Create Forms */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="bg-slate-950/80 border-sky-900/50 shadow-lg shadow-sky-900/10">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Map className="w-5 h-5 text-sky-400" />
                            <CardTitle>New Quest</CardTitle>
                        </div>
                        <CardDescription>Initialize a new quest plan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Quest Title</Label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. 8.1.3 Psycho-Man Path"
                                className="bg-slate-900 border-slate-800 focus-visible:ring-sky-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-800 focus:ring-sky-500">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-800">
                                    <SelectItem value="none">No Category (Standalone)</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={handleAdd}
                            className="w-full bg-sky-600 hover:bg-sky-500 text-white mt-2 transition-all shadow-md shadow-sky-900/20"
                            disabled={!title}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create & Build
                        </Button>
                    </CardContent>
                </Card>

                {/* Create Category Card */}
                <Card className="bg-slate-950/50 border-slate-800">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <FolderTree className="w-5 h-5 text-indigo-400" />
                            <CardTitle>New Category</CardTitle>
                        </div>
                        <CardDescription>Group quests together.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Category Name</Label>
                            <Input
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                placeholder="e.g. Story Quests Vol. 8"
                                className="bg-slate-900 border-slate-800 focus-visible:ring-indigo-500"
                            />
                        </div>

                        <Button
                            onClick={handleAddCategory}
                            variant="secondary"
                            className="w-full mt-2"
                            disabled={!categoryName || isCreatingCategory}
                        >
                            <FolderPlus className="mr-2 h-4 w-4" /> Add Category
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Main Area: List */}
            <div className="lg:col-span-8 flex flex-col gap-4">
                {/* Header & Search */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-200">Existing Quests</h2>
                        <p className="text-sm text-slate-400">{initialQuests.length} total quests available.</p>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search quests..."
                            className="pl-9 pr-9 bg-slate-900 border-slate-800"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Grid List */}
                {filteredQuests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                        <Map className="h-12 w-12 text-slate-700 mb-4" />
                        <p className="text-slate-400 font-medium">No quests found.</p>
                        {searchQuery && <p className="text-sm text-slate-500 mt-1">Try adjusting your search query.</p>}
                    </div>
                ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                                            {filteredQuests.map(quest => (
                                                <Card key={quest.id} className="bg-slate-950/80 border-slate-800 hover:border-slate-700 transition-colors flex flex-col group overflow-hidden">
                                                                                    <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-900 border-b border-slate-800">
                                                                                        {quest.bannerUrl ? (
                                                                                            <Image 
                                                                                                src={quest.bannerUrl} 
                                                                                                alt={quest.title} 
                                                                                                fill 
                                                                                                sizes="(max-width: 768px) 100vw, 25vw"
                                                                                                className={cn(
                                                                                                    "transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-100",
                                                                                                    quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                                                                                                    quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                                                                                                )} 
                                                                                            />
                                                                                        ) : (                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 opacity-40">
                                                                <ImageIcon className="w-8 h-8 text-slate-800" />
                                                            </div>
                                                        )}
                                                        <div className="absolute top-3 right-3 flex gap-2">
                                                            {getStatusBadge(quest.status)}
                                                        </div>
                                                        <div className="absolute bottom-3 left-3">
                                                            <Badge variant="secondary" className="bg-slate-950/80 backdrop-blur-md border-slate-700 text-[10px] uppercase tracking-wider font-bold">
                                                                {quest.category ? quest.category.name : "Uncategorized"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <CardHeader className="pb-3 pt-4 flex-1">
                                                        <CardTitle className="text-lg leading-tight group-hover:text-sky-400 transition-colors line-clamp-2">
                                                            {quest.title}
                                                        </CardTitle>
                                                        
                                                        <div className="flex flex-col gap-2 mt-3 text-xs text-slate-400">
                                                            {/* Encounters & Team */}
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex items-center gap-1.5" title="Total Encounters">
                                                                    <Swords className="w-3.5 h-3.5 text-red-400" />
                                                                    <span className="font-medium text-slate-300">{quest.encounters?.length || 0}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5" title="Team Limit">
                                                                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                                                                    <span className="font-medium text-slate-300">{quest.teamLimit || "∞"}</span>
                                                                </div>
                                                                {(quest.minStarLevel || quest.maxStarLevel) && (
                                                                    <div className="flex items-center gap-1.5" title="Star Requirement">
                                                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                                                        <span className="font-medium text-amber-500">
                                                                            {quest.minStarLevel && quest.maxStarLevel ? `${quest.minStarLevel}-${quest.maxStarLevel}★` : quest.minStarLevel ? `${quest.minStarLevel}★+` : `Up to ${quest.maxStarLevel}★`}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Creators */}
                                                            {quest.creators && quest.creators.length > 0 && (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="flex -space-x-1.5">
                                                                        {quest.creators.slice(0, 3).map(c => (
                                                                            <div key={c.id} className="relative w-5 h-5 rounded-full border border-slate-900 overflow-hidden bg-slate-800" title={c.name}>
                                                                                {c.image ? (
                                                                                    <Image src={c.image} alt={c.name} fill className="object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-white uppercase">
                                                                                        {c.name.charAt(0)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {quest.creators.length > 3 && (
                                                                        <span className="text-[10px] text-slate-500">+{quest.creators.length - 3}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            
                                                            {/* Empty State Warning */}
                                                            {quest.encounters?.length === 0 && (
                                                                <div className="flex items-center gap-1.5 text-amber-500/80 mt-1">
                                                                    <FileWarning className="w-3.5 h-3.5" />
                                                                    <span className="text-[10px] font-semibold uppercase tracking-wider">Empty Plan</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardFooter className="pt-0 flex gap-2 border-t border-slate-800/50 mt-4 px-6 py-4 bg-slate-900/20">
                                                        <Button 
                                                            variant="secondary" 
                                                            className="flex-1 bg-slate-800 hover:bg-slate-700 h-9" 
                                                            onClick={() => router.push(`/admin/quests/${quest.id}`)}
                                                        >
                                                            <Edit className="h-4 w-4 mr-2 text-sky-400" /> Edit
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleDuplicate(quest.id)} 
                                                            className="text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/30 shrink-0 h-9 w-9"
                                                            title="Duplicate Quest"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleDelete(quest.id)} 
                                                            className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 shrink-0 h-9 w-9"
                                                            title="Delete Quest"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </CardFooter>
                                                </Card>
                                            ))}
                                        </div>                )}
            </div>
        </div>
    );
}

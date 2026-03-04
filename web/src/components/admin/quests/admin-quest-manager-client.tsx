"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { QuestPlan, QuestCategory, Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, FolderPlus, Map, Search, X, FolderTree } from "lucide-react";
import { createQuestPlan, deleteQuestPlan, createQuestCategory } from "@/app/actions/quests";
import { cn } from "@/lib/utils";

type QuestWithRelations = QuestPlan & {
    category: QuestCategory | null;
    creator: Player | null;
};

interface Props {
    initialQuests: QuestWithRelations[];
    categories: QuestCategory[];
}

export default function AdminQuestManagerClient({ initialQuests, categories }: Props) {
    const router = useRouter();

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
        } catch (error) {
            console.error(error);
            alert("Failed to create quest");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this quest? This action cannot be undone.")) return;
        try {
            await deleteQuestPlan(id);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to delete quest");
        }
    };

    const handleAddCategory = async () => {
        if (!categoryName) return;
        setIsCreatingCategory(true);
        try {
            const res = await createQuestCategory(categoryName);
            if (res.success) {
                setCategoryName("");
                alert("Category created!");
                router.refresh();
            }
        } catch (error) {
            console.error(error);
            alert("Failed to create category");
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
                            <Card key={quest.id} className="bg-slate-950/80 border-slate-800 hover:border-slate-700 transition-colors flex flex-col group">
                                <CardHeader className="pb-3 flex-1">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1.5">
                                            <CardTitle className="text-lg leading-tight group-hover:text-sky-400 transition-colors line-clamp-2">
                                                {quest.title}
                                            </CardTitle>
                                            <Badge variant="secondary" className="bg-slate-900 border-slate-700 text-slate-300 font-normal">
                                                {quest.category ? quest.category.name : "Uncategorized"}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardFooter className="pt-0 flex gap-2 border-t border-slate-800/50 mt-4 px-6 py-4 bg-slate-900/20">
                                    <Button 
                                        variant="secondary" 
                                        className="flex-1 bg-slate-800 hover:bg-slate-700" 
                                        onClick={() => router.push(`/admin/quests/${quest.id}`)}
                                    >
                                        <Edit className="h-4 w-4 mr-2 text-sky-400" /> Edit Builder
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDelete(quest.id)} 
                                        className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 shrink-0"
                                        title="Delete Quest"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

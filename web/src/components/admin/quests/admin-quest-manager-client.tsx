"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestPlan, QuestCategory, Player } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Edit } from "lucide-react";
import { createQuestPlan, deleteQuestPlan } from "@/app/actions/quests";

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

    const handleAdd = async () => {
        if (!title) return;
        try {
            const res = await createQuestPlan({
                title,
                categoryId: categoryId !== "none" ? categoryId : undefined
            });
            if (res.success && res.planId) {
                // Redirect to the builder
                router.push(`/admin/quests/${res.planId}`);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to create quest");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this quest?")) return;
        try {
            await deleteQuestPlan(id);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to delete quest");
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Create Form */}
            <div className="md:col-span-1 space-y-8">
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader>
                        <CardTitle>Create New Quest Plan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Quest Title</Label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. 8.1.3 Psycho-Man Path"
                                className="bg-slate-900 border-slate-800"
                            />
                        </div>

                        <div>
                            <Label>Category</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className="w-full bg-slate-900 border-slate-800">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Category</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button onClick={handleAdd} className="w-full bg-sky-600 hover:bg-sky-500 text-white mt-4 disabled:opacity-50" disabled={!title}>
                            <Plus className="mr-2 h-4 w-4" /> Create & Build
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* List */}
            <div className="md:col-span-2">
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader>
                        <CardTitle>Existing Quests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {initialQuests.length === 0 ? (
                            <p className="text-muted-foreground text-center italic">No quests created yet.</p>
                        ) : (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {initialQuests.map(quest => (
                                    <div key={quest.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 flex items-center justify-between group flex-col sm:flex-row gap-4">
                                        <div>
                                            <h3 className="font-semibold text-slate-200 text-lg">{quest.title}</h3>
                                            <div className="text-sm text-slate-400">
                                                {quest.category ? quest.category.name : "Uncategorized"}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" onClick={() => router.push(`/admin/quests/${quest.id}`)}>
                                                <Edit className="h-4 w-4 mr-2" /> Edit Builder
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(quest.id)} className="text-red-500 hover:bg-red-950/50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

'use client';

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateRelicPrestige } from "../actions";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface RelicPrestigeEditorProps {
    profileId: string;
    initialValue: number | null;
}

export function RelicPrestigeEditor({ profileId, initialValue }: RelicPrestigeEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue?.toString() || "");
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const handleSave = () => {
        const numericValue = parseInt(value, 10);
        if (isNaN(numericValue)) {
            toast({
                title: "Invalid value",
                description: "Please enter a valid number for relic prestige.",
                variant: "destructive"
            });
            return;
        }

        startTransition(async () => {
            try {
                const result = await updateRelicPrestige(profileId, numericValue);
                if (result && 'error' in result) {
                    toast({
                        title: "Failed to update relic prestige",
                        description: result.error,
                        variant: "destructive"
                    });
                    return;
                }
                toast({ title: "Relic prestige updated successfully" });
                setIsEditing(false);
                router.refresh();
            } catch (error) {
                toast({
                    title: "Failed to update relic prestige",
                    description: error instanceof Error ? error.message : "Unknown error",
                    variant: "destructive"
                });
            }
        });
    };

    if (isEditing) {
        return (
            <Card className="bg-slate-900/50 border-indigo-500/50 ring-1 ring-indigo-500/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Relic Prestige</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <style>{`
                            .relic-prestige-input[type='number']::-webkit-inner-spin-button,
                            .relic-prestige-input[type='number']::-webkit-outer-spin-button {
                                -webkit-appearance: none;
                                margin: 0;
                            }
                            .relic-prestige-input[type='number'] {
                                -moz-appearance: textfield;
                            }
                        `}</style>
                        <Input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="relic-prestige-input h-9 bg-slate-950 border-slate-800 text-lg font-bold"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave();
                                if (e.key === "Escape") { setValue(initialValue?.toString() || ""); setIsEditing(false); }
                            }}
                        />
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-9 w-9 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-9 w-9 text-slate-400 hover:text-slate-300 hover:bg-slate-800"
                            onClick={() => { setValue(initialValue?.toString() || ""); setIsEditing(false); }}
                            disabled={isPending}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-900/50 border-slate-800 group hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setIsEditing(true)}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-400">Relic Prestige</CardTitle>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-500 group-hover:text-indigo-400 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                >
                    <Pencil className="w-3 h-3" />
                </Button>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold group-hover:text-indigo-300 transition-colors">{initialValue?.toLocaleString() || "N/A"}</div>
                <p className="text-[10px] text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit manually</p>
            </CardContent>
        </Card>
    );
}

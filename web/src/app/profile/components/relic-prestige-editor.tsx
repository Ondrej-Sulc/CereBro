"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateRelicPrestige } from "../actions";

interface RelicPrestigeEditorProps {
    profileId: string;
    initialValue: number | null;
    automatic?: boolean;
}

export function RelicPrestigeEditor({ profileId, initialValue, automatic = false }: RelicPrestigeEditorProps) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(initialValue?.toString() ?? "");
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const handleSave = () => {
        if (isPending) return;
        const numericValue = Number(value);
        if (!value.trim() || !Number.isSafeInteger(numericValue)) {
            toast({ title: "Invalid value", description: "Please enter a valid number for relic prestige.", variant: "destructive" });
            return;
        }

        startTransition(async () => {
            try {
                const result = await updateRelicPrestige(profileId, numericValue);
                if (result && "error" in result) {
                    toast({ title: "Failed to update relic prestige", description: result.error, variant: "destructive" });
                    router.refresh();
                    return;
                }
                toast({ title: "Relic prestige updated successfully" });
                setOpen(false);
                router.refresh();
            } catch (error) {
                toast({
                    title: "Failed to update relic prestige",
                    description: error instanceof Error ? error.message : "Unknown error",
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <div className="min-w-0 bg-[#0a1120] px-3 py-3 sm:px-5 sm:py-4">
            <dt className="text-xs font-medium text-slate-300">
                <span className="inline-flex items-start gap-1.5">
                    Relic prestige
                    {!automatic && (
                        <Dialog open={open} onOpenChange={next => {
                            if (isPending) return;
                            if (next) setValue(initialValue?.toString() ?? "");
                            setOpen(next);
                        }}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" aria-label="Edit relic prestige" className="-my-1.5 size-7 shrink-0 rounded-md text-indigo-300 hover:bg-indigo-400/15 hover:text-white">
                                    <Pencil className="!size-3" aria-hidden="true" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-slate-700 bg-[#0b1221] sm:rounded-2xl">
                                <DialogHeader className="text-left">
                                    <DialogTitle>Edit relic prestige</DialogTitle>
                                    <DialogDescription className="text-slate-400">Enter the relic prestige shown in the game.</DialogDescription>
                                </DialogHeader>
                                <form className="space-y-4" onSubmit={event => {
                                    event.preventDefault();
                                    handleSave();
                                }}>
                                    <div className="space-y-2">
                                        <Label htmlFor="profile-relic-prestige">Relic prestige</Label>
                                        <Input id="profile-relic-prestige" type="number" value={value} onChange={event => setValue(event.target.value)} disabled={isPending} className="rounded-lg border-slate-700 bg-slate-950" />
                                    </div>
                                    <DialogFooter className="gap-2 sm:space-x-0">
                                        <DialogClose asChild><Button type="button" variant="ghost" disabled={isPending}>Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={isPending} className="bg-indigo-500 text-white hover:bg-indigo-400">
                                            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                                            {isPending ? "Saving…" : "Save prestige"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </span>
            </dt>
            <dd className="mt-1 text-xl font-semibold leading-none tracking-tight text-white tabular-nums sm:text-2xl">{initialValue?.toLocaleString("en-US") ?? "—"}</dd>
            <dd className="mt-1.5 text-xs leading-snug text-slate-400">
                <Link href="/relics?view=personal" title={automatic ? "Calculated from your top 30 relics" : "Track 30 relics to enable automatic prestige"} className="rounded-sm text-indigo-300 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                    {automatic ? "From inventory" : "My relics"}
                </Link>
            </dd>
        </div>
    );
}

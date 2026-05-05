"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl, getMaxRank } from '@/lib/championHelper';
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { ProfileRosterEntry, PrestigePoint } from "../../types";
import { maxSigForRarity, projectMcocPrestigeFromCurve } from "@/lib/mcoc-prestige";

interface EditChampionModalProps {
    item: ProfileRosterEntry | null;
    prestige?: number;
    onClose: () => void;
    onUpdate: (data: Partial<ProfileRosterEntry> & { id: string }) => void;
    onDelete: (id: string) => void;
    onItemChange: (item: ProfileRosterEntry) => void;
}

export function EditChampionModal({ item, prestige: initialPrestige, onClose, onUpdate, onDelete, onItemChange }: EditChampionModalProps) {
    const [prestigeCurves, setPrestigeCurves] = useState<Map<number, PrestigePoint[]>>(new Map());
    const [livePrestige, setLivePrestige] = useState<number | undefined>(undefined);
    const abortRef = useRef<AbortController | null>(null);
    const prevItemId = useRef<string | null>(null);

    const fetchCurve = useCallback(async (championId: number, stars: number, rank: number) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await fetch(
                `/api/profile/champion-prestige?championId=${championId}&rarity=${stars}&rank=${rank}`,
                { signal: controller.signal }
            );
            if (!res.ok) return;
            const data: PrestigePoint[] = await res.json();
            setPrestigeCurves(prev => new Map(prev).set(rank, data));
        } catch { /* aborted or network error */ }
    }, []);

    useEffect(() => {
        if (!item) {
            prevItemId.current = null;
            setPrestigeCurves(new Map());
            setLivePrestige(undefined);
            return;
        }
        if (prevItemId.current !== item.id) {
            prevItemId.current = item.id;
            setPrestigeCurves(new Map());
        }
        fetchCurve(item.championId, item.stars, item.rank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.id, item?.rank]);

    useEffect(() => {
        if (!item) return;
        const curve = prestigeCurves.get(item.rank);
        if (!curve) { setLivePrestige(undefined); return; }
        const computed = projectMcocPrestigeFromCurve({
            curve,
            sigLevel: item.sigLevel || 0,
            rarity: item.stars,
            ascensionLevel: item.ascensionLevel || 0,
        });
        setLivePrestige(computed || undefined);
    }, [item, prestigeCurves]);

    const displayPrestige = livePrestige ?? initialPrestige;

    if (!item) return null;

    const classColors = getChampionClassColors(item.champion.class);
    const maxRank = getMaxRank(item.stars);
    const maxSig = maxSigForRarity(item.stars);
    const sigQuickValues = Array.from(
        new Set([0, 0.25, 0.5, 0.75, 1].map(value => Math.max(0, Math.min(maxSig, Math.round(maxSig * value)))))
    ).sort((a, b) => a - b);
    const heroUrl = getChampionImageUrl(item.champion.images, 'full', 'hero');

    const setSig = (val: number) => {
        const clamped = Math.max(0, Math.min(maxSig, val));
        onItemChange({ ...item, sigLevel: clamped, isAwakened: clamped > 0 ? true : item.isAwakened });
    };

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 p-0 overflow-hidden w-[calc(100vw-2rem)] sm:w-full sm:max-w-[480px] rounded-2xl sm:rounded-2xl gap-0 shadow-2xl">
                <DialogTitle className="sr-only">{item.champion.name}</DialogTitle>
                <DialogDescription className="sr-only">Edit champion details</DialogDescription>

                {/* Full Modal Background Image Layer */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    {/* Blurred background for depth */}
                    <div className="absolute inset-0 opacity-40">
                        <Image src={heroUrl} alt="" fill className="object-cover blur-2xl scale-125 saturate-50" />
                    </div>

                    {/* Class colour ambient glow */}
                    <div 
                        className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-[100px] opacity-40 mix-blend-screen" 
                        style={{ backgroundColor: classColors.color }} 
                    />
                    <div className="absolute inset-x-0 top-0 h-1 z-10 opacity-80" style={{ backgroundColor: classColors.color }} />

                    {/* Hero image: Full width container */}
                    <div className="absolute inset-0 z-10">
                        <Image
                            src={heroUrl}
                            alt={item.champion.name}
                            fill
                            sizes="480px"
                            className="object-cover object-right-top drop-shadow-2xl origin-top-right opacity-80 mix-blend-lighten"
                            priority
                        />
                        {/* Heavy gradient so the bottom half (controls) is solid dark for readability */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/0 via-slate-950/80 to-slate-950" />
                        {/* Left gradient for text readability on the info block */}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
                    </div>
                </div>

                {/* Content Container (sitting on top of the absolute background) */}
                <div className="relative z-10 flex flex-col w-full max-h-[90vh] overflow-y-auto">
                    {/* Header info (pushed down with pt-32 to leave space for the portrait) */}
                    <div className="px-4 pt-32 pb-4 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className={cn("text-xl font-black leading-tight truncate drop-shadow-lg", classColors.text)}>
                                {item.champion.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-bold text-white/90 drop-shadow">
                                    {item.stars}<span className="text-yellow-400 mx-0.5">★</span>R{item.rank}
                                    {item.stars === 7 && (item.ascensionLevel || 0) > 0 && (
                                        <span className="text-amber-400 ml-1">A{item.ascensionLevel}</span>
                                    )}
                                </span>
                                <span
                                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-black/50 border border-white/10"
                                    style={{ color: classColors.color }}
                                >
                                    {item.champion.class}
                                </span>
                            </div>
                        </div>
                        {displayPrestige !== undefined && displayPrestige > 0 && (
                            <div className="text-right shrink-0">
                                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-none mb-0.5">Prestige</p>
                                <p className="text-2xl font-black text-white tabular-nums leading-none drop-shadow">
                                    {displayPrestige.toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="px-4 pb-4 space-y-3">

                    {/* Rank */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Rank</p>
                        <div className="flex gap-1">
                            {Array.from({ length: maxRank }, (_, i) => i + 1).map(r => (
                                <button
                                    key={r}
                                    onClick={() => onItemChange({ ...item, rank: r })}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all border relative overflow-hidden",
                                        item.rank === r
                                            ? cn(classColors.bg, classColors.text, "border-white/30 ring-1 ring-white/10 shadow-lg")
                                            : "bg-slate-800/60 border-slate-700/50 text-slate-500 hover:bg-slate-700/80 hover:text-slate-300 hover:border-slate-600"
                                    )}
                                >
                                    {item.rank === r && (
                                        <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                    )}
                                    <span className="relative z-10">R{r}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-slate-800/80" />

                    {/* Signature */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Signature</p>
                            <button
                                onClick={() => onItemChange({
                                    ...item,
                                    isAwakened: !item.isAwakened,
                                    sigLevel: !item.isAwakened ? Math.max(1, item.sigLevel || 1) : 0,
                                })}
                                className={cn(
                                    "text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all",
                                    item.isAwakened
                                        ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                                        : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                                )}
                            >
                                {item.isAwakened ? "Awakened" : "Not Awakened"}
                            </button>
                        </div>
                        <div className={cn("space-y-1.5 transition-opacity duration-200", !item.isAwakened && "opacity-40 pointer-events-none")}>
                            {/* Stepper row: Grouped as a single pill */}
                            <div className="flex items-center h-10 rounded-lg overflow-hidden border border-slate-700/60 bg-slate-800/40">
                                <button
                                    onClick={() => setSig((item.sigLevel || 0) - 20)}
                                    className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors border-r border-slate-700/50"
                                >
                                    -20
                                </button>
                                <button
                                    onClick={() => setSig((item.sigLevel || 0) - 1)}
                                    className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors"
                                >
                                    -1
                                </button>
                                
                                <input
                                    type="number"
                                    value={item.sigLevel || 0}
                                    min={0}
                                    max={maxSig}
                                    onChange={(e) => {
                                        let val = parseInt(e.target.value);
                                        if (isNaN(val)) val = 0;
                                        setSig(val);
                                    }}
                                    className="flex-1 w-16 h-full text-center text-sm font-black bg-slate-900/50 text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />

                                <button
                                    onClick={() => setSig((item.sigLevel || 0) + 1)}
                                    className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors"
                                >
                                    +1
                                </button>
                                <button
                                    onClick={() => setSig((item.sigLevel || 0) + 20)}
                                    className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors border-l border-slate-700/50"
                                >
                                    +20
                                </button>
                            </div>
                            {/* Quick-jump strip — visually distinct from the stepper */}
                            <div className="flex rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/40">
                                {sigQuickValues.map((v, i) => (
                                    <button
                                        key={v}
                                        onClick={() => setSig(v)}
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-bold transition-all",
                                            i > 0 && "border-l border-slate-700/50",
                                            (item.sigLevel || 0) === v
                                                ? "bg-slate-600 text-white"
                                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/40"
                                        )}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-800/80" />

                    {/* Ascension */}
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Ascension</p>
                        {item.stars === 7 ? (
                            <div className="flex gap-1">
                                {[0, 1, 2, 3, 4, 5].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => onItemChange({ ...item, ascensionLevel: level, isAscended: level > 0 })}
                                        className={cn(
                                            "flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all relative overflow-hidden",
                                            (item.ascensionLevel || 0) === level
                                                ? "bg-amber-500/20 border-amber-400/30 text-amber-400 ring-1 ring-amber-400/10 shadow-lg shadow-amber-900/20"
                                                : "bg-slate-800/60 border-slate-700/50 text-slate-500 hover:bg-slate-700/80 hover:text-slate-300 hover:border-slate-600"
                                        )}
                                    >
                                        {(item.ascensionLevel || 0) === level && (
                                            <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                        )}
                                        <span className="relative z-10">{level === 0 ? "—" : `A${level}`}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <button
                                onClick={() => onItemChange({ ...item, isAscended: !item.isAscended })}
                                className={cn(
                                    "w-full py-2 rounded-lg text-xs font-bold border transition-all relative overflow-hidden",
                                    item.isAscended
                                        ? "bg-amber-500/20 border-amber-400/30 text-amber-400 ring-1 ring-amber-400/10 shadow-lg shadow-amber-900/20"
                                        : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 hover:border-slate-600"
                                )}
                            >
                                {item.isAscended && (
                                    <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                )}
                                <span className="relative z-10">{item.isAscended ? "✦ Ascended" : "Not Ascended"}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 mt-auto backdrop-blur-sm shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onUpdate({ id: item.id, rank: item.rank, isAwakened: item.isAwakened, isAscended: item.isAscended, ascensionLevel: item.ascensionLevel, sigLevel: item.sigLevel })}
                            className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-900/20 border-t border-sky-400/30"
                        >
                            Save Changes
                        </Button>
                    </div>
                </div>
            </div>
            </DialogContent>
        </Dialog>
    );
}

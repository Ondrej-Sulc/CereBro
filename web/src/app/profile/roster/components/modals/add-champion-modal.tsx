"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { Champion } from "@/types/champion";
import { getChampionImageUrl, getMaxRank } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface NewChampionFormData {
    championId: number | null;
    stars: number;
    rank: number;
    sigLevel: number;
    isAwakened: boolean;
    isAscended: boolean;
    ascensionLevel: number;
}

interface AddChampionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    allChampions: Champion[];
    onAdd: () => void;
    newChampion: NewChampionFormData;
    onNewChampionChange: (data: NewChampionFormData) => void;
}

export function AddChampionModal({ open, onOpenChange, allChampions, onAdd, newChampion, onNewChampionChange }: AddChampionModalProps) {
    const selectedChampion = allChampions.find(c => c.id === newChampion.championId);
    const classColors = selectedChampion ? getChampionClassColors(selectedChampion.class) : null;
    const heroUrl = selectedChampion ? getChampionImageUrl(selectedChampion.images, 'full', 'hero') : null;

    const maxRank = getMaxRank(newChampion.stars);
    const maxSig = newChampion.stars >= 5 ? 200 : 99;
    const sigQuickValues = newChampion.stars >= 5 ? [0, 50, 100, 150, 200] : [0, 25, 50, 75, 99];

    const setSig = (val: number) => {
        const clamped = Math.max(0, Math.min(maxSig, val));
        onNewChampionChange({ ...newChampion, sigLevel: clamped, isAwakened: clamped > 0 ? true : newChampion.isAwakened });
    };

    const handleStarChange = (newStars: number) => {
        const newMaxRank = getMaxRank(newStars);
        const clampedRank = Math.min(newChampion.rank, newMaxRank);
        const newMaxSig = newStars >= 5 ? 200 : 99;
        const clampedSig = Math.min(newChampion.sigLevel, newMaxSig);
        onNewChampionChange({...newChampion, stars: newStars, rank: clampedRank, sigLevel: clampedSig});
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 p-0 overflow-hidden w-[calc(100vw-2rem)] sm:w-full sm:max-w-[480px] rounded-2xl sm:rounded-2xl gap-0 shadow-2xl">
                <DialogTitle className="sr-only">Add Champion</DialogTitle>
                <DialogDescription className="sr-only">Manually add a champion to your roster.</DialogDescription>

                {/* Full Modal Background Image Layer (only if champion is selected) */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    {heroUrl && classColors && selectedChampion ? (
                        <>
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
                                    alt={selectedChampion.name}
                                    fill
                                    sizes="480px"
                                    className="object-cover object-right-top drop-shadow-2xl origin-top-right opacity-80 mix-blend-lighten"
                                    priority
                                />
                                {/* Heavy gradient so the bottom half (controls) is solid dark for readability */}
                                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/0 via-slate-950/90 to-slate-950" />
                                {/* Left gradient for text readability on the info block */}
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/50 to-transparent" />
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
                    )}
                </div>

                {/* Content Container */}
                <div className="relative z-10 flex flex-col w-full h-full max-h-[90vh] overflow-y-auto">
                    {/* Header info / Champion Selection */}
                    <div className={cn("px-4 pb-4 flex flex-col gap-3", selectedChampion ? "pt-16" : "pt-6")}>
                        <div className="space-y-1.5 z-20">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Select Champion</p>
                            <ChampionCombobox 
                                champions={allChampions} 
                                value={newChampion.championId ? String(newChampion.championId) : ""} 
                                onSelect={(val) => onNewChampionChange({...newChampion, championId: val ? parseInt(val) : null})} 
                                className="bg-slate-900/60 border-slate-700/50 text-slate-200 w-full backdrop-blur-md hover:bg-slate-800/80 transition-colors" 
                            />
                        </div>

                        {selectedChampion && classColors && (
                            <div className="mt-4 min-w-0">
                                <p className={cn("text-2xl font-black leading-tight truncate drop-shadow-lg", classColors.text)}>
                                    {selectedChampion.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span
                                        className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/50 border border-white/10"
                                        style={{ color: classColors.color }}
                                    >
                                        {selectedChampion.class}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="px-4 pb-4 space-y-4">
                        {/* Stars & Rank */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Stars</p>
                                <div className="flex gap-1">
                                    {[4, 5, 6, 7].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => handleStarChange(s)}
                                            className={cn(
                                                "flex-1 py-2 rounded-lg text-xs font-bold transition-all border relative overflow-hidden",
                                                newChampion.stars === s
                                                    ? "bg-slate-700 text-white border-white/30 ring-1 ring-white/10 shadow-lg"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300"
                                            )}
                                        >
                                            {newChampion.stars === s && (
                                                <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                            )}
                                            <span className="relative z-10">{s}★</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Rank</p>
                                <div className="flex gap-1">
                                    {Array.from({ length: maxRank }, (_, i) => i + 1).map(r => (
                                        <button
                                            key={r}
                                            onClick={() => onNewChampionChange({ ...newChampion, rank: r })}
                                            className={cn(
                                                "flex-1 py-2 rounded-lg text-xs font-bold transition-all border relative overflow-hidden",
                                                newChampion.rank === r
                                                    ? cn(classColors ? classColors.bg : "bg-slate-700", classColors ? classColors.text : "text-white", "border-white/30 ring-1 ring-white/10 shadow-lg")
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300"
                                            )}
                                        >
                                            {newChampion.rank === r && (
                                                <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                            )}
                                            <span className="relative z-10">R{r}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-800/60" />

                        {/* Signature */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Signature</p>
                                <button
                                    onClick={() => onNewChampionChange({
                                        ...newChampion,
                                        isAwakened: !newChampion.isAwakened,
                                        sigLevel: !newChampion.isAwakened ? Math.max(1, newChampion.sigLevel || 1) : 0,
                                    })}
                                    className={cn(
                                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all",
                                        newChampion.isAwakened
                                            ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                                            : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    {newChampion.isAwakened ? "Awakened" : "Not Awakened"}
                                </button>
                            </div>
                            <div className={cn("space-y-1.5 transition-opacity duration-200", !newChampion.isAwakened && "opacity-40 pointer-events-none")}>
                                {/* Stepper row */}
                                <div className="flex items-center h-10 rounded-lg overflow-hidden border border-slate-700/60 bg-slate-800/40">
                                    <button
                                        onClick={() => setSig(newChampion.sigLevel - 20)}
                                        className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors border-r border-slate-700/50"
                                    >
                                        -20
                                    </button>
                                    <button
                                        onClick={() => setSig(newChampion.sigLevel - 1)}
                                        className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors"
                                    >
                                        -1
                                    </button>
                                    
                                    <input
                                        type="number"
                                        value={newChampion.sigLevel || 0}
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
                                        onClick={() => setSig(newChampion.sigLevel + 1)}
                                        className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors"
                                    >
                                        +1
                                    </button>
                                    <button
                                        onClick={() => setSig(newChampion.sigLevel + 20)}
                                        className="px-3 h-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-black transition-colors border-l border-slate-700/50"
                                    >
                                        +20
                                    </button>
                                </div>
                                {/* Quick-jump strip */}
                                <div className="flex rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/40">
                                    {sigQuickValues.map((v, i) => (
                                        <button
                                            key={v}
                                            onClick={() => setSig(v)}
                                            className={cn(
                                                "flex-1 py-1.5 text-[10px] font-bold transition-all",
                                                i > 0 && "border-l border-slate-700/50",
                                                newChampion.sigLevel === v
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

                        <div className="border-t border-slate-800/60" />

                        {/* Ascension */}
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Ascension</p>
                            {newChampion.stars === 7 ? (
                                <div className="flex gap-1">
                                    {[0, 1, 2, 3, 4, 5].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => onNewChampionChange({ ...newChampion, ascensionLevel: level, isAscended: level > 0 })}
                                            className={cn(
                                                "flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all relative overflow-hidden",
                                                newChampion.ascensionLevel === level
                                                    ? "bg-amber-500/20 border-amber-400/30 text-amber-400 ring-1 ring-amber-400/10 shadow-lg shadow-amber-900/20"
                                                    : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300"
                                            )}
                                        >
                                            {newChampion.ascensionLevel === level && (
                                                <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                            )}
                                            <span className="relative z-10">{level === 0 ? "—" : `A${level}`}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <button
                                    onClick={() => onNewChampionChange({ ...newChampion, isAscended: !newChampion.isAscended })}
                                    className={cn(
                                        "w-full py-2 rounded-lg text-xs font-bold border transition-all relative overflow-hidden",
                                        newChampion.isAscended
                                            ? "bg-amber-500/20 border-amber-400/30 text-amber-400 ring-1 ring-amber-400/10 shadow-lg shadow-amber-900/20"
                                            : "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200"
                                    )}
                                >
                                    {newChampion.isAscended && (
                                        <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                                    )}
                                    <span className="relative z-10">{newChampion.isAscended ? "✦ Ascended" : "Not Ascended"}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 mt-auto backdrop-blur-sm shrink-0">
                        <div className="flex-1" /> {/* Spacer */}
                        <div className="flex gap-2">
                            <Button variant="outline" className="border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={onAdd}
                                disabled={!newChampion.championId}
                                className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-900/20 border-t border-sky-400/30 disabled:opacity-50 disabled:grayscale"
                            >
                                Add to Roster
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

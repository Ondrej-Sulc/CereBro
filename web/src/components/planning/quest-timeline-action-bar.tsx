"use client";

import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Difficulty = "EASY" | "NORMAL" | "HARD";

export function QuestTimelineActionBar({
    difficultyFilter,
    filteredEncounterCount,
    totalEncounterCount,
    readOnly,
    onToggleDifficulty,
    onClearDifficultyFilter,
    onOpenClearPlan,
}: {
    difficultyFilter: Difficulty[];
    filteredEncounterCount: number;
    totalEncounterCount: number;
    readOnly: boolean;
    onToggleDifficulty: (difficulty: Difficulty) => void;
    onClearDifficultyFilter: () => void;
    onOpenClearPlan: () => void;
}) {
    return (
        <div className="-mt-2 mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pl-6 md:pl-10">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Difficulty</span>
                <div className="flex flex-wrap items-center gap-1.5">
                    {(["HARD", "NORMAL", "EASY"] as const).map(difficulty => {
                        const isActive = difficultyFilter.includes(difficulty);
                        const label = difficulty === "HARD" ? "Hard" : difficulty === "NORMAL" ? "Normal" : "Easy";
                        const activeClass = difficulty === "HARD"
                            ? "border-red-500/50 bg-red-950/60 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                            : difficulty === "NORMAL"
                                ? "border-amber-500/50 bg-amber-950/60 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                                : "border-emerald-500/50 bg-emerald-950/60 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.12)]";
                        const inactiveClass = "border-slate-800 bg-slate-900/60 text-slate-500 hover:border-slate-700 hover:text-slate-400";

                        return (
                            <button
                                key={difficulty}
                                onClick={() => onToggleDifficulty(difficulty)}
                                className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-200",
                                    isActive ? activeClass : inactiveClass
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                    {difficultyFilter.length > 0 && (
                        <button
                            onClick={onClearDifficultyFilter}
                            className="flex items-center gap-0.5 rounded-full border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 transition-all duration-200 hover:border-slate-700 hover:text-slate-300"
                        >
                            <X className="h-2.5 w-2.5" />
                            All
                        </button>
                    )}
                </div>
                {difficultyFilter.length > 0 && (
                    <span className="ml-1 text-[9px] text-slate-600">
                        {filteredEncounterCount}/{totalEncounterCount} fights
                    </span>
                )}
            </div>

            {!readOnly && (
                <button
                    onClick={onOpenClearPlan}
                    title="Clear all counter and prefight selections"
                    className="flex shrink-0 items-center gap-1 rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 transition-all duration-200 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-400"
                >
                    <Trash2 className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Clear Plan</span>
                </button>
            )}
        </div>
    );
}

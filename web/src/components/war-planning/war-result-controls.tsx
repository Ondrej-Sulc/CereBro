"use client";

import { useId } from "react";
import { WarResult } from "@prisma/client";
import { motion } from "framer-motion";
import { CircleHelp, Minus, Plus, Skull, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultSwitchProps {
    id?: string;
    value: WarResult;
    onChange: (value: WarResult) => void;
}

export function ResultSwitch({ id, value, onChange }: ResultSwitchProps) {
    const layoutId = useId();
    const options = [
        { 
            id: WarResult.LOSS, 
            label: "Loss", 
            icon: XCircle, 
            activeColor: "bg-red-500/20 text-red-400 border-red-500/30" 
        },
        { 
            id: WarResult.UNKNOWN, 
            label: "Unknown", 
            icon: CircleHelp, 
            activeColor: "bg-slate-800 text-slate-300 border-slate-700" 
        },
        { 
            id: WarResult.WIN, 
            label: "Win", 
            icon: Trophy, 
            activeColor: "bg-green-500/20 text-green-400 border-green-500/30" 
        },
    ];

    const activeIndex = options.findIndex(opt => opt.id === value);
    const safeIndex = activeIndex === -1 ? 1 : activeIndex; // Default to UNKNOWN

    return (
        <div id={id} className="relative flex p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-16">
            <motion.div
                className={cn(
                    "absolute top-1 bottom-1 rounded-lg border shadow-sm z-0",
                    options[safeIndex].activeColor
                )}
                layoutId={`${layoutId}-result-slider`}
                initial={false}
                animate={{
                    left: `calc(${(safeIndex * 100) / 3}% + 4px)`,
                    width: `calc(33.33% - 8px)`,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
            />

            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange(option.id)}
                    className={cn(
                        "relative z-10 flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200",
                        value === option.id ? "text-white" : "text-slate-500 hover:text-slate-400"
                    )}
                >
                    <option.icon className={cn("w-5 h-5", value === option.id ? "" : "opacity-60")} />
                    <span className="text-[10px] uppercase tracking-wider font-bold">{option.label}</span>
                </button>
            ))}
        </div>
    );
}

interface DeathCounterProps {
    id?: string;
    value: number;
    onChange: (value: number) => void;
}

export function DeathCounter({ id, value, onChange }: DeathCounterProps) {
    const increment = () => onChange(value + 1);
    const decrement = () => onChange(Math.max(0, value - 1));

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={decrement}
                aria-label="Decrease deaths"
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 active:scale-95 transition-all"
            >
                <Minus className="w-5 h-5" />
            </button>
            
            <div className="flex-1 relative h-12 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center group focus-within:border-slate-600 transition-colors">
                <Skull className="absolute left-4 w-4 h-4 text-slate-700 group-hover:text-slate-500 transition-colors" />
                <input
                    id={id}
                    type="number"
                    value={value}
                    aria-label="Number of deaths"
                    onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onChange(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full h-full bg-transparent text-center text-xl font-bold text-white focus:outline-none no-spin-buttons pr-2"
                />
            </div>

            <button
                type="button"
                onClick={increment}
                aria-label="Increase deaths"
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 active:scale-95 transition-all"
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>
    );
}

"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { ChampionClass } from "@prisma/client";
import { CLASSES, CLASS_ICONS } from "../constants";

interface ClassFilterToggleProps {
    selectedClasses: ChampionClass[];
    onChange: (next: ChampionClass[]) => void;
    size?: "sm" | "icon";
    className?: string;
}

export function ClassFilterToggle({ selectedClasses, onChange, size = "icon", className }: ClassFilterToggleProps) {
    const toggleClass = (c: ChampionClass) => {
        if (selectedClasses.includes(c)) {
            onChange(selectedClasses.filter(cls => cls !== c));
        } else {
            onChange([...selectedClasses, c]);
        }
    };

    return (
        <div className={cn("flex items-center gap-1 bg-slate-950/40 p-1 rounded-lg border border-slate-800/50", className)}>
            {CLASSES.map(c => {
                const colors = getChampionClassColors(c);
                const isSelected = selectedClasses.includes(c);
                return (
                    <Button
                        key={c} variant="ghost" size={size}
                        className={cn(
                            "rounded-md transition-all border shrink-0",
                            size === "icon" ? "h-7 w-7 p-1" : "h-8 w-8 p-1.5",
                            isSelected ? cn(colors.bg, colors.border, "shadow-sm") : "bg-transparent border-transparent hover:bg-slate-800"
                        )}
                        onClick={() => toggleClass(c)}
                        title={c}
                    >
                        <div className="relative w-full h-full">
                            <Image src={CLASS_ICONS[c as Exclude<ChampionClass, 'SUPERIOR'>]} alt={c} fill sizes="24px" className="object-contain" />
                        </div>
                    </Button>
                );
            })}
        </div>
    );
}

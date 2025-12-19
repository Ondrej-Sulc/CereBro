"use client";

import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
  } from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface SeasonSelectorProps {
    seasons: number[];
    currentSeason: number;
}

export function SeasonSelector({ seasons, currentSeason }: SeasonSelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSeasonChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("season", value);
        
        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    return (
        <Select 
            value={currentSeason.toString()} 
            onValueChange={handleSeasonChange}
            disabled={isPending}
        >
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-slate-200">
                <SelectValue placeholder="Select Season" />
            </SelectTrigger>
            <SelectContent>
                {seasons.map(s => (
                    <SelectItem key={s} value={s.toString()}>
                        Season {s}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

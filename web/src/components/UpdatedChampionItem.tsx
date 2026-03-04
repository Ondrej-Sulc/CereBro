import { memo } from "react";
import Image from "next/image";
import { getChampionImageUrl, getStarBorderClass } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { CLASS_ICONS } from "@/app/profile/roster/constants";
import { ChampionClass } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getChampionClassColors } from "@/lib/championClassHelper";

export interface ChampionData {
    id: number;
    name: string;
    championClass: ChampionClass;
    images: ChampionImages;
}

export interface RosterWithChampion {
    stars: number;
    rank: number;
    isAwakened?: boolean;
    sigLevel?: number;
    powerRating?: number | null;
    champion: ChampionData;
}

export const UpdatedChampionItem = memo(({ 
    item,
    isSelected,
    isRecommended,
    isMissing,
    variant = "square"
}: { 
    item: RosterWithChampion;
    isSelected?: boolean;
    isRecommended?: boolean;
    isMissing?: boolean;
    variant?: "square" | "tall";
}) => {
    const borderClass = isMissing ? "border-slate-800" : getStarBorderClass(item.stars);
    
    if (variant === "tall") {
        const classColors = getChampionClassColors(item.champion.championClass);
        return (
            <div
                className={cn(
                    "group relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all duration-300 shadow-lg",
                    classColors.bg,
                    borderClass,
                    isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10",
                    isRecommended && !isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
                    isMissing && "opacity-60 grayscale hover:grayscale-0 cursor-not-allowed"
                )}
            >
                <Image
                    src={getChampionImageUrl(item.champion.images, 'full')}
                    alt={item.champion.name}
                    fill
                    sizes="120px"
                    className="object-cover transition-transform group-hover:scale-105 p-1"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

                <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5 z-10">
                    {!isMissing ? (
                        <>
                            <div className="bg-black/80 border border-white/20 text-white text-[9px] px-1 py-0 h-4 font-black leading-none rounded-sm flex items-center">
                                {item.stars}<span className="text-yellow-500 mx-0.5">★</span>R{item.rank}
                            </div>
                            {item.isAwakened && (
                                <div className="bg-sky-950/80 border border-sky-500/30 text-sky-400 text-[9px] px-1 py-0 h-4 font-bold leading-none rounded-sm flex items-center">
                                    S{item.sigLevel}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-slate-900/80 border border-slate-700 text-slate-400 text-[9px] px-1 py-0 h-4 font-bold leading-none rounded-sm flex items-center">
                            Missing
                        </div>
                    )}
                </div>

                <div className="absolute top-1 right-1 flex flex-col items-end gap-1 z-10">
                    <div className={cn("p-1 rounded-full bg-black/80 border border-white/10 shadow-sm", classColors.text)}>
                        <div className="relative w-3.5 h-3.5">
                            <Image
                                src={CLASS_ICONS[item.champion.championClass]}
                                alt={item.champion.championClass}
                                fill
                                sizes="14px"
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>

                {isSelected && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-sky-500 rounded-full p-1 shadow-md border border-sky-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                    <p className="text-[10px] font-bold text-white leading-tight truncate text-center drop-shadow-sm">{item.champion.name}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col rounded-lg overflow-hidden border-2 bg-slate-950/50 group transition-all duration-300 shadow-lg relative",
            borderClass,
            isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10",
            isRecommended && !isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
            isMissing && "opacity-60 grayscale hover:grayscale-0 cursor-not-allowed"
        )}>
            {/* Top Section: Smaller Portrait */}
            <div className="relative aspect-square w-full overflow-hidden bg-slate-900/50 border-b border-slate-800/50">
                <Image
                    src={getChampionImageUrl(item.champion.images, '128')}
                    alt={item.champion.name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Selection Checkmark */}
                {isSelected && (
                    <div className="absolute top-1.5 right-1.5 z-30 bg-sky-500 rounded-full p-0.5 shadow-md border border-sky-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                )}

                {/* Awakened Frame Glow */}
                {item.isAwakened && !isMissing && (
                    <div className="absolute inset-0 border border-sky-400/20 pointer-events-none group-hover:border-sky-400/40 transition-colors" />
                )}
            </div>

            {/* Bottom Section: Info (3 Lines) */}
            <div className="p-1 space-y-0 bg-slate-950">
                {/* Line 1: Name */}
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white truncate uppercase tracking-tight">
                        {item.champion.name}
                    </span>
                </div>

                {/* Line 2: Star, Rank, Sig */}
                <div className="flex items-center gap-1 text-[10px]">
                    {!isMissing ? (
                        <>
                            <span className={`font-black ${item.isAwakened ? 'text-sky-400' : 'text-yellow-500'}`}>
                                {item.stars}★
                            </span>
                            <span className="font-bold text-slate-300">R{item.rank}</span>
                            {item.isAwakened && typeof item.sigLevel === 'number' && (
                                <span className="font-black text-sky-400">S{item.sigLevel}</span>
                            )}
                        </>
                    ) : (
                        <span className="font-bold text-slate-500">Not in roster</span>
                    )}
                </div>

                {/* Line 3: Class & Rating */}
                <div className="flex items-center justify-between gap-1 mt-0.5 h-[14px]">
                    <Image
                        src={CLASS_ICONS[item.champion.championClass]}
                        alt={item.champion.championClass}
                        title={item.champion.championClass}
                        width={12}
                        height={12}
                        className="opacity-80"
                    />
                    {!isMissing && (
                        <span className="text-[10px] font-mono font-medium text-slate-400">
                            {item.powerRating !== null && item.powerRating !== undefined ? item.powerRating.toLocaleString() : '---'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});
UpdatedChampionItem.displayName = "UpdatedChampionItem";

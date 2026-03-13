import { memo } from "react";
import { Trophy } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl, getStarBorderClass, getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
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
    isAscended?: boolean;
    powerRating?: number | null;
    champion: ChampionData;
}

export const UpdatedChampionItem = memo(({
    item,
    isSelected,
    isRecommended,
    isMissing,
    isInTeam,
    variant = "square"
}: {
    item: RosterWithChampion;
    isSelected?: boolean;
    isRecommended?: boolean;
    isMissing?: boolean;
    isInTeam?: boolean;
    variant?: "square" | "tall";
}) => {
    const borderClass = isMissing ? "border-slate-800" : getStarBorderClass(item.stars);
    const classColors = getChampionClassColors(item.champion.championClass);

    if (variant === "tall") {
        return (
            <div
                className={cn(
                    "group relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all duration-300 shadow-lg",
                    classColors.bg,
                    borderClass,
                    isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10",
                    isRecommended && !isSelected && !isInTeam && "ring-2 ring-offset-2 ring-offset-slate-950 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
                    isInTeam && !isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
                    isMissing && "opacity-60 grayscale hover:grayscale-0 cursor-not-allowed"
                )}
            >
                <Image
                    src={getChampionImageUrlOrPlaceholder(item.champion.images, 'full')}
                    alt={item.champion.name}
                    fill
                    sizes="120px"
                    className="object-cover transition-transform group-hover:scale-105 p-1"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

                <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5 z-10">
                    {!isMissing ? (
                        <>
                            {item.stars > 0 && item.rank > 0 && (
                                <div className="bg-black/80 border border-white/20 text-white text-[9px] px-1 py-0 h-4 font-black leading-none rounded-sm flex items-center">
                                    {item.stars}<span className="text-yellow-500 mx-0.5">★</span>R{item.rank}
                                </div>
                            )}
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
                    {item.isAscended && (
                        <div className="bg-yellow-900/80 p-0.5 rounded border border-yellow-500/30 shadow-sm" title="Ascended">
                            <Trophy className="w-2.5 h-2.5 text-yellow-400 fill-yellow-500" />
                        </div>
                    )}
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
                
                {isInTeam && !isSelected && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-emerald-600/90 rounded border border-emerald-900 shadow-md px-1.5 py-0.5 backdrop-blur-sm">
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">In Team</span>
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
            "flex flex-col rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group transition-all duration-300 relative",
            isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10",
            isRecommended && !isSelected && !isInTeam && "ring-2 ring-offset-2 ring-offset-slate-950 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
            isInTeam && !isSelected && "ring-2 ring-offset-2 ring-offset-slate-950 ring-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10",
            isMissing && "opacity-60 grayscale hover:grayscale-0 cursor-not-allowed"
        )}>
            {/* Top Section: Smaller Portrait */}
            <div className={cn(
                "relative aspect-square w-full overflow-hidden border-b-2",
                classColors.bg,
                isMissing ? "border-slate-800" : getStarBorderClass(item.stars)
            )}>
                <Image
                    src={getChampionImageUrlOrPlaceholder(item.champion.images, '128')}
                    alt={item.champion.name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Selection Checkmark */}
                {isSelected && (
                    <div className="absolute top-1 right-1 z-30 bg-sky-500 rounded-full p-0.5 shadow-md border border-sky-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                )}
                
                {isInTeam && !isSelected && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 bg-emerald-600/90 rounded border border-emerald-900 shadow-sm px-1 py-0 backdrop-blur-sm">
                        <span className="text-[8px] font-black text-white uppercase tracking-wider">In Team</span>
                    </div>
                )}

                {/* Class Icon Overlay */}
                <div className="absolute bottom-1 right-1 z-20 h-5 w-5 bg-black/80 rounded-sm border border-white/10 flex items-center justify-center p-0.5 shadow-sm">
                    <Image
                        src={CLASS_ICONS[item.champion.championClass]}
                        alt={item.champion.championClass}
                        width={14}
                        height={14}
                        className="object-contain"
                    />
                </div>

                {/* Ascension Overlay */}
                {item.isAscended && (
                    <div className="absolute top-1 right-1 z-20 h-5 w-5 bg-yellow-950/80 rounded-sm border border-yellow-500/30 flex items-center justify-center p-0.5 shadow-sm">
                        <Trophy className="w-3 h-3 text-yellow-400 fill-yellow-500" />
                    </div>
                )}
            </div>

            {/* Bottom Section: Compact Info */}
            <div className="p-1 space-y-0.5">
                <div className="text-[10px] font-bold text-white truncate uppercase tracking-tight leading-tight">
                    {item.champion.name}
                </div>

                <div className="flex items-center gap-1.5 text-[9px] font-bold">
                    {!isMissing ? (
                        <>
                            {item.stars > 0 && item.rank > 0 && (
                                <span className={item.isAwakened ? 'text-sky-400' : 'text-yellow-500'}>
                                    {item.stars}★ R{item.rank}
                                </span>
                            )}
                            {item.isAwakened && typeof item.sigLevel === 'number' && (
                                <span className="text-sky-400 bg-sky-950/50 px-1 rounded-sm border border-sky-800/50">
                                    S{item.sigLevel}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-slate-500">Not in roster</span>
                    )}
                </div>
            </div>
        </div>
    );
});
UpdatedChampionItem.displayName = "UpdatedChampionItem";

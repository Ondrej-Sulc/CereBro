import { memo } from "react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { CLASS_ICONS } from "@/app/profile/roster/constants";
import { ChampionClass } from "@prisma/client";

export interface ChampionData {
    id: number;
    name: string;
    championClass: string;
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

export const UpdatedChampionItem = memo(({ item }: { item: RosterWithChampion }) => {
    return (
        <div className="flex flex-col rounded-lg overflow-hidden border border-slate-800 bg-slate-950/50 group hover:border-sky-500/50 transition-all duration-300 shadow-xl">
            {/* Top Section: Smaller Portrait */}
            <div className="relative aspect-video w-full overflow-hidden bg-slate-900/50 border-b border-slate-800/50">
                <Image
                    src={getChampionImageUrl(item.champion.images, '128')}
                    alt={item.champion.name}
                    width={128}
                    height={128}
                    className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-500"
                />

                {/* Awakened Frame Glow */}
                {item.isAwakened && (
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
                    <span className={`font-black ${item.isAwakened ? 'text-sky-400' : 'text-yellow-500'}`}>
                        {item.stars}★
                    </span>
                    <span className="font-bold text-slate-300">R{item.rank}</span>
                    {item.isAwakened && typeof item.sigLevel === 'number' && (
                        <span className="font-black text-sky-400">S{item.sigLevel}</span>
                    )}
                </div>

                {/* Line 3: Class & Rating */}
                <div className="flex items-center justify-between gap-1 mt-0.5">
                    {item.champion.championClass !== 'SUPERIOR' ? (
                        <Image
                            src={CLASS_ICONS[item.champion.championClass as keyof typeof CLASS_ICONS]}
                            alt={item.champion.championClass}
                            title={item.champion.championClass}
                            width={12}
                            height={12}
                            className="opacity-80"
                        />
                    ) : (
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            {item.champion.championClass}
                        </span>
                    )}
                    <span className="text-[10px] font-mono font-medium text-slate-400">
                        {item.powerRating !== null && item.powerRating !== undefined ? item.powerRating.toLocaleString() : '---'}
                    </span>
                </div>
            </div>
        </div>
    );
});
UpdatedChampionItem.displayName = "UpdatedChampionItem";

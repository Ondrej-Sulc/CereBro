"use client";

import { memo } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Edit2, Shield, Zap, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionImages } from "@/types/champion";
import { ChampionClass } from "@prisma/client";
import { ProfileRosterEntry, FilterState } from "../types";
import { CLASS_ICONS } from "../constants";

interface ChampionCardProps {
    item: ProfileRosterEntry;
    prestige?: number;
    onClick: (item: ProfileRosterEntry) => void;
    mode: 'view' | 'edit';
    filters: FilterState;
}

export const ChampionCard = memo(({ item, prestige, onClick, mode, filters }: ChampionCardProps) => {
    const classColors = getChampionClassColors(item.champion.class);
    
    const cardContent = (
        <div 
            className={cn(
                "group relative aspect-[3/4] rounded-lg overflow-hidden border transition-colors cursor-pointer bg-slate-900",
                classColors.bg,
                "border-slate-800 hover:border-slate-500"
            )}
            onClick={() => mode === 'edit' && onClick(item)}
        >
            <Image 
                src={getChampionImageUrl(item.champion.images as unknown as ChampionImages, 'full')} 
                alt={item.champion.name}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16vw, 10vw"
                className="object-cover transition-transform group-hover:scale-105 p-1"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

            <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5 z-10">
                <Badge variant="outline" className="bg-black/80 border-white/20 text-white text-[9px] px-1 py-0 h-4 font-black leading-none backdrop-blur-sm">
                    {item.stars}<span className="text-yellow-500 mx-0.5">★</span>R{item.rank}
                </Badge>
                {item.isAwakened && (
                    <Badge variant="outline" className="bg-sky-950/80 border-sky-500/30 text-sky-400 text-[9px] px-1 py-0 h-4 font-bold leading-none backdrop-blur-sm">
                        S{item.sigLevel}
                    </Badge>
                )}
            </div>

            <div className="absolute top-1 right-1 flex flex-col items-end gap-1 z-10">
                {item.isAscended && (
                    <div className="bg-yellow-900/80 p-1 rounded border border-yellow-500/30 shadow-sm backdrop-blur-sm" title="Ascended">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                    </div>
                )}
                
                <div className="hidden sm:block">
                    <div className={cn("p-1 rounded-full bg-black/80 border border-white/10 shadow-sm backdrop-blur-sm", classColors.text)}>
                        <div className="relative w-4 h-4">
                            <Image 
                                src={CLASS_ICONS[item.champion.class as Exclude<ChampionClass, 'SUPERIOR'>]} 
                                alt={item.champion.class} 
                                fill
                                sizes="16px"
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                {prestige && (
                     <div className="hidden sm:flex justify-end mb-0.5">
                        <span className="text-[9px] font-mono font-bold text-slate-300 bg-black/60 px-1 rounded border border-white/5">
                            {prestige.toLocaleString('en-US')}
                        </span>
                     </div>
                )}
                <p className="text-[10px] sm:text-xs font-bold text-white leading-tight truncate text-center sm:text-left drop-shadow-sm">{item.champion.name}</p>
            </div>

            {mode === 'edit' && (
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-sky-600 p-2 rounded-full scale-75 group-hover:scale-100 transition-transform">
                            <Edit2 className="w-4 h-4 text-white" />
                        </div>
                </div>
            )}
        </div>
    );

    if (mode === 'view') {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    {cardContent}
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800 shadow-xl z-50">
                    <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
                        <div className={cn("relative w-10 h-10 rounded border", classColors.border)}>
                            <Image 
                                src={getChampionImageUrl(item.champion.images as unknown as ChampionImages, '64') || '/icons/unknown.png'} 
                                alt={item.champion.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-slate-100">{item.champion.name}</div>
                            <div className={cn("text-[10px] font-bold uppercase", classColors.text)}>{item.champion.class}</div>
                        </div>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                        <div className="p-3 space-y-4">
                            {(() => {
                                const isFilteringAbilities = filters.abilities.length > 0 || filters.immunities.length > 0 || filters.categories.length > 0;
                                const isFilteringTags = filters.tags.length > 0;
                                const isFiltering = isFilteringAbilities || isFilteringTags;
                                
                                if (!isFiltering) {
                                    return <div className="text-xs text-slate-500 text-center italic py-4">Select filters to view specific champion details.</div>;
                                }

                                const relevantAbilities = isFilteringAbilities ? (item.champion.abilities || []).filter(a => {
                                    if (filters.abilities.length > 0 && a.type === 'ABILITY' && filters.abilities.includes(a.ability.name)) return true;
                                    if (filters.immunities.length > 0 && a.type === 'IMMUNITY' && filters.immunities.includes(a.ability.name)) return true;
                                    if (filters.categories.length > 0 && a.type === 'ABILITY' && a.ability.categories.some(c => filters.categories.includes(c.name))) return true;
                                    return false;
                                }) : [];

                                const abilities = relevantAbilities.filter(a => a.type === 'ABILITY');
                                const immunities = relevantAbilities.filter(a => a.type === 'IMMUNITY');
                                const tags = isFilteringTags 
                                    ? (item.champion.tags || []).filter(t => filters.tags.includes(t.name)) 
                                    : [];

                                if (abilities.length === 0 && immunities.length === 0 && tags.length === 0) {
                                     return <div className="text-xs text-slate-500 text-center italic">No matching details found.</div>;
                                }
                                
                                const groupItems = (items: typeof abilities) => {
                                    const grouped = items.reduce((acc, curr) => {
                                        const name = curr.ability.name;
                                        if (!acc[name]) {
                                            acc[name] = { name, instances: [] as { 
                                                source: string | null, 
                                                synergyChampions: { name: string; images: ChampionImages }[] 
                                            }[] };
                                        }
                                        acc[name].instances.push({
                                            source: curr.source,
                                            synergyChampions: curr.synergyChampions.map(s => ({
                                                name: s.champion.name,
                                                images: s.champion.images as unknown as ChampionImages
                                            }))
                                        });
                                        return acc;
                                    }, {} as Record<string, { 
                                        name: string, 
                                        instances: { 
                                            source: string | null, 
                                            synergyChampions: { name: string; images: ChampionImages }[] 
                                        }[] 
                                    }>);
                                    return Object.values(grouped);
                                };

                                const displayAbilities = groupItems(abilities);
                                const displayImmunities = groupItems(immunities);

                                return (
                                    <>
                                        {displayImmunities.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                                                    <Shield className="w-3.5 h-3.5" />
                                                    Immunities
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {displayImmunities.map((imm, i) => (
                                                        <Badge 
                                                            key={i} 
                                                            variant="secondary" 
                                                            className="bg-sky-950/50 border-sky-800 text-sky-300 hover:bg-sky-900 text-[11px] px-2 py-1 h-auto whitespace-normal text-left items-start"
                                                        >
                                                            <div className="flex items-start gap-1.5">
                                                                <span className="font-semibold whitespace-nowrap">{imm.name}</span>
                                                                {imm.instances.some(inst => inst.source || inst.synergyChampions.length > 0) && (
                                                                    <div className="flex flex-col pl-1.5 border-l border-white/10">
                                                                        {imm.instances.map((inst, idx) => (
                                                                            <div key={idx} className={cn("flex items-center gap-1.5 py-0.5", idx > 0 && "border-t border-white/5")}>
                                                                                {inst.synergyChampions.length > 0 && (
                                                                                    <div className="flex -space-x-1.5">
                                                                                        {inst.synergyChampions.map((sc, scIdx) => (
                                                                                                <div key={scIdx} className="relative w-5 h-5 rounded-full border border-slate-900 overflow-hidden ring-1 ring-slate-700 shrink-0" title={sc.name}>
                                                                                                    <Image src={getChampionImageUrl(sc.images as unknown as ChampionImages, '64') || '/icons/unknown.png'} alt={sc.name} fill className="object-cover" />
                                                                                                </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                {inst.source && <span className="font-normal opacity-70 text-[10px] leading-tight">{inst.source}</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {displayAbilities.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                                                    <Zap className="w-3.5 h-3.5" />
                                                    Abilities
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {displayAbilities.map((ab, i) => (
                                                        <Badge 
                                                            key={i} 
                                                            variant="secondary" 
                                                            className="bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/60 text-[11px] px-2 py-1 h-auto whitespace-normal text-left items-start"
                                                        >
                                                            <div className="flex items-start gap-1.5">
                                                                <span className="font-semibold whitespace-nowrap">{ab.name}</span>
                                                                {ab.instances.some(inst => inst.source || inst.synergyChampions.length > 0) && (
                                                                    <div className="flex flex-col pl-1.5 border-l border-white/10">
                                                                        {ab.instances.map((inst, idx) => (
                                                                            <div key={idx} className={cn("flex items-center gap-1.5 py-0.5", idx > 0 && "border-t border-white/5")}>
                                                                                {inst.synergyChampions.length > 0 && (
                                                                                    <div className="flex -space-x-1.5">
                                                                                        {inst.synergyChampions.map((sc, scIdx) => (
                                                                                                <div key={scIdx} className="relative w-5 h-5 rounded-full border border-slate-900 overflow-hidden ring-1 ring-slate-700 shrink-0" title={sc.name}>
                                                                                                    <Image src={getChampionImageUrl(sc.images as unknown as ChampionImages, '64') || '/icons/unknown.png'} alt={sc.name} fill className="object-cover" />
                                                                                                </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                {inst.source && <span className="font-normal opacity-70 text-[10px] leading-tight">{inst.source}</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {tags.length > 0 && (
                                             <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                                    <TagIcon className="w-3.5 h-3.5" />
                                                    Matching Tags
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {tags.map((tag, i) => (
                                                        <Badge key={i} variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                                            {tag.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
        );
    }

    return cardContent;
});
ChampionCard.displayName = 'ChampionCard';

"use client";

import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Trophy, Edit2, Swords, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStarBorderClass, getChampionImageUrlOrPlaceholder, isChampionImages } from '@/lib/championHelper';
import { getChampionClassColors } from "@/lib/championClassHelper";
import { rosterChampionPageParams } from "@/lib/champion-page-state";
import { hasRosterKitOverview } from "@/lib/roster-kit";
import { ChampionImages } from "@/types/champion";
import { ProfileRosterEntry } from "../types";
import { CLASS_ICONS } from "../constants";

interface ChampionCardProps {
    item: ProfileRosterEntry;
    prestige?: number;
    onClick: (item: ProfileRosterEntry) => void;
    mode: 'view' | 'edit';
    onQuickView: (item: ProfileRosterEntry) => void;
    catalogMode?: boolean;
    canManageAttackReservations?: boolean;
    onToggleAttackReservation?: (item: ProfileRosterEntry) => void;
}

export const ChampionCard = memo(({ item, prestige, onClick, onQuickView, mode, catalogMode = false, canManageAttackReservations = false, onToggleAttackReservation }: ChampionCardProps) => {
    const classColors = getChampionClassColors(item.champion.class);
    const nonPlayable = item.champion.isPlayable === false;
    const editing = mode === 'edit' && !nonPlayable;
    const showUnownedState = !!item.isUnowned && !catalogMode && !nonPlayable;
    const label = `${editing ? 'Edit' : 'View'} ${item.champion.name}`;
    let detailsHref: string | undefined;
    if (!editing && item.champion.slug && !hasRosterKitOverview(item.champion.abilities, item.stars || undefined)) {
        const build = !catalogMode && !item.isUnowned && !nonPlayable ? item : undefined;
        const query = rosterChampionPageParams(build).toString();
        detailsHref = `/champions/${encodeURIComponent(item.champion.slug)}${query ? `?${query}` : ''}`;
    }

    const borderClass = showUnownedState
        ? 'border-slate-700 border-dashed'
        : nonPlayable || catalogMode && item.isUnowned
            ? 'border-slate-800 shadow-black/10'
            : getStarBorderClass(item.stars);
    const activateCard = () => {
        if (editing) {
            if (!item.isUnowned) onClick(item);
        } else {
            onQuickView(item);
        }
    };

    const cardContent = (
        <div
            className={cn(
                "group relative aspect-[3/4] rounded-lg overflow-hidden border cursor-pointer bg-slate-900 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 hover:border-white/20",
                classColors.bg,
                borderClass,
                !catalogMode && "aspect-[4/5] rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
                showUnownedState && "grayscale-[0.45] saturate-[0.7] brightness-[0.9] opacity-75 hover:grayscale-[0.25] hover:saturate-[0.85] hover:brightness-[0.95] hover:opacity-90 transition-all duration-300"
            )}
            role={detailsHref ? undefined : "button"}
            tabIndex={detailsHref ? undefined : 0}
            data-roster-entry-id={item.id}
            aria-label={detailsHref ? undefined : label}
            aria-haspopup={detailsHref ? undefined : "dialog"}
            onClick={detailsHref ? undefined : activateCard}
            onKeyDown={detailsHref ? undefined : event => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activateCard();
                }
            }}
        >
            {detailsHref && <Link href={detailsHref} aria-label={label} prefetch={false}
                className="absolute inset-0 z-20 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400" />}
            <Image
                src={getChampionImageUrlOrPlaceholder(item.champion.images as unknown as ChampionImages, 'full')}
                alt={item.champion.name}
                fill
                sizes={catalogMode
                    ? "(min-width: 1536px) 120px, (min-width: 1280px) 8.34vw, (min-width: 1024px) 10vw, (min-width: 768px) 12.5vw, (min-width: 640px) 16.67vw, 20vw"
                    : "(min-width: 1440px) 135px, (min-width: 1280px) 10vw, (min-width: 1024px) 12.5vw, (min-width: 768px) 16.67vw, (min-width: 640px) 20vw, (min-width: 420px) 25vw, 33vw"}
                className="object-cover p-1 transition-transform duration-300 group-hover:scale-[1.07]"
            />
            {!isChampionImages(item.champion.images) && <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-slate-600"><UserRound className="h-14 w-14" strokeWidth={1} /></div>}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

            <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5 z-10">
                {nonPlayable && <Badge variant="outline" className="bg-slate-950/90 border-slate-500/40 text-slate-200 text-[8px] px-1 py-0 h-4 leading-none">NPC &amp; legacy</Badge>}
                {!nonPlayable && !item.isUnowned && (
                    <>
                        <Badge variant="outline" className="bg-black/80 border-white/20 text-white text-[9px] px-1 py-0 h-4 font-black leading-none">
                            {item.stars}<span className="text-yellow-500 mx-0.5">★</span>R{item.rank}{item.stars === 7 && item.ascensionLevel > 0 && <span className="text-amber-400 ml-0.5">A{item.ascensionLevel}</span>}
                        </Badge>
                        {item.isAwakened && (
                            <Badge variant="outline" className="bg-sky-950/80 border-sky-500/30 text-sky-400 text-[9px] px-1 py-0 h-4 font-bold leading-none">
                                S{item.sigLevel}
                            </Badge>
                        )}
                    </>
                )}
            </div>

            <div className={cn("absolute top-1 right-1 flex flex-col items-end gap-1", detailsHref ? "pointer-events-none z-30" : "z-10")}>
                {!nonPlayable && !item.isUnowned && item.isAscended && (
                    <div className="bg-yellow-900/80 p-1 rounded border border-yellow-500/30 shadow-sm" title="Ascended">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                    </div>
                )}

                {!nonPlayable && !item.isUnowned && canManageAttackReservations && onToggleAttackReservation && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={item.reservedForAttack ? "Remove attack reservation" : "Reserve for attack"}
                                    aria-pressed={item.reservedForAttack}
                                    className={cn(
                                        "pointer-events-auto h-6 w-6 rounded-full border bg-black/80 p-0 shadow-sm",
                                        item.reservedForAttack
                                            ? "border-amber-400/60 text-amber-300 hover:bg-amber-950/80 hover:text-amber-200"
                                            : "border-white/10 text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                                    )}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onToggleAttackReservation(item);
                                    }}
                                >
                                    <Swords className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                {item.reservedForAttack ? "Reserved for attack" : "Reserve for attack"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                <div className="hidden sm:block">
                    <div className={cn("p-1 rounded-full bg-black/80 border border-white/10 shadow-sm", classColors.text)}>
                        <div className="relative w-4 h-4">
                            <Image
                                src={CLASS_ICONS[item.champion.class] || "/assets/icons/glossary.svg"}
                                alt={item.champion.class}
                                fill
                                sizes="16px"
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-1.5", !catalogMode && "px-2 pb-2 pt-4")}>
                {!nonPlayable && !item.isUnowned && prestige && (
                    <div className="flex justify-end mb-0.5">
                        <span className="text-[9px] font-mono font-bold text-slate-300 bg-black/60 px-1 rounded border border-white/5">
                            {prestige.toLocaleString('en-US')}
                        </span>
                    </div>
                )}
                <p className={cn("text-center text-[10px] font-bold leading-tight text-white drop-shadow-sm sm:text-left sm:text-xs", catalogMode ? "truncate" : "line-clamp-2 break-words text-xs")} title={item.champion.name}>{item.champion.name}</p>
            </div>

            {editing && !item.isUnowned && (
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-sky-600 p-2 rounded-full scale-75 group-hover:scale-100 transition-transform">
                        <Edit2 className="w-4 h-4 text-white" />
                    </div>
                </div>
            )}
        </div>
    );

    return cardContent;
});
ChampionCard.displayName = 'ChampionCard';

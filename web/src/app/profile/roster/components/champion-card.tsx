"use client";

import { memo, type CSSProperties, type ReactNode, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ExternalLink, Trophy, Edit2, Shield, Zap, Tag as TagIcon, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStarBorderClass, getChampionImageUrlOrPlaceholder } from '@/lib/championHelper';
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionImages } from "@/types/champion";
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
    const [quickOpen, setQuickOpen] = useState(false);
    const classColors = getChampionClassColors(item.champion.class);

    const borderClass = item.isUnowned ? 'border-slate-700 border-dashed' : getStarBorderClass(item.stars);
    const abilityEntries = (item.champion.abilities || []).filter(a => a.type === 'ABILITY');
    const immunityEntries = (item.champion.abilities || []).filter(a => a.type === 'IMMUNITY');
    const displayAbilities = groupItems(abilityEntries, {
        matchedNames: filters.abilities,
        matchedCategories: filters.categories,
    });
    const displayImmunities = groupItems(immunityEntries, {
        matchedNames: filters.immunities,
        matchedCategories: [],
    });
    const highlightedTags = filters.tags.length > 0
        ? (item.champion.tags || []).filter(t => filters.tags.includes(t.name))
        : (item.champion.tags || []).slice(0, 12);

    const cardContent = (
        <div
            className={cn(
                "group relative aspect-[3/4] rounded-lg overflow-hidden border transition-colors cursor-pointer bg-slate-900 shadow-lg",
                classColors.bg,
                borderClass,
                item.isUnowned && "grayscale opacity-60 hover:grayscale-[0.3] hover:opacity-100 transition-all duration-300"
            )}
            onClick={() => {
                if (mode === 'edit') {
                    if (item.isUnowned) return;
                    onClick(item);
                } else {
                    setQuickOpen(true);
                }
            }}
        >
            <Image
                src={getChampionImageUrlOrPlaceholder(item.champion.images as unknown as ChampionImages, 'full')}
                alt={item.champion.name}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16vw, 10vw"
                className="object-cover transition-transform group-hover:scale-105 p-1"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

            <div className="absolute top-1 left-1 flex flex-col items-start gap-0.5 z-10">
                {item.isUnowned ? (
                    <Badge variant="outline" className="bg-slate-900/80 border-slate-500/50 text-slate-300 text-[9px] px-1 py-0 h-4 font-bold leading-none tracking-wide">
                        UNOWNED
                    </Badge>
                ) : (
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

            <div className="absolute top-1 right-1 flex flex-col items-end gap-1 z-10">
                {!item.isUnowned && item.isAscended && (
                    <div className="bg-yellow-900/80 p-1 rounded border border-yellow-500/30 shadow-sm" title="Ascended">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                    </div>
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

            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                {!item.isUnowned && prestige && (
                    <div className="flex justify-end mb-0.5">
                        <span className="text-[9px] font-mono font-bold text-slate-300 bg-black/60 px-1 rounded border border-white/5">
                            {prestige.toLocaleString('en-US')}
                        </span>
                    </div>
                )}
                <p className="text-[10px] sm:text-xs font-bold text-white leading-tight truncate text-center sm:text-left drop-shadow-sm">{item.champion.name}</p>
            </div>

            {mode === 'edit' && !item.isUnowned && (
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
            <>
                {cardContent}
                <QuickChampionDialog
                    item={item}
                    prestige={prestige}
                    open={quickOpen}
                    onOpenChange={setQuickOpen}
                    classColors={classColors}
                    displayAbilities={displayAbilities}
                    displayImmunities={displayImmunities}
                    highlightedTags={highlightedTags}
                    matchingTagsOnly={filters.tags.length > 0}
                />
            </>
        );
    }

    return cardContent;
});
ChampionCard.displayName = 'ChampionCard';

type DetailItem = {
    name: string;
    iconUrl: string | null;
    gameGlossaryTermId: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    description?: string | null;
    matched: boolean;
    instances: {
        source: string | null;
        synergyChampions: { name: string; images: ChampionImages }[];
    }[];
};

function normalizeHexColor(color: string): string | undefined {
    if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`;
    if (/^[0-9a-fA-F]{8}$/.test(color)) return `#${color.slice(0, 6)}`;
    return undefined;
}

function QuickChampionDialog({
    item,
    prestige,
    open,
    onOpenChange,
    classColors,
    displayAbilities,
    displayImmunities,
    highlightedTags,
    matchingTagsOnly,
}: {
    item: ProfileRosterEntry;
    prestige?: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classColors: ReturnType<typeof getChampionClassColors>;
    displayAbilities: DetailItem[];
    displayImmunities: DetailItem[];
    highlightedTags: { id: string | number; name: string }[];
    matchingTagsOnly: boolean;
}) {
    const heroUrl = getChampionImageUrlOrPlaceholder(item.champion.images as unknown as ChampionImages, 'full', 'hero');
    const portraitUrl = getChampionImageUrlOrPlaceholder(item.champion.images as unknown as ChampionImages, 'full');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 p-0 overflow-hidden w-[calc(100vw-2rem)] sm:w-full sm:max-w-[560px] lg:max-w-[900px] rounded-2xl gap-0 shadow-2xl">
                <DialogTitle className="sr-only">{item.champion.name}</DialogTitle>
                <DialogDescription className="sr-only">Champion quick details</DialogDescription>

                {/* Ambient background */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    {/* Blurred colour wash */}
                    <div className="absolute inset-0 opacity-30">
                        <Image src={heroUrl} alt="" fill className="object-cover blur-3xl scale-125 saturate-50" />
                    </div>
                    <div className="absolute inset-0 bg-slate-950/50" />

                    {/* Hero art — visible on the right, fading left */}
                    <div className="absolute inset-0 overflow-hidden">
                        <Image
                            src={heroUrl}
                            alt=""
                            fill
                            sizes="900px"
                            className="object-cover object-right-top opacity-55 mix-blend-lighten drop-shadow-2xl"
                            priority={false}
                        />
                        {/* Fade left so it doesn't clash with the portrait panel */}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/60 to-slate-950/10" />
                        {/* Fade bottom */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/0 via-slate-950/50 to-slate-950/90" />
                    </div>

                    {/* Class glow */}
                    <div
                        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-[120px] opacity-25 mix-blend-screen"
                        style={{ backgroundColor: classColors.color }}
                    />
                </div>


                <TooltipProvider>
                    {/* Content */}
                    <div className="relative z-10 flex flex-col w-full max-h-[92vh]">
                        {/* Top accent line */}
                        <div className="absolute inset-x-0 top-0 h-px z-20 opacity-90" style={{ backgroundColor: classColors.color }} />

                    {/* ── Header: portrait + name/stats ── */}
                    <div className="flex gap-0 lg:gap-0 min-h-[220px]">
                        {/* Portrait */}
                        <div className="relative shrink-0 w-36 lg:w-52 self-stretch overflow-hidden">
                            <Image
                                src={heroUrl}
                                alt=""
                                fill
                                sizes="(max-width: 1024px) 144px, 208px"
                                className="object-cover object-center opacity-25 blur-md scale-110"
                                priority
                            />
                            <Image
                                src={portraitUrl}
                                alt={item.champion.name}
                                fill
                                sizes="(max-width: 1024px) 144px, 208px"
                                className="object-cover object-top p-1"
                                priority
                            />
                            {/* Edge fade */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/80" />
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/60" />
                        </div>

                        {/* Name / stats */}
                        <div className="flex-1 min-w-0 px-4 pt-5 pb-4 flex flex-col justify-between gap-3">
                            <div className="space-y-2">
                                {/* Class badge */}
                                <span
                                    className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-current/20 bg-black/30"
                                    style={{ color: classColors.color }}
                                >
                                    {item.champion.class}
                                </span>

                                {/* Name */}
                                <h2 className={cn("text-3xl lg:text-4xl font-black leading-none tracking-tight drop-shadow-lg", classColors.text)}>
                                    {item.champion.name}
                                </h2>

                                {/* Stats row */}
                                {item.isUnowned ? (
                                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Unowned</span>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 border border-white/10 px-2.5 py-1 text-sm font-black text-white">
                                            {item.stars}<span className="text-yellow-400">★</span> R{item.rank}
                                        </span>
                                        {item.isAwakened && (
                                            <span className="inline-flex items-center rounded-lg bg-sky-950/60 border border-sky-500/30 px-2.5 py-1 text-sm font-black text-sky-300">
                                                S{item.sigLevel}
                                            </span>
                                        )}
                                        {item.stars === 7 && (item.ascensionLevel || 0) > 0 && (
                                            <span className="inline-flex items-center rounded-lg bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 text-sm font-black text-amber-300">
                                                A{item.ascensionLevel}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Prestige */}
                            {prestige !== undefined && prestige > 0 && (
                                <div className="flex items-end gap-2">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest leading-none mb-1">Prestige</p>
                                        <p className="text-4xl font-black text-white tabular-nums leading-none drop-shadow" style={{ color: classColors.color }}>
                                            {prestige.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-slate-800/80" />

                    {/* ── Body: abilities / tags ── */}
                    <ScrollArea className="max-h-[50vh]">
                        <div className="space-y-5 px-4 py-4">
                            <DetailGroup title="Immunities" icon={<Shield className="w-4 h-4" />} items={displayImmunities} tone="sky" emptyText="No immunities recorded." />
                            <DetailGroup title="Abilities" icon={<Zap className="w-4 h-4" />} items={displayAbilities} tone="amber" emptyText="No abilities recorded." />

                            {highlightedTags.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                                        <TagIcon className="w-4 h-4" />
                                        {matchingTagsOnly ? "Matching Tags" : "Tags"}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {highlightedTags.map((tag, i) => (
                                            <Badge key={i} variant="outline" className="text-xs border-slate-700 bg-slate-900/70 text-slate-300 px-2.5 py-1">
                                                <Hash className="mr-1 h-3 w-3 text-slate-500" />
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* ── Footer ── */}
                    <div className="flex items-center justify-end gap-3 px-4 py-3 bg-slate-950/70 border-t border-slate-800/80 backdrop-blur-sm shrink-0">
                        <Button variant="ghost" className="text-slate-400 hover:text-slate-200 hover:bg-slate-800" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                        {item.champion.slug && (
                            <Button asChild className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-900/30 border-t border-sky-400/30 font-bold">
                                <Link href={`/champions/${item.champion.slug}`}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Full Details
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </TooltipProvider>
            </DialogContent>
        </Dialog>
    );
}



function groupItems(
    items: ProfileRosterEntry['champion']['abilities'],
    filters: { matchedNames: string[]; matchedCategories: string[] }
): DetailItem[] {
    const grouped = items.reduce((acc, curr) => {
        const name = curr.ability.name;
        if (!acc[name]) {
            const raw = curr.ability.gameGlossaryTerm?.raw as any;
            acc[name] = { 
                name, 
                iconUrl: curr.ability.iconUrl ?? null,
                gameGlossaryTermId: curr.ability.gameGlossaryTermId ?? null,
                primaryColor: typeof raw?.color_primary === "string" ? normalizeHexColor(raw.color_primary) : undefined,
                secondaryColor: typeof raw?.color_secondary === "string" ? normalizeHexColor(raw.color_secondary) : undefined,
                description: curr.ability.description,
                matched: false, 
                instances: [] 
            };
        }
        const categoryNames = curr.ability.categories.map(category => category.name);
        if (
            filters.matchedNames.includes(name) ||
            categoryNames.some(category => filters.matchedCategories.includes(category))
        ) {
            acc[name].matched = true;
        }
        acc[name].instances.push({
            source: curr.source,
            synergyChampions: (curr.synergyChampions || []).map(s => ({
                name: s.champion.name,
                images: s.champion.images as unknown as ChampionImages
            }))
        });
        return acc;
    }, {} as Record<string, DetailItem>);
    return Object.values(grouped).sort((a, b) => {
        if (a.matched !== b.matched) return a.matched ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

function DetailGroup({
    title,
    icon,
    items,
    tone,
    emptyText,
}: {
    title: string;
    icon: ReactNode;
    items: DetailItem[];
    tone: "sky" | "amber";
    emptyText?: string;
}) {
    const matchedCount = items.filter(item => item.matched).length;
    const defaultColor = tone === "sky" ? "#38bdf8" : "#fbbf24";

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <div className={cn("flex items-center gap-1.5 text-xs font-bold", tone === "sky" ? "text-sky-400" : "text-amber-400")}>
                    {icon}
                    {title}
                </div>
                {matchedCount > 0 && (
                    <span className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
                        tone === "sky"
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    )}>
                        {matchedCount} matched
                    </span>
                )}
            </div>
            {items.length > 0 ? (
                <div className="grid gap-1.5 lg:grid-cols-2">
                    {items.map((item, i) => {
                        const itemColor = item.primaryColor || defaultColor;
                        const itemContent = (
                            <div
                                className={cn(
                                    "rounded-lg border px-2.5 py-2 shadow-sm backdrop-blur-sm transition-colors w-full",
                                    item.matched
                                        ? tone === "sky"
                                            ? "border-sky-400/50 bg-sky-950/45 ring-1 ring-sky-400/15"
                                            : "border-amber-400/50 bg-amber-950/40 ring-1 ring-amber-400/15"
                                        : tone === "sky"
                                            ? "border-sky-900/45 bg-slate-950/45"
                                            : "border-amber-900/45 bg-slate-950/45"
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {item.iconUrl && (
                                                <div
                                                    className="shrink-0 h-5 w-5"
                                                    style={{
                                                        backgroundColor: itemColor,
                                                        maskImage: `url(${item.iconUrl})`,
                                                        maskSize: 'contain',
                                                        maskRepeat: 'no-repeat',
                                                        maskPosition: 'center',
                                                        WebkitMaskImage: `url(${item.iconUrl})`,
                                                        WebkitMaskSize: 'contain',
                                                        WebkitMaskRepeat: 'no-repeat',
                                                        WebkitMaskPosition: 'center',
                                                    }}
                                                />
                                            )}
                                            <span 
                                                className="text-sm font-bold leading-snug"
                                                style={{ color: item.primaryColor ? itemColor : undefined }}
                                            >
                                                {item.name}
                                            </span>
                                            {item.matched && (
                                                <span className={cn(
                                                    "rounded px-1 py-0.5 text-[9px] font-black uppercase leading-none",
                                                    tone === "sky" ? "bg-sky-400/15 text-sky-200" : "bg-amber-400/15 text-amber-200"
                                                )}>
                                                    Match
                                                </span>
                                            )}
                                        </div>
                                        {item.instances.some(inst => inst.source) && (
                                            <div className="mt-0.5 flex flex-wrap gap-1">
                                                {item.instances
                                                    .filter(inst => inst.source)
                                                    .map((inst, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] leading-tight text-slate-400"
                                                        >
                                                            {inst.source}
                                                        </span>
                                                    ))}
                                            </div>
                                        )}
                                    </div>

                                    {item.instances.some(inst => inst.synergyChampions.length > 0) && (
                                        <div className="flex shrink-0 -space-x-1.5 pt-0.5">
                                            {item.instances.flatMap(inst => inst.synergyChampions).slice(0, 5).map((sc, scIdx) => (
                                                <div key={scIdx} className="relative h-6 w-6 overflow-hidden rounded-full border border-slate-950 ring-1 ring-slate-700" title={sc.name}>
                                                    <Image src={getChampionImageUrlOrPlaceholder(sc.images, '64')} alt={sc.name} fill className="object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );

                        if (item.description) {
                            return (
                                <Tooltip key={i}>
                                    <TooltipTrigger asChild>
                                        <button className="text-left w-full focus:outline-none">
                                            {itemContent}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent 
                                        side="top" 
                                        className="max-w-[300px] bg-slate-900 border-slate-800 text-slate-200 p-3 shadow-2xl"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                                {item.iconUrl && (
                                                    <div
                                                        className="shrink-0 h-5 w-5"
                                                        style={{
                                                            backgroundColor: itemColor,
                                                            maskImage: `url(${item.iconUrl})`,
                                                            maskSize: 'contain',
                                                            maskRepeat: 'no-repeat',
                                                            maskPosition: 'center',
                                                            WebkitMaskImage: `url(${item.iconUrl})`,
                                                            WebkitMaskSize: 'contain',
                                                            WebkitMaskRepeat: 'no-repeat',
                                                            WebkitMaskPosition: 'center',
                                                        }}
                                                    />
                                                )}
                                                <span className="font-bold text-sm" style={{ color: itemColor }}>
                                                    {item.name}
                                                </span>
                                            </div>
                                            <p className="text-xs leading-relaxed text-slate-300">
                                                {item.description}
                                            </p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        return <div key={i} className="w-full">{itemContent}</div>;
                    })}
                </div>
            ) : (
                <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 px-3 py-2 text-xs text-slate-500">
                    {emptyText ?? "None"}
                </div>
            )}
        </div>
    );
}

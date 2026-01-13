'use client';

import { useState, useMemo } from 'react';
import { AllianceRosterEntry } from '@/app/actions/alliance-roster';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChampionClass } from "@prisma/client";
import { Filter, CircleOff, Trophy, Check, ChevronsUpDown, X, SlidersHorizontal, Shield, Zap, BookOpen, Tag as TagIcon } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import Image from "next/image";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlipToggle } from "@/components/ui/flip-toggle";

const CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"];

const FilterGroup = ({ options, value, onChange, className }: { options: { value: string, label: string }[], value: string, onChange: (v: string) => void, className?: string }) => (
    <div className={cn("flex items-center bg-slate-950 rounded-md border border-slate-800 p-1 shrink-0 overflow-x-auto no-scrollbar", className)}>
        {options.map(opt => (
            <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => onChange(opt.value)}
                className={cn(
                    "h-7 px-3 text-xs whitespace-nowrap",
                    value === opt.value ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
            >
                {opt.label}
            </Button>
        ))}
    </div>
);

interface MultiSelectFilterProps {
    title: string;
    icon: React.ElementType;
    options: { id: string | number, name: string }[];
    selectedValues: string[];
    onSelect: (values: string[]) => void;
    placeholder?: string;
    logic: 'AND' | 'OR';
    onLogicChange: (logic: 'AND' | 'OR') => void;
}

const MultiSelectFilter = ({ title, icon: Icon, options, selectedValues, onSelect, placeholder, logic, onLogicChange }: MultiSelectFilterProps) => {
    const [open, setOpen] = useState(false);

    const toggleValue = (val: string) => {
        if (selectedValues.includes(val)) {
            onSelect(selectedValues.filter(v => v !== val));
        } else {
            onSelect([...selectedValues, val]);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-9 border-slate-700 bg-slate-950 text-slate-300 justify-between min-w-[150px]">
                    <div className="flex items-center gap-2 truncate">
                        <Icon className="w-3.5 h-3.5" />
                        {selectedValues.length > 0 ? (
                            <span className="text-slate-100">{selectedValues.length} selected</span>
                        ) : (
                            <span>{title}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0 bg-slate-950 border-slate-800" align="start">
                <div className="p-2 border-b border-slate-800 bg-slate-900/50">
                    <FlipToggle
                        value={logic === 'AND'}
                        onChange={(val) => onLogicChange(val ? 'AND' : 'OR')}
                        leftLabel="OR"
                        rightLabel="AND"
                        className="w-full"
                    />
                </div>
                <Command className="bg-slate-950 text-slate-300">
                    <CommandInput placeholder={placeholder || `Search ${title}...`} className="h-9" />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                            <CommandItem
                                value="clear_filter"
                                onSelect={() => onSelect([])}
                                className="text-xs font-bold text-red-400"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear Filter
                            </CommandItem>
                            {options.map(opt => (
                                <CommandItem
                                    key={opt.id}
                                    value={opt.name}
                                    onSelect={() => toggleValue(opt.name)}
                                    className="text-xs"
                                >
                                    <div className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-slate-700",
                                        selectedValues.includes(opt.name) ? "bg-slate-100 text-slate-900" : "opacity-50 [&_svg]:invisible"
                                    )}>
                                        <Check className={cn("h-3 w-3")} />
                                    </div>
                                    {opt.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

interface ClientPageProps {
    data: AllianceRosterEntry[];
    initialTactics: any[];
    initialTags: any[];
    initialAbilityCategories: any[];
    initialAbilities: any[];
    initialImmunities: any[];
    season: number;
    bgColors: Record<number, string>;
}

export function AllianceRosterMatrix({ 
    data, 
    initialTactics, 
    initialTags, 
    initialAbilityCategories,
    initialAbilities,
    initialImmunities,
    season, 
    bgColors 
}: ClientPageProps) {
    // Filters
    const [bgFilter, setBgFilter] = useState<string>("ALL");
    const [classFilter, setClassFilter] = useState<ChampionClass[]>([]);
    const [starFilter, setStarFilter] = useState<string>("ALL");
    const [minRankFilter, setMinRankFilter] = useState<string>("0");
    const [limitFilter, setLimitFilter] = useState<string>("10");
    const [showFilters, setShowFilters] = useState(false);

    // Multi-Select Filters
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('AND');

    const [abilityCategoryFilter, setAbilityCategoryFilter] = useState<string[]>([]);
    const [abilityCategoryLogic, setAbilityCategoryLogic] = useState<'AND' | 'OR'>('OR'); // Default to OR for categories usually

    const [abilityFilter, setAbilityFilter] = useState<string[]>([]);
    const [abilityLogic, setAbilityLogic] = useState<'AND' | 'OR'>('AND');

    const [immunityFilter, setImmunityFilter] = useState<string[]>([]);
    const [immunityLogic, setImmunityLogic] = useState<'AND' | 'OR'>('AND');


    // Derived Data
    const players = useMemo(() => {
        const uniquePlayers = new Map();
        data.forEach(d => {
            if (!uniquePlayers.has(d.playerId)) {
                uniquePlayers.set(d.playerId, {
                    id: d.playerId,
                    name: d.ingameName,
                    bg: d.battlegroup,
                    avatar: d.avatar
                });
            }
        });
        return Array.from(uniquePlayers.values()).sort((a, b) => {
            // Sort by BG then Name
            if (a.bg !== b.bg) return (a.bg || 9) - (b.bg || 9);
            return a.name.localeCompare(b.name);
        });
    }, [data]);

    const filteredPlayers = useMemo(() => {
        if (bgFilter === "ALL") return players;
        return players.filter(p => p.bg === parseInt(bgFilter));
    }, [players, bgFilter]);

    const getFilteredChampionsForPlayer = (playerId: string) => {
        const filtered = data.filter(entry => {
            if (entry.playerId !== playerId) return false;
            
            // Class
            if (classFilter.length > 0 && !classFilter.includes(entry.championClass)) return false;
            
            // Stars
            if (starFilter !== "ALL" && entry.stars !== parseInt(starFilter)) return false;
            
            // Min Rank
            if (parseInt(minRankFilter) > 0 && entry.rank < parseInt(minRankFilter)) return false;
            
            // Tag Logic
            if (tagFilter.length > 0) {
                if (tagLogic === 'AND') {
                    if (!tagFilter.every(t => entry.tags.includes(t))) return false;
                } else {
                    if (!tagFilter.some(t => entry.tags.includes(t))) return false;
                }
            }

            // Ability Category Logic
            if (abilityCategoryFilter.length > 0) {
                // Get all category names present on this champion
                const championCategories = new Set(entry.abilities.flatMap(a => a.categories));
                
                if (abilityCategoryLogic === 'AND') {
                    // Must have ALL selected categories (across its abilities)
                    if (!abilityCategoryFilter.every(c => championCategories.has(c))) return false;
                } else {
                    // Must have AT LEAST ONE of the selected categories
                    if (!abilityCategoryFilter.some(c => championCategories.has(c))) return false;
                }
            }

            // Ability Logic
            if (abilityFilter.length > 0) {
                const champAbilities = new Set(entry.abilities.filter(a => a.type === 'ABILITY').map(a => a.name));
                if (abilityLogic === 'AND') {
                    if (!abilityFilter.every(req => champAbilities.has(req))) return false;
                } else {
                    if (!abilityFilter.some(req => champAbilities.has(req))) return false;
                }
            }

            // Immunity Logic
            if (immunityFilter.length > 0) {
                const champImmunities = new Set(entry.abilities.filter(a => a.type === 'IMMUNITY').map(a => a.name));
                if (immunityLogic === 'AND') {
                    if (!immunityFilter.every(req => champImmunities.has(req))) return false;
                } else {
                    if (!immunityFilter.some(req => champImmunities.has(req))) return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // Sort by Stars DESC, Rank DESC, Name ASC
            if (a.stars !== b.stars) return b.stars - a.stars;
            if (a.rank !== b.rank) return b.rank - a.rank;
            return a.championName.localeCompare(b.championName);
        });

        if (limitFilter === "ALL") return filtered;
        return filtered.slice(0, parseInt(limitFilter));
    };

    const groupedByBg = useMemo(() => {
        const groups: Record<string, typeof filteredPlayers> = {
            "1": [],
            "2": [],
            "3": [],
            "unassigned": []
        };
        
        filteredPlayers.forEach(p => {
            const key = p.bg?.toString() || "unassigned";
            if (groups[key]) groups[key].push(p);
        });
        
        return groups;
    }, [filteredPlayers]);

    const activeFilters = [
        ...tagFilter.map(t => ({ label: t, type: 'Tag', onRemove: () => setTagFilter(tagFilter.filter(x => x !== t)) })),
        ...abilityCategoryFilter.map(c => ({ label: c, type: 'Category', onRemove: () => setAbilityCategoryFilter(abilityCategoryFilter.filter(x => x !== c)) })),
        ...abilityFilter.map(a => ({ label: a, type: 'Ability', onRemove: () => setAbilityFilter(abilityFilter.filter(x => x !== a)) })),
        ...immunityFilter.map(i => ({ label: i, type: 'Immunity', onRemove: () => setImmunityFilter(immunityFilter.filter(x => x !== i)) })),
    ];

    const renderPlayerRow = (player: typeof players[0]) => {
        const champions = getFilteredChampionsForPlayer(player.id);
        if (champions.length === 0) return null;

        return (
            <div key={player.id} className="flex border-b border-slate-800/50 bg-slate-950/20 hover:bg-slate-900/40 transition-colors">
                {/* Player Sidebar */}
                <div className="w-[140px] p-2 flex items-center gap-2 border-r border-slate-800/50 bg-slate-900/30 shrink-0">
                    <Avatar className="h-7 w-7 border border-slate-700 shrink-0">
                        <AvatarImage src={player.avatar || undefined} />
                        <AvatarFallback className="text-[10px]">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold truncate text-[11px] leading-tight text-slate-200">{player.name}</span>
                        <span className="text-[9px] text-slate-500 font-medium">Matches: {champions.length}</span>
                    </div>
                </div>

                {/* Champions List */}
                <div className="flex-1 p-1.5 flex flex-wrap gap-1 items-start content-start">
                    {champions.map((champ, idx) => {
                        const classColors = getChampionClassColors(champ.championClass);
                        
                        return (
                            <Popover key={`${champ.championId}-${idx}`}>
                                <PopoverTrigger asChild>
                                    <div 
                                        className="flex flex-col items-center gap-0.5 shrink-0 group transition-transform hover:scale-110 hover:z-10 cursor-pointer"
                                    >
                                        <div className={cn(
                                            "relative w-12 h-12 rounded overflow-hidden border bg-slate-900",
                                            classColors.border
                                        )}>
                                            {/* Portrait */}
                                            {champ.championImages && (
                                                <Image 
                                                    src={getChampionImageUrl(champ.championImages as unknown as ChampionImages, '64') || '/icons/unknown.png'} 
                                                    alt={champ.championName}
                                                    fill
                                                    sizes="48px"
                                                    className="object-cover"
                                                />
                                            )}
                                            
                                            {/* Tactic Indicators */}
                                            <div className="absolute top-0 left-0 p-0.5 flex flex-col gap-0.5">
                                                {champ.tactics.attack && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm ring-1 ring-black/50" title="Attack Tactic" />}
                                                {champ.tactics.defense && <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-sm ring-1 ring-black/50" title="Defense Tactic" />}
                                            </div>

                                            {champ.isAscended && (
                                                <div className="absolute bottom-0 right-0 p-0.5">
                                                    <Trophy className="w-2 h-2 text-yellow-400 drop-shadow-md" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-300 leading-none whitespace-nowrap">
                                            <span className="text-yellow-500">{champ.stars}★</span> R{champ.rank}
                                        </span>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800 shadow-xl z-50">
                                    <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
                                        <div className={cn("relative w-10 h-10 rounded border", classColors.border)}>
                                            {champ.championImages && (
                                                <Image 
                                                    src={getChampionImageUrl(champ.championImages as unknown as ChampionImages, '64') || '/icons/unknown.png'} 
                                                    alt={champ.championName}
                                                    fill
                                                    className="object-cover"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-100">{champ.championName}</div>
                                            <div className={cn("text-[10px] font-bold uppercase", classColors.text)}>{champ.championClass}</div>
                                        </div>
                                    </div>
                                    <ScrollArea className="max-h-[300px]">
                                        <div className="p-3 space-y-4">
                                            {(() => {
                                                const isFiltering = abilityFilter.length > 0 || immunityFilter.length > 0 || abilityCategoryFilter.length > 0 || tagFilter.length > 0;
                                                
                                                if (!isFiltering) {
                                                    return <div className="text-xs text-slate-500 text-center italic py-4">Select filters to view specific champion abilities.</div>;
                                                }

                                                const relevantItems = champ.abilities.filter(a => {
                                                    // Strict Type Checking for Filters
                                                    if (abilityFilter.length > 0 && a.type === 'ABILITY' && abilityFilter.includes(a.name)) return true;
                                                    if (immunityFilter.length > 0 && a.type === 'IMMUNITY' && immunityFilter.includes(a.name)) return true;
                                                    
                                                    if (abilityCategoryFilter.length > 0 && a.categories.some(c => abilityCategoryFilter.includes(c))) return true;
                                                    
                                                    return false;
                                                });

                                                // Group by Name + Type to combine source instances
                                                const groupedItems = relevantItems.reduce((acc, curr) => {
                                                    const key = `${curr.type}-${curr.name}`;
                                                    if (!acc[key]) {
                                                        acc[key] = { 
                                                            name: curr.name,
                                                            type: curr.type,
                                                            instances: [] as { source: string | null, synergyChampions: any[] }[] 
                                                        };
                                                    }
                                                    acc[key].instances.push({
                                                        source: curr.source,
                                                        synergyChampions: curr.synergyChampions || []
                                                    });
                                                    return acc;
                                                }, {} as Record<string, { name: string, type: string, instances: { source: string | null, synergyChampions: any[] }[] }>);

                                                const displayAbilities = Object.values(groupedItems).filter(a => a.type === 'ABILITY');
                                                const displayImmunities = Object.values(groupedItems).filter(a => a.type === 'IMMUNITY');

                                                if (displayAbilities.length === 0 && displayImmunities.length === 0) {
                                                    return <div className="text-xs text-slate-500 text-center italic">No matching abilities found.</div>;
                                                }

                                                const renderBadgeContent = (item: typeof displayAbilities[0]) => {
                                                    const validInstances = item.instances.filter(inst => inst.source || inst.synergyChampions.length > 0);
                                                    
                                                    return (
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="font-semibold whitespace-nowrap mt-1">{item.name}</span>
                                                            {validInstances.length > 0 && (
                                                                <div className="flex flex-col pl-1.5 border-l border-white/10">
                                                                    {validInstances.map((instance, vIdx) => (
                                                                        <div key={vIdx} className={cn(
                                                                            "flex items-center gap-1.5 py-1",
                                                                            vIdx > 0 && "border-t border-white/5"
                                                                        )}>
                                                                            {instance.synergyChampions.length > 0 && (
                                                                                <div className="flex -space-x-1.5">
                                                                                    {instance.synergyChampions.map((sc, scIdx) => (
                                                                                         <div key={scIdx} className="relative w-4 h-4 rounded-full border border-slate-900 overflow-hidden ring-1 ring-slate-700 shrink-0" title={sc.name}>
                                                                                             <Image 
                                                                                                 src={getChampionImageUrl(sc.images as unknown as ChampionImages, '64') || '/icons/unknown.png'} 
                                                                                                 alt={sc.name}
                                                                                                 fill
                                                                                                 className="object-cover"
                                                                                             />
                                                                                         </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            {instance.source && (
                                                                                <span className="font-normal opacity-70 text-[9px] leading-tight">
                                                                                    {instance.source}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                };

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
                                                                            className="bg-sky-950/50 border-sky-800 text-sky-300 hover:bg-sky-900 text-[10px] px-2 py-1 h-auto whitespace-normal text-left items-start"
                                                                        >
                                                                            {renderBadgeContent(imm)}
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
                                                                            className="bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/60 text-[10px] px-2 py-1 h-auto whitespace-normal text-left items-start"
                                                                        >
                                                                           {renderBadgeContent(ab)}
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
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto py-6 px-4 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Alliance Roster Overview</h1>
                <p className="text-slate-400 text-sm">Efficiently browse and filter rosters across the entire alliance.</p>
            </div>

            {/* Filter Bar */}
            <Card className="p-4 bg-slate-900/50 border-slate-800 backdrop-blur-md shadow-xl">
                <div className="flex flex-col gap-4">
                    {/* Top Row: Primary Filters */}
                    <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                         <div className="flex flex-col w-full gap-4">
                            <div className="flex items-center justify-between w-full">
                                {/* Battlegroup - Always Visible */}
                                <FilterGroup 
                                    options={[
                                        { value: "ALL", label: "All BGs" },
                                        { value: "1", label: "BG 1" },
                                        { value: "2", label: "BG 2" },
                                        { value: "3", label: "BG 3" },
                                    ]}
                                    value={bgFilter}
                                    onChange={setBgFilter}
                                    className="flex-1 max-w-[300px]"
                                />
                                
                                {/* Mobile Toggle */}
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="xl:hidden ml-2"
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Secondary Filters - Hidden on Mobile unless toggled */}
                            <div className={cn(
                                "flex flex-col gap-4 w-full transition-all duration-300 ease-in-out",
                                !showFilters && "hidden xl:flex",
                                showFilters && "flex"
                            )}>
                                 <div className="flex flex-wrap gap-2 items-center">
                                     {/* Stars */}
                                     <FilterGroup 
                                        options={[
                                            { value: "ALL", label: "All Stars" },
                                            { value: "7", label: "7 ★" },
                                            { value: "6", label: "6 ★" },
                                        ]}
                                        value={starFilter}
                                        onChange={setStarFilter}
                                    />

                                     {/* Min Rank */}
                                     <FilterGroup 
                                        options={[
                                            { value: "0", label: "Any Rank" },
                                            { value: "3", label: "R3+" },
                                            { value: "4", label: "R4+" },
                                            { value: "5", label: "R5+" },
                                        ]}
                                        value={minRankFilter}
                                        onChange={setMinRankFilter}
                                    />

                                     {/* Limit */}
                                     <FilterGroup 
                                        options={[
                                            { value: "5", label: "Top 5" },
                                            { value: "10", label: "Top 10" },
                                            { value: "20", label: "Top 20" },
                                            { value: "ALL", label: "All" },
                                        ]}
                                        value={limitFilter}
                                        onChange={setLimitFilter}
                                    />
                                </div>

                                {/* Bottom Row: Tag, Abilities, Categories */}
                                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between border-t border-slate-800 pt-4">
                                    <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
                                         {/* Tags */}
                                         <MultiSelectFilter 
                                            title="Tags"
                                            icon={TagIcon}
                                            options={initialTags}
                                            selectedValues={tagFilter}
                                            onSelect={setTagFilter}
                                            placeholder="Search tags..."
                                            logic={tagLogic}
                                            onLogicChange={setTagLogic}
                                         />

                                         {/* Ability Categories */}
                                         <MultiSelectFilter 
                                            title="Categories"
                                            icon={BookOpen}
                                            options={initialAbilityCategories}
                                            selectedValues={abilityCategoryFilter}
                                            onSelect={setAbilityCategoryFilter}
                                            placeholder="Search categories..."
                                            logic={abilityCategoryLogic}
                                            onLogicChange={setAbilityCategoryLogic}
                                         />

                                         {/* Abilities */}
                                         <MultiSelectFilter 
                                            title="Abilities"
                                            icon={Zap}
                                            options={initialAbilities}
                                            selectedValues={abilityFilter}
                                            onSelect={setAbilityFilter}
                                            placeholder="Search abilities..."
                                            logic={abilityLogic}
                                            onLogicChange={setAbilityLogic}
                                         />

                                         {/* Immunities */}
                                         <MultiSelectFilter 
                                            title="Immunities"
                                            icon={Shield}
                                            options={initialImmunities}
                                            selectedValues={immunityFilter}
                                            onSelect={setImmunityFilter}
                                            placeholder="Search immunities..."
                                            logic={immunityLogic}
                                            onLogicChange={setImmunityLogic}
                                         />
                                    </div>

                                     {/* Class Filter */}
                                     <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0 w-full sm:w-auto">
                                         <Button
                                            variant="ghost" size="icon"
                                            className={cn(
                                                "h-8 w-8 rounded-full shrink-0", 
                                                classFilter.length === 0 ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
                                            )}
                                            onClick={() => setClassFilter([])}
                                            title="Clear Classes"
                                        >
                                            <CircleOff className="w-4 h-4" />
                                        </Button>
                                        {CLASSES.map(c => {
                                            const colors = getChampionClassColors(c);
                                            const isSelected = classFilter.includes(c);
                                            return (
                                                <Button
                                                    key={c}
                                                    variant="ghost" size="icon"
                                                    className={cn(
                                                        "h-8 w-8 rounded-full shrink-0 border border-transparent",
                                                        isSelected && cn(colors.bg, colors.border)
                                                    )}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setClassFilter(classFilter.filter(item => item !== c));
                                                        } else {
                                                            setClassFilter([...classFilter, c]);
                                                        }
                                                    }}
                                                >
                                                   <div className="relative w-5 h-5">
                                                        <Image src={`/icons/${c.charAt(0) + c.slice(1).toLowerCase()}.png`} alt={c} fill className="object-contain" />
                                                   </div>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Filter Badges */}
                                {activeFilters.length > 0 && (
                                    <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                                        <span className="text-xs text-slate-500 py-0.5">Active Filters:</span>
                                        {activeFilters.map((f, idx) => (
                                            <Badge 
                                                key={`${f.type}-${f.label}-${idx}`}
                                                variant="outline"
                                                className="bg-slate-900 border-slate-700 text-slate-300 gap-1 pl-2 pr-1 h-6"
                                            >
                                                <span className="text-slate-500 font-normal mr-1">{f.type}:</span>
                                                {f.label}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-4 w-4 ml-1 hover:bg-slate-800 hover:text-red-400 rounded-full"
                                                    onClick={f.onRemove}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        ))}
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                            onClick={() => {
                                                setTagFilter([]);
                                                setAbilityCategoryFilter([]);
                                                setAbilityFilter([]);
                                                setImmunityFilter([]);
                                            }}
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Matrix View */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/20">
                {Object.entries(groupedByBg).map(([bg, players]) => {
                    if (players.length === 0) return null;
                    const bgId = bg === "unassigned" ? null : parseInt(bg);
                    const accentColor = bgId ? bgColors[bgId] : null;
                    
                    return (
                        <div key={bg} className="flex flex-col">
                            <div 
                                className="bg-slate-900/80 px-4 py-1.5 border-y border-slate-800 flex items-center justify-between"
                                style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}}
                            >
                                <span 
                                    className="text-[11px] font-black uppercase tracking-widest text-slate-400"
                                    style={accentColor ? { color: accentColor } : {}}
                                >
                                    {bg === "unassigned" ? "Unassigned" : `Battlegroup ${bg}`}
                                </span>
                                <Badge variant="outline" className="h-4 text-[9px] bg-slate-950 border-slate-800 text-slate-400">
                                    {players.length} Players
                                </Badge>
                            </div>
                            <div className="flex flex-col">
                                {players.map(player => renderPlayerRow(player))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
"use client";

import { useMemo } from "react";
import { Search, Eye, PenLine, Plus, CircleOff, BookOpen, Zap, Shield, Tag as TagIcon, Trash2, X, TrendingUp } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter, MultiFilterGroup } from "@/components/ui/filters";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { ChampionClass } from "@prisma/client";
import { CLASSES, CLASS_ICONS } from "../constants";

interface RosterFiltersProps {
    search: string;
    onSearchChange: (val: string) => void;
    viewMode: 'view' | 'edit';
    onViewModeChange: (mode: 'view' | 'edit') => void;
    onAddClick: () => void;
    sortBy: "PRESTIGE" | "NAME";
    onSortByChange: (val: "PRESTIGE" | "NAME") => void;
    filterStars: number[];
    onFilterStarsChange: (val: number[]) => void;
    filterRanks: number[];
    onFilterRanksChange: (val: number[]) => void;
    filterClasses: ChampionClass[];
    onFilterClassesChange: (classes: ChampionClass[]) => void;
    tagFilter: string[];
    onTagFilterChange: (tags: string[]) => void;
    tagLogic: 'AND' | 'OR';
    onTagLogicChange: (logic: 'AND' | 'OR') => void;
    abilityCategoryFilter: string[];
    onAbilityCategoryFilterChange: (cats: string[]) => void;
    abilityCategoryLogic: 'AND' | 'OR';
    onAbilityCategoryLogicChange: (logic: 'AND' | 'OR') => void;
    abilityFilter: string[];
    onAbilityFilterChange: (abs: string[]) => void;
    abilityLogic: 'AND' | 'OR';
    onAbilityLogicChange: (logic: 'AND' | 'OR') => void;
    immunityFilter: string[];
    onImmunityFilterChange: (imms: string[]) => void;
    immunityLogic: 'AND' | 'OR';
    onImmunityLogicChange: (logic: 'AND' | 'OR') => void;
    initialTags: { id: string | number, name: string }[];
    initialAbilityCategories: { id: string | number, name: string }[];
    initialAbilities: { id: string | number, name: string }[];
    initialImmunities: { id: string | number, name: string }[];
}

export function RosterFilters({
    search, onSearchChange, viewMode, onViewModeChange, onAddClick,
    sortBy, onSortByChange, filterStars, onFilterStarsChange, filterRanks, onFilterRanksChange,
    filterClasses, onFilterClassesChange, tagFilter, onTagFilterChange, tagLogic, onTagLogicChange,
    abilityCategoryFilter, onAbilityCategoryFilterChange, abilityCategoryLogic, onAbilityCategoryLogicChange,
    abilityFilter, onAbilityFilterChange, abilityLogic, onAbilityLogicChange,
    immunityFilter, onImmunityFilterChange, immunityLogic, onImmunityLogicChange,
    initialTags, initialAbilityCategories, initialAbilities, initialImmunities
}: RosterFiltersProps) {
    const activeFilters = useMemo(() => {
        const filters: { label: string, type: string, onRemove: () => void }[] = [];

        if (search) {
            filters.push({ label: search, type: 'Search', onRemove: () => onSearchChange("") });
        }

        filterStars.forEach(star => {
            filters.push({ label: `${star} ★`, type: 'Stars', onRemove: () => onFilterStarsChange(filterStars.filter(s => s !== star)) });
        });

        filterRanks.forEach(rank => {
            filters.push({ label: `R${rank}`, type: 'Rank', onRemove: () => onFilterRanksChange(filterRanks.filter(r => r !== rank)) });
        });

        filterClasses.forEach(cls => {
            filters.push({ label: cls.charAt(0) + cls.slice(1).toLowerCase(), type: 'Class', onRemove: () => onFilterClassesChange(filterClasses.filter(c => c !== cls)) });
        });

        tagFilter.forEach(tag => {
            filters.push({ label: tag, type: 'Tag', onRemove: () => onTagFilterChange(tagFilter.filter(t => t !== tag)) });
        });

        abilityCategoryFilter.forEach(cat => {
            filters.push({ label: cat, type: 'Category', onRemove: () => onAbilityCategoryFilterChange(abilityCategoryFilter.filter(c => c !== cat)) });
        });

        abilityFilter.forEach(ab => {
            filters.push({ label: ab, type: 'Ability', onRemove: () => onAbilityFilterChange(abilityFilter.filter(a => a !== ab)) });
        });

        immunityFilter.forEach(imm => {
            filters.push({ label: imm, type: 'Immunity', onRemove: () => onImmunityFilterChange(immunityFilter.filter(i => i !== imm)) });
        });

        return filters;
    }, [search, filterStars, filterRanks, filterClasses, tagFilter, abilityCategoryFilter, abilityFilter, immunityFilter, onSearchChange, onFilterStarsChange, onFilterRanksChange, onFilterClassesChange, onTagFilterChange, onAbilityCategoryFilterChange, onAbilityFilterChange, onImmunityFilterChange]);

    return (
        <Card className="bg-slate-900/50 border-slate-800 p-2.5 z-40 backdrop-blur-md shadow-lg">
            <div className="flex flex-col gap-2.5">
                {/* Row 1: Search + View Toggle + Sort + Add */}
                <div className="flex flex-wrap gap-2.5 items-center justify-between">
                    <div className="flex gap-2 flex-1 min-w-[200px] max-w-md">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input 
                                placeholder="Search..." 
                                value={search} 
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full pl-8 h-8 bg-slate-950/50 border border-slate-700 rounded-md text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-slate-950/50 border border-slate-700 rounded-lg p-0.5 shrink-0">
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => onViewModeChange('view')}
                                className={cn("h-7 px-2 rounded-md transition-all text-[11px] font-medium", viewMode === 'view' ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
                            >
                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => onViewModeChange('edit')}
                                className={cn("h-7 px-2 rounded-md transition-all text-[11px] font-medium", viewMode === 'edit' ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
                            >
                                <PenLine className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                        </div>

                        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as "PRESTIGE" | "NAME")}>
                            <SelectTrigger className="h-8 w-[140px] bg-slate-950/50 border-slate-700 text-[11px] px-2.5">
                                <span className="text-slate-500 mr-1">Sort:</span>
                                <SelectValue placeholder="Sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PRESTIGE" className="text-xs">Prestige</SelectItem>
                                <SelectItem value="NAME" className="text-xs">Name</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button size="sm" className="h-8 bg-sky-600 hover:bg-sky-700 text-white px-3" onClick={onAddClick}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Add</span>
                        </Button>
                    </div>
                </div>

                {/* Row 2: Standard Selection Filters + Advanced Filters */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800/50 pt-2.5">
                    <div className="flex items-center gap-2">
                        <MultiFilterGroup 
                            options={[
                                { value: "7", label: "7★" },
                                { value: "6", label: "6★" },
                                { value: "5", label: "5★" },
                            ]}
                            values={filterStars.map(String)}
                            onChange={(vals) => onFilterStarsChange(vals.map(Number))}
                        />
                        <MultiFilterGroup 
                            options={[1,2,3,4,5,6].map(r => ({ value: String(r), label: `R${r}` }))}
                            values={filterRanks.map(String)}
                            onChange={(vals) => onFilterRanksChange(vals.map(Number))}
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-lg border border-slate-800/50">
                        {CLASSES.map(c => {
                            const colors = getChampionClassColors(c);
                            const isSelected = filterClasses.includes(c);
                            return (
                                <Button
                                    key={c} variant="ghost" size="icon"
                                    className={cn("h-7 w-7 p-1 rounded-md transition-all border shrink-0", isSelected ? cn(colors.bg, colors.border, "shadow-sm") : "bg-transparent border-transparent hover:bg-slate-800")}
                                    onClick={() => {
                                        if (isSelected) onFilterClassesChange(filterClasses.filter(x => x !== c));
                                        else onFilterClassesChange([...filterClasses, c]);
                                    }}
                                    title={c}
                                >
                                    <div className="relative w-3.5 h-3.5">
                                        <Image src={CLASS_ICONS[c as Exclude<ChampionClass, 'SUPERIOR'>]} alt={c} fill sizes="14px" className="object-contain" />
                                    </div>
                                </Button>
                            );
                        })}
                    </div>

                    <div className="h-6 w-px bg-slate-800 hidden sm:block mx-1" />

                    <div className="flex flex-wrap gap-2 items-center">
                        <MultiSelectFilter title="Tags" icon={TagIcon} options={initialTags} selectedValues={tagFilter} onSelect={onTagFilterChange} logic={tagLogic} onLogicChange={onTagLogicChange} />
                        <MultiSelectFilter title="Categories" icon={BookOpen} options={initialAbilityCategories} selectedValues={abilityCategoryFilter} onSelect={onAbilityCategoryFilterChange} logic={abilityCategoryLogic} onLogicChange={onAbilityCategoryLogicChange} />
                        <MultiSelectFilter title="Abilities" icon={Zap} options={initialAbilities} selectedValues={abilityFilter} onSelect={onAbilityFilterChange} logic={abilityLogic} onLogicChange={onAbilityLogicChange} />
                        <MultiSelectFilter title="Immunities" icon={Shield} options={initialImmunities} selectedValues={immunityFilter} onSelect={onImmunityFilterChange} logic={immunityLogic} onLogicChange={onImmunityLogicChange} />
                    </div>
                </div>

                {/* Row 3: Active Filters Badges */}
                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t border-slate-800/50 pt-3 items-center">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mr-2">Active:</span>
                        {activeFilters.map((filter, index) => (
                            <Badge 
                                key={`${filter.type}-${filter.label}-${index}`}
                                variant="outline"
                                className="bg-slate-950/50 border-slate-700 text-slate-300 gap-1 pl-2 pr-1 h-7 text-[11px]"
                            >
                                <span className="text-slate-500 font-normal mr-0.5">{filter.type}:</span>
                                {filter.label}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 ml-1 hover:bg-slate-800 hover:text-red-400 rounded-full shrink-0"
                                    onClick={filter.onRemove}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 ml-auto"
                            onClick={() => {
                                onSearchChange("");
                                onFilterStarsChange([]);
                                onFilterRanksChange([]);
                                onFilterClassesChange([]);
                                onTagFilterChange([]);
                                onAbilityCategoryFilterChange([]);
                                onAbilityFilterChange([]);
                                onImmunityFilterChange([]);
                            }}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}

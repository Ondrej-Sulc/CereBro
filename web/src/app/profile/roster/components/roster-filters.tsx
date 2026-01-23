"use client";

import { useMemo } from "react";
import { Search, Eye, PenLine, Plus, CircleOff, BookOpen, Zap, Shield, Tag as TagIcon, Trash2, X } from "lucide-react";
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
    top30Average: number;
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
    search, onSearchChange, viewMode, onViewModeChange, onAddClick, top30Average,
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
        <Card className="bg-slate-900/50 border-slate-800 p-4 z-40 backdrop-blur-md shadow-lg">
            <div className="flex flex-col gap-4">
                {/* Row 1: Search + View Toggle + Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-2 flex-1 w-full max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input 
                                placeholder="Search champions..." 
                                value={search} 
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-9 bg-slate-950/50 border-slate-700"
                            />
                        </div>
                        <div className="flex items-center bg-slate-950/50 border border-slate-700 rounded-lg p-1 shrink-0">
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => onViewModeChange('view')}
                                className={cn("h-8 px-3 rounded-md transition-all text-xs font-medium", viewMode === 'view' ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
                            >
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                            </Button>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => onViewModeChange('edit')}
                                className={cn("h-8 px-3 rounded-md transition-all text-xs font-medium", viewMode === 'edit' ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200")}
                            >
                                <PenLine className="w-3.5 h-3.5 mr-1.5" /> Edit
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end">
                        {top30Average > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/20 border border-amber-900/40 rounded-lg shadow-inner">
                                <span className="text-amber-500/80 text-[10px] font-bold uppercase tracking-wider">Top 30 Prestige</span>
                                <span className="text-amber-100 font-mono font-bold text-sm">{top30Average.toLocaleString('en-US')}</span>
                            </div>
                        )}
                        <Button className="bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-900/20" onClick={onAddClick}>
                            <Plus className="w-4 h-4 mr-2" /> Add Champion
                        </Button>
                    </div>
                </div>

                {/* Row 2: Standard Selection Filters */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-800 pt-4">
                    <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Sort By</Label>
                        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as "PRESTIGE" | "NAME")}>
                            <SelectTrigger className="h-8 w-[110px] bg-slate-950/50 border-slate-700 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PRESTIGE">Prestige</SelectItem>
                                <SelectItem value="NAME">Name</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Stars</Label>
                        <MultiFilterGroup 
                            options={[
                                { value: "7", label: "7 ★" },
                                { value: "6", label: "6 ★" },
                                { value: "5", label: "5 ★" },
                            ]}
                            values={filterStars.map(String)}
                            onChange={(vals) => onFilterStarsChange(vals.map(Number))}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Rank</Label>
                        <MultiFilterGroup 
                            options={[1,2,3,4,5,6].map(r => ({ value: String(r), label: `R${r}` }))}
                            values={filterRanks.map(String)}
                            onChange={(vals) => onFilterRanksChange(vals.map(Number))}
                        />
                    </div>

                    <div className="h-6 w-px bg-slate-800 hidden sm:block mx-2" />

                    <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mr-1">Class</Label>
                        <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-full border border-slate-800/50">
                            <Button
                                variant="ghost" size="icon"
                                className={cn("h-7 w-7 rounded-full transition-all shrink-0", filterClasses.length === 0 ? "bg-slate-700 text-white shadow-inner" : "text-slate-500 hover:text-slate-300")}
                                onClick={() => onFilterClassesChange([])}
                                title="All Classes"
                            >
                                <CircleOff className="h-3.5 w-3.5" />
                            </Button>
                            <div className="h-3 w-px bg-slate-800 mx-0.5" />
                            {CLASSES.map(c => {
                                const colors = getChampionClassColors(c);
                                const isSelected = filterClasses.includes(c);
                                return (
                                    <Button
                                        key={c} variant="ghost" size="sm"
                                        className={cn("h-7 w-7 p-1 rounded-full transition-all border shrink-0", isSelected ? cn(colors.bg, colors.border, "shadow-sm") : "bg-transparent border-transparent hover:bg-slate-800")}
                                        onClick={() => {
                                            if (isSelected) onFilterClassesChange(filterClasses.filter(x => x !== c));
                                            else onFilterClassesChange([...filterClasses, c]);
                                        }}
                                        title={c}
                                    >
                                        <div className="relative w-4 h-4">
                                            <Image src={CLASS_ICONS[c as Exclude<ChampionClass, 'SUPERIOR'>]} alt={c} fill sizes="16px" className="object-contain" />
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Row 3: Advanced Filters */}
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between border-t border-slate-800 pt-4">
                    <div className="flex flex-wrap gap-2 items-center w-full">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mr-2">Advanced:</span>
                        <MultiSelectFilter title="Tags" icon={TagIcon} options={initialTags} selectedValues={tagFilter} onSelect={onTagFilterChange} logic={tagLogic} onLogicChange={onTagLogicChange} />
                        <MultiSelectFilter title="Categories" icon={BookOpen} options={initialAbilityCategories} selectedValues={abilityCategoryFilter} onSelect={onAbilityCategoryFilterChange} logic={abilityCategoryLogic} onLogicChange={onAbilityCategoryLogicChange} />
                        <MultiSelectFilter title="Abilities" icon={Zap} options={initialAbilities} selectedValues={abilityFilter} onSelect={onAbilityFilterChange} logic={abilityLogic} onLogicChange={onAbilityLogicChange} />
                        <MultiSelectFilter title="Immunities" icon={Shield} options={initialImmunities} selectedValues={immunityFilter} onSelect={onImmunityFilterChange} logic={immunityLogic} onLogicChange={onImmunityLogicChange} />
                    </div>
                </div>

                {/* Row 4: Active Filters Badges */}
                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4 items-center">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mr-2">Active Filters:</span>
                        {activeFilters.map((filter, index) => (
                            <Badge 
                                key={`${filter.type}-${filter.label}-${index}`}
                                variant="outline"
                                className="bg-slate-950/50 border-slate-700 text-slate-300 gap-1 pl-2 pr-1 h-7"
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

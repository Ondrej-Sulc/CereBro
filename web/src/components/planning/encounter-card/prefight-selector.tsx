"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronsUpDown, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { cn } from "@/lib/utils";
import type { ChampionClass } from "@prisma/client";
import type { EncounterWithRelations, QuestWithRelations, RosterWithChampion } from "../types";
import { isChampionValidForEncounterOrQuest } from "../utils";

type PrefightRosterState = {
    roster: RosterWithChampion[];
    filteredGlobalRoster: RosterWithChampion[];
    handleSelectPrefight: (encounterId: string, rosterId: string) => void;
};

export function PrefightSelector({
    encounter,
    quest,
    selections,
    prefightSelections,
    rosterState
}: {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    selections: Record<string, string | null>;
    prefightSelections: Record<string, string | null>;
    rosterState: PrefightRosterState;
}) {
    const { roster, filteredGlobalRoster, handleSelectPrefight } = rosterState;
    const counterRosterId = selections[encounter.id];
    const counterChampionId = counterRosterId ? roster.find(r => r.id === counterRosterId)?.championId : null;
    const selectedPrefightRosterId = prefightSelections[encounter.id] || null;
    const selectedPrefightRosterItem = selectedPrefightRosterId ? roster.find(r => r.id === selectedPrefightRosterId) : null;
    const [open, setOpen] = useState(false);

    let encounterRoster = filteredGlobalRoster
        .filter(r => !r.isUnowned && isChampionValidForEncounterOrQuest(r, quest, encounter))
        .filter((r, index, self) => self.findIndex(item => item.id === r.id) === index)
        .sort((a, b) => {
            if (prefightSelections[encounter.id] === a.id && prefightSelections[encounter.id] !== b.id) return -1;
            if (prefightSelections[encounter.id] !== a.id && prefightSelections[encounter.id] === b.id) return 1;
            if (b.stars !== a.stars) return b.stars - a.stars;
            if (b.rank !== a.rank) return b.rank - a.rank;
            return a.champion.name.localeCompare(b.champion.name);
        });

    if (encounterRoster.length > 30) {
        encounterRoster = encounterRoster.slice(0, 30);
    }

    return (
        <div className="mt-4 border-t border-slate-800/50 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-800 bg-slate-950/70 text-slate-500">
                        <Zap className="h-3 w-3" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Prefight</h4>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="min-h-11 w-full justify-between rounded-lg border-slate-800/70 bg-slate-950/35 px-2 py-1.5 text-left hover:bg-slate-900/50 hover:text-slate-100"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <div className={cn(
                                    "relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 bg-slate-900",
                                    selectedPrefightRosterItem ? getChampionClassColors(selectedPrefightRosterItem.champion.class as ChampionClass).border : "border-slate-800"
                                )}>
                                    {selectedPrefightRosterItem ? (
                                        <Image
                                            src={getChampionImageUrlOrPlaceholder(selectedPrefightRosterItem.champion.images, "64")}
                                            alt={selectedPrefightRosterItem.champion.name}
                                            fill
                                            sizes="32px"
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-slate-600">
                                            <Zap className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    {selectedPrefightRosterItem ? (
                                        <>
                                            <div className={cn("truncate text-xs font-black uppercase tracking-[0.08em]", getChampionClassColors(selectedPrefightRosterItem.champion.class as ChampionClass).text)}>
                                                {selectedPrefightRosterItem.champion.name}
                                            </div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                {selectedPrefightRosterItem.stars}★ R{selectedPrefightRosterItem.rank}{selectedPrefightRosterItem.isAwakened ? ` · S${selectedPrefightRosterItem.sigLevel}` : ""}
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-500">No prefight selected</span>
                                    )}
                                </div>
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                                {selectedPrefightRosterId && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className="rounded-full p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleSelectPrefight(encounter.id, selectedPrefightRosterId);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                handleSelectPrefight(encounter.id, selectedPrefightRosterId);
                                            }
                                        }}
                                        aria-label="Clear prefight champion"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </span>
                                )}
                                <ChevronsUpDown className="h-4 w-4 text-slate-500" />
                            </div>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        sideOffset={4}
                        className="w-[--radix-popover-trigger-width] border-slate-800 bg-slate-950 p-0"
                        onWheel={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        onTouchMove={(event) => event.stopPropagation()}
                    >
                        <Command>
                            <CommandInput placeholder="Search prefight champion..." />
                            <CommandList className="max-h-80">
                                <CommandEmpty>No champion found.</CommandEmpty>
                                <CommandGroup>
                                    {selectedPrefightRosterId && (
                                        <CommandItem
                                            value="No prefight"
                                            onSelect={() => {
                                                handleSelectPrefight(encounter.id, selectedPrefightRosterId);
                                                setOpen(false);
                                            }}
                                            className="cursor-pointer text-xs text-slate-500 aria-selected:bg-slate-900 aria-selected:text-slate-300"
                                        >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-600">
                                                <X className="h-3.5 w-3.5" />
                                            </div>
                                            <span>Clear prefight</span>
                                        </CommandItem>
                                    )}
                                    {encounterRoster.map((rosterEntry) => {
                                        const isSelected = selectedPrefightRosterId === rosterEntry.id;
                                        const isCounter = counterChampionId === rosterEntry.championId;
                                        const colors = getChampionClassColors(rosterEntry.champion.class as ChampionClass);
                                        return (
                                            <CommandItem
                                                key={`prefight-option-${rosterEntry.id}`}
                                                value={`${rosterEntry.champion.name} ${rosterEntry.champion.shortName || ""} ${rosterEntry.stars} star rank ${rosterEntry.rank}`}
                                                disabled={isCounter}
                                                onSelect={() => {
                                                    handleSelectPrefight(encounter.id, rosterEntry.id);
                                                    setOpen(false);
                                                }}
                                                className={cn(
                                                    "flex cursor-pointer items-center gap-2 py-2 aria-selected:bg-slate-900",
                                                    isSelected && "bg-slate-900/80",
                                                    isCounter && "cursor-not-allowed opacity-45"
                                                )}
                                            >
                                                <div className={cn("relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 bg-slate-800", colors.border)}>
                                                    <Image
                                                        src={getChampionImageUrlOrPlaceholder(rosterEntry.champion.images, "64")}
                                                        alt={rosterEntry.champion.name}
                                                        fill
                                                        sizes="32px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className={cn("truncate text-sm font-bold", colors.text)}>
                                                        {rosterEntry.champion.name}
                                                    </div>
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        {rosterEntry.stars}★ R{rosterEntry.rank}{rosterEntry.isAwakened ? ` · S${rosterEntry.sigLevel}` : ""}{isCounter ? " · Counter" : ""}
                                                    </div>
                                                </div>
                                                {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-400" />}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}

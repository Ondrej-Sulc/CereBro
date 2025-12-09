"use client"

import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"
import Image from "next/image";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Champion } from "@/types/champion"
import { getChampionImageUrl } from "@/lib/championHelper";
import { GroupedVirtuoso } from "react-virtuoso";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionClass } from "@prisma/client";

interface ChampionComboboxProps {
  champions: (Champion & { group?: string })[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeChampionIds?: Set<string>;
}

export const ChampionCombobox = React.memo(function ChampionCombobox({
  champions,
  value,
  onSelect,
  placeholder = "Select a champion...",
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  activeChampionIds,
}: ChampionComboboxProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const [search, setSearch] = React.useState("");
  const [showOnlyActive, setShowOnlyActive] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = React.useCallback((championId: string) => {
    onSelect(championId);
    setOpen(false);
  }, [onSelect, setOpen]);

  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect("");
  }, [onSelect]);

  const { flatItems, groupCounts, groupNames } = React.useMemo(() => {
    const searchLower = search.toLowerCase();
    let filtered = champions;

    if (showOnlyActive && activeChampionIds) {
        filtered = filtered.filter(c => activeChampionIds.has(String(c.id)));
    }

    filtered = filtered.filter(champion =>
      champion.name.toLowerCase().includes(searchLower)
    );

    const groups: Record<string, typeof champions> = {};
    const groupOrder: string[] = [];

    filtered.forEach(c => {
        const g = c.group || "Champions";
        if (!groups[g]) {
            groups[g] = [];
            groupOrder.push(g);
        }
        groups[g].push(c);
    });

    const flat: typeof champions = [];
    const counts: number[] = [];

    groupOrder.forEach(g => {
        flat.push(...groups[g]);
        counts.push(groups[g].length);
    });

    return { flatItems: flat, groupCounts: counts, groupNames: groupOrder };
  }, [champions, search, showOnlyActive, activeChampionIds]);

  const selectedChampion = React.useMemo(() => 
    value ? champions.find((c) => String(c.id) === value) : null,
  [value, champions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between pr-2 pl-0 rounded-full", className)}
                  >
                    <div className="flex items-center gap-2 truncate ">
                       {selectedChampion ? (
                          <>
                              <div 
                                  className={cn("relative h-11 w-11 rounded-full overflow-hidden flex-shrink-0 bg-slate-800", getChampionClassColors(selectedChampion.class).border)}
                              >
                                  <Image 
                                  src={getChampionImageUrl(selectedChampion.images as any, '128')}
                                  alt={selectedChampion.name}
                                  fill
                                  className="object-cover"
                                  />
                              </div>
                              <span 
                                  className={cn("truncate font-bold", getChampionClassColors(selectedChampion.class).text)}
                              >
                                  {selectedChampion.name}
                              </span>
                          </>
                       ) : (
                          <span className="text-slate-500 text-sm pl-3">{placeholder}</span>
                       )}
                    </div>
          <div className="flex items-center ml-2">
            {value ? (
              <div 
                role="button"
                onClick={handleClear}
                className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </div>
            ) : (
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        sideOffset={4} 
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search champion..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="overflow-hidden">
             {activeChampionIds && activeChampionIds.size > 0 && (
                <div className="px-2 py-2 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Filter</span>
                    <Button
                        variant={showOnlyActive ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowOnlyActive(!showOnlyActive)}
                        className="h-6 text-[10px] px-2"
                    >
                        {showOnlyActive ? "Showing Active" : "Show All"}
                    </Button>
                </div>
            )}
            
            {flatItems.length === 0 && <CommandEmpty>No champion found.</CommandEmpty>}
            <CommandGroup>
                <div style={{ height: Math.min(flatItems.length * 46 + groupNames.length * 28, 300) }}>
                  <GroupedVirtuoso
                    style={{ height: Math.min(flatItems.length * 46 + groupNames.length * 28, 300) }}
                    groupCounts={groupCounts}
                    groupContent={(index) => (
                        <div className="bg-slate-950/95 backdrop-blur text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1.5 border-b border-slate-800 sticky top-0 z-10">
                            {groupNames[index]}
                        </div>
                    )}
                    itemContent={(index) => {
                      const item = flatItems[index];
                      const colors = getChampionClassColors(item.class as ChampionClass);
                      return (
                        <CommandItem
                            key={item.id}
                            value={item.name}
                            onSelect={() => handleSelect(String(item.id))}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <div 
                                className={cn("relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border-2", colors.border)}
                            >
                                <Image 
                                    src={getChampionImageUrl(item.images as any, '64')}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <span className={cn("font-medium", colors.text)}>
                                {item.name}
                            </span>
                        </CommandItem>
                      );
                    }}
                  />
                </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
});
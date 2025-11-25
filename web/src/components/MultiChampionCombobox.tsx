"use client"

import * as React from "react"
import Image from "next/image"
import { Check, Plus, X } from "lucide-react"
import { Virtuoso } from "react-virtuoso";

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
import { Badge } from "@/components/ui/badge"
import { ChampionImages } from "@/types/champion"
import { getChampionImageUrl } from "@/lib/championHelper"

interface Champion {
  id: number;
  name: string;
  images: ChampionImages;
}

interface MultiChampionComboboxProps {
  champions: Champion[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  className?: string;
}

export const MultiChampionCombobox = React.memo(function MultiChampionCombobox({
  champions,
  selectedIds,
  onSelectionChange,
  className,
}: MultiChampionComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("");

  const handleSelect = (championId: string) => {
    const newSelectedIds = selectedIds.includes(championId)
      ? selectedIds.filter(id => id !== championId)
      : [...selectedIds, championId];
    onSelectionChange(newSelectedIds);
  };

  const selectedChampions = selectedIds.map(id => champions.find(c => String(c.id) === id)).filter(Boolean) as Champion[];

  const filteredChampions = React.useMemo(() =>
    champions.filter(champion =>
      champion.name.toLowerCase().includes(search.toLowerCase())
    ), [champions, search]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {selectedChampions.map(champion => (
        <Badge key={champion.id} variant="secondary" className="flex items-center gap-1.5 py-1 pl-1 pr-2 bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300">
          <Image
            src={getChampionImageUrl(champion.images, '32', 'primary')}
            alt={champion.name}
            width={18}
            height={18}
            className="rounded-full"
          />
          <span className="text-xs">{champion.name}</span>
          <button
            type="button"
            onClick={() => handleSelect(String(champion.id))}
            className="ml-1 rounded-full hover:bg-slate-600 p-0.5 transition-colors"
            aria-label={`Remove ${champion.name}`}
          >
            <X className="h-3 w-3 text-slate-400" />
          </button>
        </Badge>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-full border-dashed border-slate-600 bg-transparent hover:bg-slate-800 hover:text-sky-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add prefight champion</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-[250px] p-0 bg-slate-950 border-slate-800">
          <Command className="bg-transparent">
            <CommandInput
                placeholder="Search champion..."
                value={search}
                onValueChange={setSearch}
                className="h-9"
            />
            <CommandList>
              <CommandEmpty className="py-2 text-center text-xs text-slate-500">No champion found.</CommandEmpty>
              <CommandGroup>
                {open && (
                    <Virtuoso
                        style={{ height: "200px" }}
                        data={filteredChampions}
                        itemContent={(index, champion) => (
                            <CommandItem
                                key={champion.id}
                                value={champion.name}
                                onSelect={() => {
                                    handleSelect(String(champion.id));
                                }}
                                className="aria-selected:bg-slate-900 aria-selected:text-sky-400"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-3 w-3",
                                        selectedIds.includes(String(champion.id)) ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex items-center gap-2">
                                    <Image 
                                        src={getChampionImageUrl(champion.images, '32', 'primary')} 
                                        alt="" 
                                        width={20} 
                                        height={20} 
                                        className="rounded-full"
                                    />
                                    <span className="text-sm">{champion.name}</span>
                                </div>
                            </CommandItem>
                        )}
                    />
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
});
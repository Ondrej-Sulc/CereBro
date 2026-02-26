"use client"

import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"
import { Virtuoso } from "react-virtuoso";
import Image from "next/image";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Champion } from "@/types/champion"
import { getChampionImageUrl } from "@/lib/championHelper";

interface MultiChampionComboboxProps {
  champions: Champion[];
  values: number[]; // Array of Champion IDs
  onSelect: (values: number[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiChampionCombobox = React.memo(function MultiChampionCombobox({
  champions,
  values,
  onSelect,
  placeholder = "Select champions...",
  className,
}: MultiChampionComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const handleSelect = React.useCallback((championId: number) => {
    if (values.includes(championId)) {
      onSelect(values.filter((v) => v !== championId));
    } else {
      onSelect([...values, championId]);
    }
  }, [values, onSelect]);

  const handleRemove = React.useCallback((e: React.MouseEvent, championId: number) => {
    e.stopPropagation();
    onSelect(values.filter((v) => v !== championId));
  }, [values, onSelect]);

  const filteredChampions = React.useMemo(() =>
    champions.filter(champion =>
      champion.name.toLowerCase().includes(search.toLowerCase())
    ), [champions, search]
  );

  const selectedChampions = React.useMemo(() => 
    values.map(id => champions.find(c => c.id === id)).filter(Boolean) as Champion[],
  [values, champions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full h-auto min-h-[40px] justify-between pr-2 pl-2 rounded-md", className)}
        >
          <div className="flex flex-wrap items-center gap-1.5 py-1">
             {selectedChampions.length > 0 ? (
                selectedChampions.map(champion => (
                    <Badge key={champion.id} variant="secondary" className="pl-1 pr-1 py-0.5 h-7 flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
                         <div className="relative h-5 w-5 rounded-full overflow-hidden bg-slate-900 flex-shrink-0">
                            <Image 
                            src={getChampionImageUrl(champion.images, '64')}
                            alt={champion.name}
                            fill
                            className="object-cover"
                            />
                        </div>
                        <span className="text-xs font-bold max-w-[80px] truncate">{champion.name}</span>
                        <div 
                            role="button"
                            onClick={(e) => handleRemove(e, champion.id)}
                            className="ml-0.5 rounded-full hover:bg-slate-600 p-0.5 cursor-pointer"
                        >
                            <X className="h-3 w-3" />
                        </div>
                    </Badge>
                ))
             ) : (
                <span className="text-slate-500 pl-1">{placeholder}</span>
             )}
          </div>

          <div className="flex items-center ml-2 shrink-0">
             <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        sideOffset={4} 
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command className="h-auto">
          <CommandInput
            placeholder="Search champion..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No champion found.</CommandEmpty>
          <CommandGroup>
            {open && (
                <Virtuoso
                    style={{ height: "288px" }}
                    data={filteredChampions}
                    itemContent={(index, champion) => {
                        const isSelected = values.includes(champion.id);
                        return (
                        <CommandItem
                            key={champion.id}
                            value={champion.name}
                            onSelect={() => handleSelect(champion.id)}
                            className={cn("flex items-center gap-2 cursor-pointer", isSelected && "bg-slate-800 text-slate-100")}
                        >
                            <div className="relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                              <Image 
                                src={getChampionImageUrl(champion.images, '64')}
                                alt={champion.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <span className={cn(isSelected && "font-bold")}>{champion.name}</span>
                            {isSelected && <span className="ml-auto text-xs text-blue-400 font-bold">✓</span>}
                        </CommandItem>
                    )}}
                />
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
});

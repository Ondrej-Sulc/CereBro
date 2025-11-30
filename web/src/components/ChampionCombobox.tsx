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

interface ChampionComboboxProps {
  champions: Champion[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ChampionCombobox = React.memo(function ChampionCombobox({
  champions,
  value,
  onSelect,
  placeholder = "Select a champion...",
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ChampionComboboxProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const [search, setSearch] = React.useState("");

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

  const filteredChampions = React.useMemo(() =>
    champions.filter(champion =>
      champion.name.toLowerCase().includes(search.toLowerCase())
    ), [champions, search]
  );

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
                    <div className="relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                        <Image 
                        src={getChampionImageUrl(selectedChampion.images as any, '64')}
                        alt={selectedChampion.name}
                        fill
                        className="object-cover"
                        />
                    </div>
                    <span className="truncate">{selectedChampion.name}</span>
                </>
             ) : (
                <span className="pl-2 text-slate-500">{placeholder}</span>
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
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search champion..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No champion found.</CommandEmpty>
            <CommandGroup>
                {filteredChampions.map((champion) => (
                    <CommandItem
                        key={champion.id}
                        value={champion.name}
                        onSelect={() => handleSelect(String(champion.id))}
                        className="flex items-center gap-2 cursor-pointer"
                    >
                        <div className="relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                            <Image 
                            src={getChampionImageUrl(champion.images as any, '64')}
                            alt={champion.name}
                            fill
                            className="object-cover"
                            />
                        </div>
                        <span>{champion.name}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
});
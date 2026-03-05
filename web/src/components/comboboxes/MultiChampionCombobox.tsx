import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"
import Image from "next/image";
import Fuse from "fuse.js"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Champion, ChampionImages } from "@/types/champion"
import { getChampionImageUrl } from "@/lib/championHelper";

interface MultiChampionComboboxProps {
  champions: Champion[];
  values: number[]; // Array of Champion IDs
  onSelect: (values: number[]) => void;
  placeholder?: string;
  className?: string;
}

const ComboboxTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { open: boolean; selectedChampions: Champion[]; placeholder: string }
>(({ open, selectedChampions, placeholder, className, ...props }, ref) => {
  return (
    <button
      type="button"
      ref={ref}
      aria-expanded={open}
      className={cn(
        "flex h-auto min-h-[40px] w-full items-center justify-between rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-left ring-offset-slate-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        className
      )}
      {...props}
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
            </Badge>
          ))
        ) : (
          <span className="text-slate-500 pl-1">{placeholder}</span>
        )}
      </div>

      <div className="flex items-center ml-2 shrink-0">
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>
    </button>
  );
});
ComboboxTrigger.displayName = "ComboboxTrigger";

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
    setSearch(""); // Clear search on select
  }, [values, onSelect]);

  const fuse = React.useMemo(() => {
    return new Fuse(champions, {
      keys: ["name"],
      threshold: 0.3,
      distance: 100,
      ignoreLocation: true,
    });
  }, [champions]);

  const filteredChampions = React.useMemo(() => {
    if (!search) return champions;
    return fuse.search(search).map(result => result.item);
  }, [fuse, search, champions]);

  const championMap = React.useMemo(() => {
    const map = new Map<number, Champion>();
    champions.forEach(c => map.set(c.id, c));
    return map;
  }, [champions]);

  const selectedChampions = React.useMemo(() => {
    const isChampion = (v: unknown): v is Champion => v !== undefined && v !== null;
    return values.map(id => championMap.get(id)).filter(isChampion);
  }, [values, championMap]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComboboxTrigger
          open={open}
          selectedChampions={selectedChampions}
          placeholder={placeholder}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] p-0"
        onWheel={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="h-auto">
          <CommandInput
            placeholder="Search champion..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No champion found.</CommandEmpty>
            <CommandGroup>
              {(search ? filteredChampions.slice(0, 100) : filteredChampions).map((champion) => {
                const isSelected = values.includes(champion.id);
                return (
                  <CommandItem
                    key={champion.id}
                    value={champion.name}
                    onSelect={() => handleSelect(champion.id)}
                    className={cn("flex items-center gap-2 cursor-pointer py-2", isSelected && "bg-slate-800 text-slate-100")}
                  >
                    <div className="relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                      <Image src={getChampionImageUrl(champion.images, '64')}
                        alt={champion.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <span className={cn(isSelected && "font-bold")}>{champion.name}</span>
                    {isSelected && <span className="ml-auto text-xs text-sky-400 font-bold">✓</span>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
});

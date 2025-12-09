"use client"

import * as React from "react"
import { ChevronsUpDown, X, Users } from "lucide-react"
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
import { PlayerWithRoster } from "@cerebro/core/data/war-planning/types"; // Or import from @prisma/client if simpler, but we need the type with roster
import { Virtuoso } from "react-virtuoso";

interface PlayerComboboxProps {
  players: PlayerWithRoster[];
  value: PlayerWithRoster["id"] | undefined;
  onSelect: (value: PlayerWithRoster["id"] | undefined) => void;
  placeholder?: string;
  className?: string;
  attackerId?: number; // To show rank info
  compact?: boolean;
}

export const PlayerCombobox = React.memo(function PlayerCombobox({
  players,
  value,
  onSelect,
  placeholder = "Select player...",
  className,
  attackerId,
  compact
}: PlayerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = React.useCallback((playerId: PlayerWithRoster["id"]) => {
    onSelect(playerId);
    setOpen(false);
  }, [onSelect]);

  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(undefined);
  }, [onSelect]);

    const filteredPlayers = React.useMemo(() => {

      const searchLower = search.toLowerCase();

      return players.filter((player) =>

        player.ingameName.toLowerCase().includes(searchLower),

      );

    }, [players, search]);

  

      const selectedPlayer = React.useMemo(

  

        () => (value != null ? players.find((p) => p.id === value) : null),

  

        [value, players],

  

      );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
              "w-full justify-between pr-2 pl-0 rounded-full", 
              compact ? "h-8 text-xs" : "",
              className
          )}
        >
          <div className="flex items-center gap-2 truncate ">
             {selectedPlayer ? (
                <>
                    {selectedPlayer.avatar ? (
                        <div className={cn("relative rounded-full overflow-hidden flex-shrink-0 bg-slate-800 ml-1", compact ? "h-5 w-5" : "h-6 w-6")}>
                            <Image 
                                src={selectedPlayer.avatar}
                                alt={selectedPlayer.ingameName}
                                fill
                                sizes="24px"
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <Users className={cn("text-slate-400 ml-2", compact ? "h-4 w-4" : "h-5 w-5")} />
                    )}
                    <span className="truncate">{selectedPlayer.ingameName}</span>
                </>
             ) : (
                <span className="pl-3 text-slate-500">{placeholder}</span>
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
            placeholder="Search player..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="overflow-hidden">
            {filteredPlayers.length === 0 && <CommandEmpty>No players found.</CommandEmpty>}
            <CommandGroup>
                {(() => {
                  const listHeight = Math.min(filteredPlayers.length * 46, 300);
                  return (
                    <div style={{ height: listHeight }}>
                      <Virtuoso
                        style={{ height: listHeight }}
                             totalCount={filteredPlayers.length}
                             itemContent={(index) => {
                               const p = filteredPlayers[index];
                               let rosterInfo = "";
                               if (attackerId != null) { // Changed to nullish check
                                   const r = p.roster.find((r: PlayerWithRoster['roster'][number]) => r.championId === attackerId);
                                   if (r) {
                                       rosterInfo = `(${r.stars}* R${r.rank}${r.isAscended ? '+' : ''})`;
                                   }
                               }

                               return (
                                 <CommandItem
                                   key={p.id}
                                   value={p.ingameName}
                                   onSelect={() => handleSelect(p.id)}
                                   className="flex items-center gap-2 cursor-pointer"
                                 >
                                   <div className="relative h-6 w-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                                       {p.avatar ? (
                                           <Image 
                                               src={p.avatar}
                                               alt={p.ingameName}
                                               fill
                                               sizes="24px"
                                               className="object-cover"
                                           />
                                       ) : (
                                           <Users className="h-4 w-4 m-1 text-slate-400" />
                                       )}
                                   </div>
                                   <span className="truncate">
                                       {p.ingameName}
                                       {rosterInfo && ( // Conditionally render span
                                         <span className="text-xs text-muted-foreground ml-1">{rosterInfo}</span>
                                       )}
                                   </span>
                                 </CommandItem>
                               );
                           }}
                         />
                       </div>
                     );
                   })()}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
});
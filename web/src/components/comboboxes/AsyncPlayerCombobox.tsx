"use client"

import * as React from "react"
import { ChevronsUpDown, X, Users, Loader2 } from "lucide-react"
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
import { useDebounce } from "@/hooks/use-debounce";

interface AsyncPlayerComboboxProps {
  value: string; // The player name or ID to display
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface PlayerResult {
    id: string;
    ingameName: string;
    avatar?: string | null;
}

export function AsyncPlayerCombobox({
  value,
  onSelect,
  placeholder = "Select player...",
  className,
}: AsyncPlayerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(value);
  const [results, setResults] = React.useState<PlayerResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  const debouncedSearch = useDebounce(search, 300);

  // Sync search state if external value changes (and popover is closed)
  React.useEffect(() => {
      if (!open && value !== search) {
          setSearch(value);
      }
  }, [value, open]);


  React.useEffect(() => {
    if (!open) return;
    if (debouncedSearch.length < 2) {
        setResults([]);
        return;
    }

    const fetchPlayers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search/players?q=${encodeURIComponent(debouncedSearch)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.players || []);
            }
        } catch (error) {
            console.error("Failed to fetch players", error);
        } finally {
            setLoading(false);
        }
    };

    fetchPlayers();
  }, [debouncedSearch, open]);

  const handleSelect = React.useCallback((name: string) => {
    onSelect(name);
    setSearch(name);
    setOpen(false);
  }, [onSelect]);

  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect("");
    setSearch("");
  }, [onSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
              "w-full justify-between pr-2 pl-3 rounded-md min-h-[2.25rem] items-center", 
              className
          )}
        >
          <div className="flex items-center gap-2 truncate">
             {value ? (
                <span className="truncate">{value}</span>
             ) : (
                <span className="text-slate-500">{placeholder}</span>
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
        className="w-[200px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search player..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500"/></div>}
            {!loading && results.length === 0 && search.length >= 2 && <CommandEmpty>No players found.</CommandEmpty>}
            {!loading && search.length < 2 && <div className="py-4 text-center text-xs text-slate-500">Type at least 2 characters</div>}
            
            <CommandGroup>
                {results.map((p) => (
                    <CommandItem
                        key={p.id}
                        value={p.ingameName}
                        onSelect={() => handleSelect(p.ingameName)}
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
                        <span className="truncate">{p.ingameName}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

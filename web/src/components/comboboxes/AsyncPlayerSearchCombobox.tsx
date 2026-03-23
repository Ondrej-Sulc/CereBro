"use client"

import * as React from "react"
import { ChevronsUpDown, X, Users, Loader2 } from "lucide-react"
import Image from "next/image";

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
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

interface AsyncPlayerSearchComboboxProps {
  value: string; // The display value when a single item is selected (if any)
  onSelect: (id: string, name: string, avatar: string | null) => void;
  placeholder?: string;
  className?: string;
}

interface PlayerResult {
    id: string;
    ingameName: string;
    avatar?: string | null;
}

export function AsyncPlayerSearchCombobox({
  value,
  onSelect,
  placeholder = "Search player...",
  className,
}: AsyncPlayerSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<PlayerResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listboxId = React.useId();
  
  const debouncedSearch = useDebounce(search, 300);
  const requestSeqRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) {
        setLoading(false);
        setError(null);
        setResults([]);
        return;
    }
    if (debouncedSearch.length < 2) {
        setLoading(false);
        setError(null);
        setResults([]);
        return;
    }

    const controller = new AbortController();
    let active = true;
    const seq = ++requestSeqRef.current;

    const fetchPlayers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/search/players?q=${encodeURIComponent(debouncedSearch)}`, {
                signal: controller.signal
            });
            if (res.ok) {
                const data = await res.json();
                if (active && seq === requestSeqRef.current && !controller.signal.aborted) {
                    setError(null);
                    setResults(data.players || []);
                }
            } else {
                if (active && seq === requestSeqRef.current && !controller.signal.aborted) {
                    setResults([]);
                    setError("Failed to load players. Please try again.");
                }
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error("Failed to fetch players", error);
            if (active && seq === requestSeqRef.current) {
                setResults([]);
                setError("Failed to load players. Please try again.");
            }
        } finally {
            if (active && seq === requestSeqRef.current && !controller.signal.aborted) {
                setLoading(false);
            }
        }
    };

    fetchPlayers();
    return () => {
        active = false;
        controller.abort();
    };
  }, [debouncedSearch, open]);

  const handleSelect = React.useCallback((id: string, name: string, avatar: string | null) => {
    onSelect(id, name, avatar);
    setSearch("");
    setOpen(false);
  }, [onSelect]);

  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect("", "", null);
    setSearch("");
  }, [onSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((v) => !v);
            }
          }}
          className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full justify-between pr-2 pl-3 rounded-md min-h-[2.25rem] items-center cursor-pointer", 
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
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700"
                aria-label="Clear player selection"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        id={listboxId}
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0"
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        align="start"
      >
        <Command shouldFilter={false} className="h-auto">
          <CommandInput
            placeholder={placeholder || "Search player..."}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500"/></div>}
            {!loading && error && <div className="py-4 text-center text-xs text-red-500">{error}</div>}
            {!loading && !error && results.length === 0 && search.length >= 2 && <CommandEmpty>No players found.</CommandEmpty>}
            {!loading && search.length < 2 && <div className="py-4 text-center text-xs text-slate-500">Type at least 2 characters</div>}
            
            <CommandGroup>
                {results.map((p) => (
                    <CommandItem
                        key={p.id}
                        value={p.ingameName}
                        onSelect={() => handleSelect(p.id, p.ingameName, p.avatar || null)}
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

"use client"

import * as React from "react"
import { ChevronsUpDown, X, Loader2, Shield } from "lucide-react"

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

interface AsyncAllianceComboboxProps {
  value: string; 
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface AllianceResult {
    id: string;
    name: string;
}

export function AsyncAllianceCombobox({
  value,
  onSelect,
  placeholder = "Select alliance...",
  className,
}: AsyncAllianceComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState(value);
  const [results, setResults] = React.useState<AllianceResult[]>([]);
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

    const fetchAlliances = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search/alliances?q=${encodeURIComponent(debouncedSearch)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.alliances || []);
            }
        } catch (error) {
            console.error("Failed to fetch alliances", error);
        } finally {
            setLoading(false);
        }
    };

    fetchAlliances();
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
            placeholder="Search alliance..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500"/></div>}
            {!loading && results.length === 0 && search.length >= 2 && <CommandEmpty>No alliances found.</CommandEmpty>}
            {!loading && search.length < 2 && <div className="py-4 text-center text-xs text-slate-500">Type at least 2 characters</div>}
            
            <CommandGroup>
                {results.map((a) => (
                    <CommandItem
                        key={a.id}
                        value={a.name}
                        onSelect={() => handleSelect(a.name)}
                        className="flex items-center gap-2 cursor-pointer"
                    >
                         <Shield className="h-4 w-4 text-slate-400" />
                        <span className="truncate flex-1">
                            <span className="text-sm">{a.name}</span>
                        </span>
                    </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

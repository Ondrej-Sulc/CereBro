"use client"

import * as React from "react"
import { ChevronsUpDown, X, User, Loader2 } from "lucide-react"
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

interface AsyncBotUserComboboxProps {
  value: string; // The user id to maintain state
  displayValue: string; // The user name to display
  onSelect: (id: string, name: string) => void;
  placeholder?: string;
  className?: string;
}

interface BotUserResult {
    id: string;
    name: string;
    image?: string | null;
}

export function AsyncBotUserCombobox({
  value,
  displayValue,
  onSelect,
  placeholder = "Search creators...",
  className,
}: AsyncBotUserComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<BotUserResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const listboxId = React.useId();

  const debouncedSearch = useDebounce(search, 300);
  const requestSeqRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    if (debouncedSearch.length < 2) {
        setResults([]);
        return;
    }

    const controller = new AbortController();
    const seq = ++requestSeqRef.current;

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search/users?q=${encodeURIComponent(debouncedSearch)}`, {     
                signal: controller.signal
            });
            if (res.ok) {
                const data = await res.json();
                if (seq === requestSeqRef.current && !controller.signal.aborted) {
                    setResults(data.users || []);
                }
            } else {
                if (seq === requestSeqRef.current && !controller.signal.aborted) {
                    setResults([]);
                }
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error("Failed to fetch users", error);
        } finally {
            if (seq === requestSeqRef.current) setLoading(false);
        }
    };

    fetchUsers();
    return () => controller.abort();
  }, [debouncedSearch, open]);

  const handleSelect = React.useCallback((id: string, name: string) => {
    onSelect(id, name);
    setSearch("");
    setOpen(false);
  }, [onSelect]);

  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect("", "");
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
                <span className="truncate">{displayValue || value}</span>
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
                aria-label="Clear user selection"
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
            placeholder="Search users..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500"/></div>}
            {!loading && results.length === 0 && search.length >= 2 && <CommandEmpty>No users found.</CommandEmpty>}
            {!loading && search.length < 2 && <div className="py-4 text-center text-xs text-slate-500">Type at least 2 characters</div>}

            <CommandGroup>
                {results.map((u) => (
                    <CommandItem
                        key={u.id}
                        value={u.name}
                        onSelect={() => handleSelect(u.id, u.name)}
                        className="flex items-center gap-2 cursor-pointer"
                    >
                         <div className="relative h-6 w-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-800">
                             {u.image ? (
                                 <Image
                                     src={u.image}
                                     alt={u.name}
                                     fill
                                     sizes="24px"
                                     className="object-cover"
                                 />
                             ) : (
                                 <User className="h-4 w-4 m-1 text-slate-400" />
                             )}
                         </div>
                        <span className="truncate">{u.name}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

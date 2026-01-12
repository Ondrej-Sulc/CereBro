"use client"

import * as React from "react"
import { Check, ChevronsUpDown, UserPlus } from "lucide-react"

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

interface Option {
  value: string;
  label: string;
}

interface CreatablePlayerComboboxProps {
  options: Option[];
  value: string; // The ID
  customValue: string; // The custom name
  onChange: (value: string, isCustom: boolean) => void;
  disabled?: boolean;
}

export function CreatablePlayerCombobox({
  options,
  value,
  customValue,
  onChange,
  disabled
}: CreatablePlayerComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedLabel = React.useMemo(() => {
    if (customValue) return customValue;
    return options.find((option) => option.value === value)?.label || "";
  }, [value, customValue, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-slate-900/50 border-slate-700/50 text-slate-200"
          disabled={disabled}
        >
          {selectedLabel || <span className="text-slate-500">Select or enter player...</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 border-slate-800 bg-slate-950" align="start">
        <Command className="bg-slate-950 text-slate-200">
          <CommandInput placeholder="Search or type name..." value={search} onValueChange={setSearch} className="border-none focus:ring-0" />
          <CommandList>
            <CommandEmpty className="py-2 px-2">
                {search && (
                    <div 
                        className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-slate-800 text-sky-400 font-medium"
                        onClick={() => {
                            onChange(search, true);
                            setOpen(false);
                        }}
                    >
                        <UserPlus className="h-4 w-4" />
                        <span>Use "{search}"</span>
                    </div>
                )}
                {!search && <span className="text-slate-500 text-sm px-2">No player found.</span>}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value, false)
                    setOpen(false)
                  }}
                  className="data-[selected=true]:bg-slate-800 text-slate-200"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value && !customValue ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

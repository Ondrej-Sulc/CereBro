"use client"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"

interface SeasonMultiSelectProps {
  seasons: number[];
  selected: number[];
  onChange: (selected: number[]) => void;
  placeholder?: string;
  className?: string;
}

export function SeasonMultiSelect({
  seasons,
  selected,
  onChange,
  placeholder = "Select Seasons",
  className,
}: SeasonMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (season: number) => {
    if (selected.includes(season)) {
      onChange(selected.filter((s) => s !== season))
    } else {
      onChange([...selected, season])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between px-2", className)}
        >
            {selected.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                    {selected.length > 2 ? (
                         <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                           {selected.length} selected
                         </Badge>
                    ) : (
                        selected.map(s => (
                            <Badge key={s} variant="secondary" className="rounded-sm px-1 font-normal">
                                S{s}
                            </Badge>
                        ))
                    )}
                </div>
            ) : (
                <span className="text-slate-500">{placeholder}</span>
            )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search season..." />
          <CommandEmpty>No season found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-y-auto">
            {seasons.map((season) => (
              <CommandItem
                key={season}
                value={season.toString()}
                onSelect={() => handleSelect(season)}
              >
                <div
                  className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    selected.includes(season)
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <Check className={cn("h-4 w-4")} />
                </div>
                <span>Season {season}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

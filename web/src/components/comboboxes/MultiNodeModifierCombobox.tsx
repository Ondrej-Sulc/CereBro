"use client"

import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"
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
import { NodeModifier } from "@prisma/client"

interface MultiNodeModifierComboboxProps {
    modifiers: NodeModifier[];
    values: string[]; // CUIDs
    onSelect: (values: string[]) => void;
    placeholder?: string;
    className?: string;
}

export const MultiNodeModifierCombobox = React.memo(function MultiNodeModifierCombobox({
    modifiers,
    values,
    onSelect,
    placeholder = "Select node modifiers...",
    className,
}: MultiNodeModifierComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const handleSelect = React.useCallback((modifierId: string) => {
        if (values.includes(modifierId)) {
            onSelect(values.filter((v) => v !== modifierId));
        } else {
            onSelect([...values, modifierId]);
        }
        setSearch(""); // Clear search on select
    }, [values, onSelect]);

    const handleRemove = React.useCallback((e: React.MouseEvent, modifierId: string) => {
        e.stopPropagation();
        onSelect(values.filter((v) => v !== modifierId));
    }, [values, onSelect]);

    // Initialize Fuse instance
    const fuse = React.useMemo(() => {
        return new Fuse(modifiers, {
            keys: ["name", "description"],
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true,
        });
    }, [modifiers]);

    const filteredModifiers = React.useMemo(() => {
        if (!search) return modifiers;
        return fuse.search(search).map(result => result.item);
    }, [fuse, search, modifiers]);

    const selectedModifiers = React.useMemo(() =>
        values.map(id => modifiers.find(m => m.id === id)).filter(Boolean) as NodeModifier[],
        [values, modifiers]);

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
                        {selectedModifiers.length > 0 ? (
                            selectedModifiers.map(modifier => (
                                <Badge key={modifier.id} variant="secondary" className="pl-2 pr-1 py-0.5 h-7 flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
                                    <span className="text-xs font-bold max-w-[120px] truncate">{modifier.name}</span>
                                    <div
                                        role="button"
                                        onClick={(e) => handleRemove(e, modifier.id)}
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
                onWheel={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
            >
                <Command shouldFilter={false} className="h-auto">
                    <CommandInput
                        placeholder="Search modifiers..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No modifiers found.</CommandEmpty>
                        <CommandGroup>
                            {filteredModifiers.slice(0, 100).map((modifier) => {
                                const isSelected = values.includes(modifier.id);
                                return (
                                    <CommandItem
                                        key={modifier.id}
                                        value={modifier.name + modifier.description}
                                        onSelect={() => handleSelect(modifier.id)}
                                        className={cn("flex flex-col items-start gap-1 cursor-pointer py-2", isSelected && "bg-slate-800 text-slate-100")}
                                    >
                                        <div className="flex items-center w-full justify-between">
                                            <span className={cn("font-bold", isSelected && "text-sky-400")}>{modifier.name}</span>
                                            {isSelected && <span className="text-xs text-sky-400 font-bold">✓</span>}
                                        </div>
                                        <span className="text-xs text-slate-400 line-clamp-2">{modifier.description}</span>
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

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
import { Tag } from "@prisma/client"

interface MultiTagComboboxProps {
    tags: Tag[];
    values: string[]; // Tag names
    onSelect: (values: string[]) => void;
    placeholder?: string;
    className?: string;
}

export const MultiTagCombobox = React.memo(function MultiTagCombobox({
    tags,
    values,
    onSelect,
    placeholder = "Select tags...",
    className,
}: MultiTagComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const handleSelect = React.useCallback((tagName: string) => {
        if (values.includes(tagName)) {
            onSelect(values.filter((v) => v !== tagName));
        } else {
            onSelect([...values, tagName]);
        }
        setSearch("");
    }, [values, onSelect]);

    const handleRemove = React.useCallback((e: React.MouseEvent, tagName: string) => {
        e.stopPropagation();
        onSelect(values.filter((v) => v !== tagName));
    }, [values, onSelect]);

    const fuse = React.useMemo(() => {
        return new Fuse(tags, {
            keys: ["name"],
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true,
        });
    }, [tags]);

    const filteredTags = React.useMemo(() => {
        if (!search) return tags;
        return fuse.search(search).map(result => result.item);
    }, [fuse, search, tags]);

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
                        {values.length > 0 ? (
                            values.map(tagName => (
                                <Badge key={tagName} variant="secondary" className="pl-2 pr-1 py-0.5 h-7 flex items-center gap-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
                                    <span className="text-xs font-bold truncate max-w-[120px]">{tagName}</span>
                                    <div
                                        role="button"
                                        onClick={(e) => handleRemove(e, tagName)}
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
                        placeholder="Search tags..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup>
                            {filteredTags.slice(0, 100).map((tag) => {
                                const isSelected = values.includes(tag.name);
                                return (
                                    <CommandItem
                                        key={tag.id}
                                        value={tag.name}
                                        onSelect={() => handleSelect(tag.name)}
                                        className={cn("flex items-center justify-between cursor-pointer py-2", isSelected && "bg-slate-800 text-slate-100")}
                                    >
                                        <span className={cn("font-bold text-xs")}>{tag.name}</span>
                                        {isSelected && <span className="text-xs text-sky-400 font-bold">✓</span>}
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

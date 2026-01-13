import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { FlipToggle } from "@/components/ui/flip-toggle";

export const FilterGroup = ({ options, value, onChange, className }: { options: { value: string, label: string }[], value: string, onChange: (v: string) => void, className?: string }) => (
    <div className={cn("flex items-center bg-slate-950 rounded-md border border-slate-800 p-1 shrink-0 overflow-x-auto no-scrollbar", className)}>
        {options.map(opt => (
            <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => onChange(opt.value)}
                className={cn(
                    "h-7 px-3 text-xs whitespace-nowrap",
                    value === opt.value ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
            >
                {opt.label}
            </Button>
        ))}
    </div>
);

export const MultiFilterGroup = ({ options, values, onChange, className }: { options: { value: string, label: string }[], values: string[], onChange: (v: string[]) => void, className?: string }) => {
    const toggleValue = (val: string) => {
        if (values.includes(val)) {
            onChange(values.filter(v => v !== val));
        } else {
            onChange([...values, val]);
        }
    };

    return (
        <div className={cn("flex items-center bg-slate-950 rounded-md border border-slate-800 p-1 shrink-0 overflow-x-auto no-scrollbar", className)}>
            {options.map(opt => (
                <Button
                    key={opt.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleValue(opt.value)}
                    className={cn(
                        "h-7 px-3 text-xs whitespace-nowrap",
                        values.includes(opt.value) ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                    )}
                >
                    {opt.label}
                </Button>
            ))}
        </div>
    );
};

export interface MultiSelectFilterProps {
    title: string;
    icon: React.ElementType;
    options: { id: string | number, name: string }[];
    selectedValues: string[];
    onSelect: (values: string[]) => void;
    placeholder?: string;
    logic: 'AND' | 'OR';
    onLogicChange: (logic: 'AND' | 'OR') => void;
}

export const MultiSelectFilter = ({ title, icon: Icon, options, selectedValues, onSelect, placeholder, logic, onLogicChange }: MultiSelectFilterProps) => {
    const [open, setOpen] = useState(false);

    const toggleValue = (val: string) => {
        if (selectedValues.includes(val)) {
            onSelect(selectedValues.filter(v => v !== val));
        } else {
            onSelect([...selectedValues, val]);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-9 border-slate-700 bg-slate-950 text-slate-300 justify-between min-w-[150px]">
                    <div className="flex items-center gap-2 truncate">
                        <Icon className="w-3.5 h-3.5" />
                        {selectedValues.length > 0 ? (
                            <span className="text-slate-100">{selectedValues.length} selected</span>
                        ) : (
                            <span>{title}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0 bg-slate-950 border-slate-800" align="start">
                <div className="p-2 border-b border-slate-800 bg-slate-900/50">
                    <FlipToggle
                        value={logic === 'AND'}
                        onChange={(val) => onLogicChange(val ? 'AND' : 'OR')}
                        leftLabel="OR"
                        rightLabel="AND"
                        className="w-full"
                    />
                </div>
                <Command className="bg-slate-950 text-slate-300">
                    <CommandInput placeholder={placeholder || `Search ${title}...`} className="h-9" />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                            <CommandItem
                                value="clear_filter"
                                onSelect={() => onSelect([])}
                                className="text-xs font-bold text-red-400"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Clear Filter
                            </CommandItem>
                            {options.map(opt => (
                                <CommandItem
                                    key={opt.id}
                                    value={opt.name}
                                    onSelect={() => toggleValue(opt.name)}
                                    className="text-xs"
                                >
                                    <div className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-slate-700",
                                        selectedValues.includes(opt.name) ? "bg-slate-100 text-slate-900" : "opacity-50 [&_svg]:invisible"
                                    )}>
                                        <Check className={cn("h-3 w-3")} />
                                    </div>
                                    {opt.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import Fuse from "fuse.js"

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
import { WarNode } from '@prisma/client';

interface NodeComboboxProps {
  nodes: WarNode[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string; // Add className here
}

export const NodeCombobox = React.memo(function NodeCombobox({
  nodes,
  value,
  onSelect,
  placeholder = "Select a node...",
  className,
}: NodeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const handleSelect = React.useCallback((nodeId: string) => {
    onSelect(nodeId);
    setSearch("");
    setOpen(false);
  }, [onSelect]);

  const fuse = React.useMemo(() => {
    return new Fuse(nodes, {
      keys: ["nodeNumber", "description"],
      threshold: 0.3,
      distance: 100,
      ignoreLocation: true,
    });
  }, [nodes]);

  const filteredNodes = React.useMemo(() => {
    if (!search) return nodes;
    return fuse.search(search).map(result => result.item);
  }, [fuse, search, nodes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="">
            {value ? `${nodes.find((n) => String(n.id) === value)?.nodeNumber}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0"
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="h-auto">
          <CommandInput
            placeholder="Search node..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No node found.</CommandEmpty>
            <CommandGroup>
                {filteredNodes.slice(0, 100).map((node) => (
                    <CommandItem
                        key={node.id}
                        value={String(node.nodeNumber)}
                        onSelect={() => handleSelect(String(node.id))}
                    >
                        {node.nodeNumber}
                    </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
});
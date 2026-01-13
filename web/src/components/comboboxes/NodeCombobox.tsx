"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import { Virtuoso } from "react-virtuoso";

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
    setOpen(false);
  }, [onSelect]);

  const filteredNodes = React.useMemo(() =>
    nodes.filter(node =>
      String(node.nodeNumber).includes(search) ||
      node.description?.toLowerCase().includes(search.toLowerCase())
    ), [nodes, search]
  );

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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Search node..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No node found.</CommandEmpty>
          <CommandGroup>
            {open && (
                <Virtuoso
                    style={{ height: "288px" }}
                    data={filteredNodes}
                    itemContent={(index, node) => (
                        <CommandItem
                            key={node.id}
                            value={String(node.nodeNumber)}
                            onSelect={() => handleSelect(String(node.id))}
                        >
                            {node.nodeNumber}
                        </CommandItem>
                    )}
                />
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
});